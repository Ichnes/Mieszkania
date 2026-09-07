import { request as httpsRequest } from "node:https";
import { archiveOfferArtifacts } from "../../services/offer-archive";
import { downloadListingMedia } from "../../services/media-downloader";
import { getFamilySettings } from "../../services/family-settings";
import { geocodeListing } from "../../services/geocoding";
import { normalizePolish } from "../../services/address-normalization";
import { extractStreetFromLocationTitle, inferWarsawDistrictFromLocationTitle, inferWarsawDistrictFromText } from "../../services/listing-title-location";
import { inferConstructionYear, inferStructuredConstructionYear } from "../../services/listing-description-facts";
import {
  claimListingImportBatch,
  completeListingImport,
  deferListingImport,
  enqueueListingImports,
  failListingImport,
  getKnownListingExternalIds,
  getListingImportQueueStatus,
  releaseDelayedListingImportsNow,
  retryFailedListingImportsNow
} from "../../services/listing-import-queue";
import { OtodomStorage } from "../otodom/otodom-storage";
import type { ParsedListing, SourceListingReference } from "../types";

const sourceKey = "nieruchomosci_online";
const detailRequestIntervalMs = 5_000;
const rateLimitCooldownMinutes = 30;

export class NieruchomosciOnlineCollector {
  private readonly storage = new OtodomStorage();
  private nextDetailRequestAt = 0;
  private rateLimitedUntil = 0;
  private detailRequestSchedule: Promise<void> = Promise.resolve();

  async collectOne(url: string, options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean }) {
    return this.collectOneInternal(url, externalIdFromUrl(url), options);
  }

  async discoverAll(input: { city: string; startPage?: number; maxPages?: number; batchPages?: number; priority?: number }) {
    const settings = await getFamilySettings();
    const city = input.city.trim().toLowerCase() || settings.searchContract.city.toLowerCase();
    const startPage = Math.max(1, input.startPage ?? 1);
    const maxPages = Math.max(1, Math.min(500, input.maxPages ?? 250));
    const batchPages = Math.max(1, Math.min(20, input.batchPages ?? 5));
    let queued = 0;
    let discovered = 0;
    let scannedPages = 0;
    let currentPage = startPage;
    let error: string | undefined;

    while (scannedPages < maxPages) {
      const pages = Math.min(batchPages, maxPages - scannedPages);
      try {
        const links = await this.discover({ city, startPage: currentPage, pages });
        const result = await enqueueListingImports({ sourceKey, city, priority: input.priority ?? 100, items: links });
        queued += result.queued;
        discovered += links.length;
        scannedPages += pages;
        currentPage += pages;
        if (links.length === 0) break;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Nieruchomosci-online discovery failed";
        break;
      }
    }

    return { city, startPage, scannedPages, discovered, queued, stoppedBecause: error ? "error" : scannedPages >= maxPages ? "max_pages" : "empty_batches", error };
  }

  async discover(input: { city: string; startPage?: number; pages?: number }) {
    const results: SourceListingReference[] = [];
    const pages = Math.max(1, Math.min(20, input.pages ?? 1));
    const startPage = Math.max(1, input.startPage ?? 1);
    for (let offset = 0; offset < pages; offset += 1) {
      const url = buildSearchUrl(input.city, startPage + offset);
      const html = await fetchHtml(url);
      results.push(...extractReferences(html));
    }
    return dedupe(results);
  }

  async processQueue(input?: { limit?: number; concurrency?: number; downloadMedia?: boolean; force?: boolean; queueKind?: "all" | "price_updates" }) {
    if (input?.force) {
      this.rateLimitedUntil = 0;
      await releaseDelayedListingImportsNow({ sourceKey, limit: Math.max(1, Math.min(input.limit ?? 200, 500)) });
    }
    if (this.rateLimitedUntil > Date.now()) {
      return {
        claimed: 0,
        completed: 0,
        failed: 0,
        deferred: 0,
        pausedUntil: new Date(this.rateLimitedUntil).toISOString(),
        failures: []
      };
    }
    const limit = Math.max(1, Math.min(500, input?.limit ?? 200));
    const concurrency = Math.max(1, Math.min(3, input?.concurrency ?? 3));
    let claimedCount = 0;
    let completed = 0;
    let failed = 0;
    let deferred = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];

    // Reserve only the next small slice so a long batch does not leave jobs
    // waiting in 'processing' beyond the stale-job recovery interval.
    while (claimedCount < limit && this.rateLimitedUntil <= Date.now()) {
    const claimed = await claimListingImportBatch({ sourceKey, limit: Math.min(15, limit - claimedCount), queueKind: input?.queueKind });
    if (!claimed.length) break;
    claimedCount += claimed.length;
    const knownExternalIds = await getKnownListingExternalIds({ sourceKey, externalIds: claimed.map((item) => item.external_id) });
    let cursor = 0;
    const worker = async () => {
    while (cursor < claimed.length) {
      const item = claimed[cursor++];
      try {
        const priceOnly = knownExternalIds.has(item.external_id);
        await this.collectOneInternal(item.canonical_url, item.external_id, { refreshMode: priceOnly ? "price_only" : "full", downloadMedia: priceOnly ? false : input?.downloadMedia !== false });
        completed += 1;
        await completeListingImport(item.id);
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : "unknown error";
        if (isRateLimitedError(cause)) {
          deferred += 1;
          await deferListingImport({
            id: item.id,
            reason: error,
            delayMinutes: rateLimitCooldownMinutes,
            metadata: { failureCode: "rate_limited" }
          });
        } else {
          failed += 1;
          failures.push({ externalId: item.external_id, url: item.canonical_url, error });
          await failListingImport({ id: item.id, error, attempts: item.attempts + 1 });
        }
      }
    }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, claimed.length) }, worker));
    }
    return {
      claimed: claimedCount,
      completed,
      failed,
      deferred,
      pausedUntil: this.rateLimitedUntil > Date.now() ? new Date(this.rateLimitedUntil).toISOString() : undefined,
      failures
    };
  }

  async getQueueStatus() { return getListingImportQueueStatus(sourceKey); }
  async retryFailed(limit?: number) { return retryFailedListingImportsNow({ sourceKey, limit }); }

  private async collectOneInternal(url: string, queuedExternalId: string, options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean }) {
    await this.waitForDetailRequestSlot();
    try {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    let rendered;
    if (isPriceOnlyRefresh) {
      try {
        rendered = await fetchStaticPage(url);
      } catch (error) {
        if (isRateLimitedError(error)) throw error;
        await this.waitForDetailRequestSlot();
        rendered = await fetchRenderedPage(url, [], { mode: "price_only" });
      }
    } else {
      rendered = await fetchRenderedPage(url, ["Rozwiń opis", "Oddzwoń do mnie"]);
    }
    let parsed = parseListing(url, rendered.html, queuedExternalId, rendered.text, rendered.description);
    if (isPriceOnlyRefresh && !parsed.priceAmount && !isUnavailableNieruchomosciOnlineListing(rendered.text) && !rendered.usedBrowser) {
      await this.waitForDetailRequestSlot();
      rendered = await fetchRenderedPage(url, ["Rozwiń opis", "Oddzwoń do mnie"], { mode: "price_only" });
      parsed = parseListing(url, rendered.html, queuedExternalId, rendered.text, rendered.description);
    }
    const unavailable = isUnavailableNieruchomosciOnlineListing(rendered.text);
    if (unavailable) {
      parsed.status = "removed";
    } else if (!parsed.priceAmount) {
      throw new Error(`MISSING_PRICE: ${parsed.externalId} (${url})`);
    }
    if (!isPriceOnlyRefresh && (!parsed.latitude || !parsed.longitude)) {
      const point = await geocodeListing({ city: parsed.city, district: parsed.district, neighborhood: parsed.neighborhood, street: parsed.street, addressText: parsed.addressText });
      if (point) Object.assign(parsed, point);
    }
    const archived = isPriceOnlyRefresh
      ? null
      : await archiveOfferArtifacts({ sourceKey, externalId: parsed.externalId, timestamp: new Date().toISOString(), html: rendered.html, parsed });
    const stored = await this.storage.upsertListingSnapshot({
      sourceKey,
      listing: parsed,
      refreshMode: options?.refreshMode,
      rawArtifact: {
        type: isPriceOnlyRefresh ? "json" : "html",
        storageKey: archived?.rawStorageKey ?? `sources/${sourceKey}/${parsed.externalId}/price/${Date.now()}.json`,
        payload: isPriceOnlyRefresh
          ? { url, priceAmount: parsed.priceAmount }
          : { url, checksum: archived?.rawChecksum, parsedStorageKey: archived?.parsedStorageKey, encoding: archived?.encoding }
      }
    });
    if (options?.downloadMedia !== false) await downloadListingMedia(stored.mediaAssets);
    return { ...stored, archived: archived ?? { basePath: "", rawHtmlPath: "", parsedJsonPath: "" } };
    } catch (error) {
      if (isRateLimitedError(error)) {
        this.rateLimitedUntil = Math.max(this.rateLimitedUntil, Date.now() + rateLimitCooldownMinutes * 60_000);
        throw new Error(`RATE_LIMITED: cooldown ${rateLimitCooldownMinutes} min (${url})`);
      }
      throw error;
    }
  }

  private async waitForDetailRequestSlot() {
    const scheduled = this.detailRequestSchedule.then(async () => {
      if (this.rateLimitedUntil > Date.now()) {
        throw new Error(`RATE_LIMITED: cooldown active until ${new Date(this.rateLimitedUntil).toISOString()}`);
      }
      const delay = Math.max(0, this.nextDetailRequestAt - Date.now());
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      if (this.rateLimitedUntil > Date.now()) throw new Error("RATE_LIMITED: cooldown activated while waiting");
      this.nextDetailRequestAt = Date.now() + detailRequestIntervalMs;
    });
    this.detailRequestSchedule = scheduled.catch(() => undefined);
    await scheduled;
  }
}

function buildSearchUrl(city: string, page: number) {
  const slug = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "warszawa";
  const url = slug === "warszawa"
    ? new URL("https://www.nieruchomosci-online.pl/szukaj.html?3,mieszkanie,sprzedaz,,Warszawa:20571,,,,900000-2000000,56,,,,,,3,,,,,,,,,,,,,,,,,,,,,,,1")
    : new URL(`https://${slug}.nieruchomosci-online.pl/mieszkania,sprzedaz/`);
  if (page > 1) url.searchParams.set("p", String(page));
  return url.toString();
}

function externalIdFromUrl(url: string) {
  const match = url.match(/\/(\d+)\.html(?:$|[?#])/);
  return `nieruchomosci-online-${match?.[1] ?? Buffer.from(url).toString("base64url").slice(0, 16)}`;
}

function isUnavailableNieruchomosciOnlineListing(visibleText: string) {
  return /ups\s*[.!…]*\s*to og\u0142oszenie ju\u017c nie istnieje|to og\u0142oszenie jest ju\u017c nieaktualne/i.test(visibleText);
}

async function fetchHtml(url: string, timeoutMs = 60_000, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: nieruchomosciOnlineHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status === 429) throw new Error(`RATE_LIMITED: HTTP 429 (${url})`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) {
      if ((isCertificateError(error) || (error instanceof TypeError && error.message === "fetch failed")) && isNieruchomosciOnlineHost(new URL(url).hostname)) {
        return fetchTrustedNieruchomosciOnlinePage(url, 4, timeoutMs);
      }
      if (isRateLimitedError(error)) throw error;
      lastError = error;
      if (attempt < attempts) await delay(attempt * 900);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Nieruchomosci-online fetch failed: ${url}`);
}

function delay(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }

function fetchTrustedNieruchomosciOnlinePage(url: string, redirectsLeft = 4, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolvePage, rejectPage) => {
    const target = new URL(url);
    if (!isNieruchomosciOnlineHost(target.hostname)) {
      rejectPage(new Error(`Refusing untrusted Nieruchomosci-online page host: ${target.hostname}`));
      return;
    }
    const request = httpsRequest(url, {
      method: "GET",
      headers: nieruchomosciOnlineHeaders,
      rejectUnauthorized: false,
      timeout: timeoutMs
    }, (response) => {
      const status = response.statusCode ?? 500;
      const location = response.headers.location;
      if (location && status >= 300 && status < 400 && redirectsLeft > 0) {
        response.resume();
        const redirectedUrl = new URL(location, url);
        if (!isNieruchomosciOnlineHost(redirectedUrl.hostname)) {
          rejectPage(new Error(`Refusing untrusted Nieruchomosci-online redirect to ${redirectedUrl.hostname}`));
          return;
        }
        void fetchTrustedNieruchomosciOnlinePage(redirectedUrl.toString(), redirectsLeft - 1, timeoutMs).then(resolvePage, rejectPage);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        rejectPage(new Error(status === 429 ? `RATE_LIMITED: HTTP 429 (${url})` : `HTTP ${status}: ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolvePage(Buffer.concat(chunks).toString("utf8")));
    });
    request.on("timeout", () => request.destroy(new Error(`Nieruchomosci-online request timed out for ${url}`)));
    request.on("error", rejectPage);
    request.end();
  });
}

function isNieruchomosciOnlineHost(hostname: string) {
  return hostname === "nieruchomosci-online.pl" || hostname.endsWith(".nieruchomosci-online.pl");
}

function isCertificateError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  return cause instanceof Error && /certificate|cert_|unable to verify/i.test(`${cause.message} ${(cause as NodeJS.ErrnoException).code ?? ""}`);
}

function isRateLimitedError(error: unknown) {
  return error instanceof Error && /RATE_LIMITED|HTTP\s+429/i.test(error.message);
}

const nieruchomosciOnlineHeaders = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "pl-PL,pl;q=0.9",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"
};

async function fetchStaticPage(url: string) {
  const html = await fetchHtml(url, 15_000, 1);
  return { html, text: strip(html), description: "", usedBrowser: false };
}

function extractReferences(html: string) {
  return Array.from(html.matchAll(/href=["']([^"']*\/mieszkanie,na-sprzedaz\/(\d+)\.html)[^"']*["']/gi)).map((match) => ({ externalId: `nieruchomosci-online-${match[2]}`, url: new URL(match[1], "https://www.nieruchomosci-online.pl").toString() }));
}

function dedupe(items: SourceListingReference[]) { return Array.from(new Map(items.map((item) => [item.externalId, item])).values()); }

export function parseListing(url: string, html: string, externalId: string, visibleText = strip(html), descriptionOverride?: string): ParsedListing {
  const json = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).flatMap((match) => { try { return [JSON.parse(match[1]) as Record<string, unknown>]; } catch { return []; } });
  const nodes = json.flatMap((value) => Array.isArray(value["@graph"]) ? value["@graph"] as Record<string, unknown>[] : [value]);
  const product = nodes.find((node) => node.offers && typeof node.offers === "object") ?? nodes.find((node) => node.name || node.description) ?? {};
  const offerValue = product.offers;
  const offer = Array.isArray(offerValue)
    ? offerValue.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") ?? {}
    : typeof offerValue === "object" && offerValue ? offerValue as Record<string, unknown> : {};
  const title = text(product.name) ?? meta(html, "og:title") ?? "Oferta Nieruchomosci-online";
  const description = descriptionOverride?.trim() || extractDescription(visibleText) || strip(text(product.description) ?? meta(html, "og:description") ?? "");
  const address = extractNieruchomosciAddress(html);
  // Domiporta exposes the offer amount in a dedicated HTML field rather than
  // JSON-LD. Add it to the parser's text fallbacks in a normalized form.
  visibleText = `${extractPortalPrice(url, html) ?? ""} ${visibleText}`;
  const portalPrice = extractPortalPrice(url, html);
  const priceNearLabel = (value: string) => portalPrice
    ?? value.match(/\b([0-9]{1,3}(?:[\s\u00a0][0-9]{3})+)\s*(?:z\u0142|PLN)\b/i)?.[1];
  const price = number(text(offer.price) ?? priceNearLabel(visibleText) ?? description.match(/([0-9\s]+)\s*zł/i)?.[1]);
  const area = number(text(product.floorSize) ?? visibleText.match(/([0-9]+(?:[,.][0-9]+)?)\s*m(?:²|2)/i)?.[1]);
  // Domiporta keeps the authoritative room count in its feature grid. Its
  // descriptive text often contains unrelated numbers, so never infer rooms
  // from that text before reading the dedicated field.
  const domiportaRooms = new URL(url).hostname.toLowerCase().includes("domiporta.pl")
    ? number(readDomiportaFeature(html, "LICZBA POKOI"))
    : undefined;
  const rooms = domiportaRooms ?? number(text(product.numberOfRooms) ?? visibleText.match(/(?:Liczba pokoi\s*:?\s*|\b)([1-9])[- ]*pokoj/i)?.[1]);
  const image = text(product.image) ?? meta(html, "og:image");
  const location = [title, description].join(" ");
  const district = inferWarsawDistrictFromLocationTitle(title) ?? address.district ?? inferWarsawDistrictFromText(location);
  const addressStreet = address.street && normalizePolish(address.street) !== normalizePolish("Warszawa") ? address.street : undefined;
  const street = addressStreet ?? extractStreetFromLocationTitle(title, district, "Warszawa");
  const phone = visibleText.match(/\b(?:\+48\s*)?(\d{3}[\s-]?\d{3}[\s-]?\d{3})\b/)?.[1]?.replace(/\s|-/g, "");
  const images = extractListingImages(url, html, image);
  const portalDetails = extractPortalListingDetails(url, html);
  const yearBuilt = inferStructuredConstructionYear(product)
    ?? portalDetails.yearBuilt
    ?? inferConstructionYear(description.slice(0, 5_000));
  const publishedAt = firstValidPublishedAt(
    text(product.datePublished),
    text(product.dateCreated),
    text(product.datePosted),
    meta(html, "article:published_time"),
    meta(html, "datePublished")
  );
  const isArchived = /to og[łl]oszenie jest ju[żz] nieaktualne|og[łl]oszenia archiwalne prezentujemy/i.test(`${html} ${visibleText}`);
  return { externalId, canonicalUrl: url, title: strip(title), description: description || undefined, city: "Warszawa", district, street, addressText: [street, district, "Warszawa"].filter(Boolean).join(", ") || "Warszawa", sourceContactPhone: phone, priceAmount: price, areaSqm: area, rooms, floor: portalDetails.floor, totalFloors: portalDetails.totalFloors, yearBuilt, publishedAt: publishedAt ?? undefined, marketType: /rynek pierwotny/i.test(location) ? "primary" : "secondary", offerType: "sale", status: isArchived ? "removed" : "active", images: images.map((sourceUrl, position) => ({ sourceUrl, position, isPrimary: position === 0 })), rawPayload: { url, jsonLd: json, portalFeatures: { fees: portalDetails.maintenanceFee, yearBuilt: portalDetails.yearBuilt } } };
}

function extractNieruchomosciAddress(html: string) {
  const block = html.match(/<strong>\s*Adres:\s*<\/strong>\s*<span>([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const values = Array.from(block.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)).map((match) => strip(match[1])).filter(Boolean);
  const plain = strip(block).split(",").map((value) => value.trim()).filter(Boolean);
  return { street: values[0] ?? plain[0], district: values[1] ?? plain.find((value) => /Mokotów|Wilanów|Wola|Ursynów|Żoliborz|Bemowo|Ochota|Bielany|Włochy|Praga|Śródmieście/i.test(value)) };
}

function firstValidPublishedAt(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value?.trim()) continue;
    const date = new Date(value.trim());
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export async function fetchRenderedPage(
  url: string,
  expandButtons: string[],
  options?: { mode?: "full" | "price_only" }
) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    if (options?.mode === "price_only") {
      await page.route("**/*", route => ["image", "media", "font"].includes(route.request().resourceType()) ? route.abort() : route.continue());
    }
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (response?.status() === 429) {
      throw new Error(`RATE_LIMITED: HTTP 429 (${url})`);
    }
    if (response && response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}: ${url}`);
    }
    for (const consent of ["Nie zgadzam się", "Tylko niezbędne pliki cookie", "Akceptuj"]) {
      const button = page.getByRole("button", { name: new RegExp(consent, "i") }).first();
      if (await button.count()) { await button.click({ timeout: 1500 }).catch(() => undefined); break; }
    }
    if (options?.mode !== "price_only") {
      // Nieruchomosci-online keeps the complete offer description behind this
      // precise control; the server-rendered HTML only contains the truncated text.
      const nieruchomosciDescription = page.locator("div.estate-desc-less > button.show-more-a").first();
      if (await nieruchomosciDescription.count()) {
        await nieruchomosciDescription.click({ timeout: 5_000, force: true }).catch(() => undefined);
        await page.waitForTimeout(250);
      }

      const nieruchomosciPhone = page.locator("p.phone.first .icon-arrow-black-small-right-a, p.phone.first .icon-arrow-black-small-right").first();
      if (await nieruchomosciPhone.count()) await nieruchomosciPhone.click({ timeout: 2500 }).catch(() => undefined);

      const domiportaGallery = page.locator(".gallery__container__open-gallery-text").first();
      if (await domiportaGallery.count()) {
        await domiportaGallery.click({ timeout: 2500 }).catch(() => undefined);
        await page.waitForTimeout(250);
      }
      for (const label of expandButtons) {
        const button = page.getByRole("button", { name: new RegExp(label, "i") }).first();
        if (await button.count()) await button.click({ timeout: 2500 }).catch(() => undefined);
      }
    }
    await page.waitForTimeout(options?.mode === "price_only" ? 150 : 500);
    const nieruchomosciDescriptionText = page.locator("div.estate-desc-more p.body-md").first();
    const descriptionPanel = page.locator(".description__panel").first();
    const description = await nieruchomosciDescriptionText.count()
      ? await nieruchomosciDescriptionText.innerText().catch(() => "")
      : await descriptionPanel.count()
        ? await descriptionPanel.innerText().catch(() => "")
        : "";
    return { html: await page.content(), text: await page.locator("body").innerText(), description, usedBrowser: true };
  } finally {
    await browser.close();
  }
}

function priceNearLabel(value: string) {
  return value.match(/(?:Cena|zł\/m²)[\s:]*([0-9\s]+)\s*zł/i)?.[1] ?? value.match(/\b([0-9]{1,3}(?:[\s\u00a0][0-9]{3})+)\s*zł\b/i)?.[1];
}

function extractDescription(value: string) {
  const match = value.match(/Opis (?:nieruchomości|oferty)\s*([\s\S]*?)(?:\n(?:Rozwiń opis|Rozwiń|Zwiń|Kontakt|Zapytaj o ofertę)\b|$)/i);
  return match ? match[1].trim() : "";
}

function isListingPhoto(value: string) {
  const normalized = value.toLowerCase();
  return /\.(?:jpg|jpeg|webp|png)(?:[?#].*)?$/i.test(value)
    && !/\/no\/gfx\/|icon|logo|badge|googleplay|appstore|avatar|placeholder|sprite/.test(normalized);
}

function extractListingImages(url: string, html: string, primaryImage?: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  const candidates = hostname.includes("domiporta.pl")
    ? Array.from(html.matchAll(/<source[^>]+srcset=["'](https:\/\/galeria\.domiporta\.pl\/pictures\/big\/[^"']+\.jpg(?:[?#][^"']*)?)/gi)).map((match) => match[1])
    : hostname.includes("nieruchomosci-online.pl")
      ? Array.from(html.matchAll(/\bdata-image=["'](https?:[^"']+\.(?:jpg|jpeg|webp|png)[^"']*)/gi)).map((match) => match[1])
      : Array.from(html.matchAll(/(?:src|data-src)=["'](https?:[^"']+\.(?:jpg|jpeg|webp|png)[^"']*)/gi)).map((match) => match[1]);

  return Array.from(new Set([primaryImage, ...candidates]
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter(isListingPhoto))).slice(0, 40);
}

function extractPortalListingDetails(url: string, html: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("domiporta.pl")) {
    const fee = parsePortalAmount(readDomiportaFeature(html, "Czynsz administracyjny"));
    const floorValue = readDomiportaFeature(html, "Piętro");
    const totalFloors = parsePortalAmount(readDomiportaFeature(html, "Liczba pięter w budynku"));
    const yearBuilt = extractDomiportaConstructionYear(html);
    return {
      maintenanceFee: fee ? `${new Intl.NumberFormat("pl-PL").format(fee)} PLN` : undefined,
      floor: /^parter$/i.test(floorValue ?? "") ? 0 : parsePortalAmount(floorValue),
      totalFloors,
      yearBuilt
    };
  }

  if (hostname.includes("nieruchomosci-online.pl")) {
    const fee = parsePortalAmount(html.match(/<strong>\s*Czynsz:\s*<\/strong>[\s\S]{0,120}?<span[^>]*>\s*([\d\s&nbsp;]+)\s*z(?:ł|l)/i)?.[1]);
    const yearBuilt = extractNieruchomosciOnlineConstructionYear(html);
    return { maintenanceFee: fee ? `${new Intl.NumberFormat("pl-PL").format(fee)} PLN` : undefined, yearBuilt };
  }

  return {};
}

export function extractNieruchomosciOnlineConstructionYear(html: string) {
  const attributeBoxYear = html.match(/box__attributes--content[\s\S]{0,500}?Rok\s+budowy\s*:[\s\S]{0,220}?class=["'][^"']*fsize-a[^"']*["'][^>]*>\s*((?:18|19|20)\d{2})\s*</i)?.[1];
  const legacyYear = html.match(/<strong>\s*Rok\s+budowy:\s*<\/strong>[\s\S]{0,160}?<span[^>]*>\s*((?:18|19|20)\d{2})/i)?.[1];
  return parsePortalAmount(attributeBoxYear ?? legacyYear);
}

function extractPortalPrice(url: string, html: string) {
  if (!new URL(url).hostname.toLowerCase().includes("domiporta.pl")) {
    return undefined;
  }

  const raw = html.match(/<span[^>]*summary__price_number[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  return raw
    ?.replace(/<[^>]+>/g, " ")
    .replace(/(?:&nbsp;|&#x0*a0;|&#160;)/gi, " ")
    .replace(/PLN/gi, "zł")
    .replace(/\s+/g, " ")
    .trim();
}

function readDomiportaFeature(html: string, label: string) {
  const escapedLabel = escapeRegExp(label).replace(/\\ /g, "\\s+");
  const legacyMatch = html.match(new RegExp(
    `<span[^>]*features__item_name[^>]*>\\s*${escapedLabel}\\s*<\\/span>\\s*<span[^>]*features__item_value[^>]*>([\\s\\S]*?)<\\/span>`,
    "i"
  ));
  const compactMatch = html.match(new RegExp(
    `<p[^>]*features-short__name[^>]*>\\s*${escapedLabel}\\s*<\\/p>\\s*<p[^>]*features-short__value[^>]*>([\\s\\S]*?)<\\/p>`,
    "i"
  ));
  return (compactMatch?.[1] ?? legacyMatch?.[1])?.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function extractDomiportaConstructionYear(html: string) {
  return parsePortalAmount(readDomiportaFeature(html, "Rok budowy"));
}

function parsePortalAmount(value?: string) {
  const normalized = value?.replace(/[^\d]/g, "") ?? "";
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function meta(html: string, key: string) { return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)`, "i"))?.[1]; }
function text(value: unknown) {
  if (typeof value === "string") return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}
function strip(value: string) { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function number(value?: string) { if (!value) return undefined; const parsed = Number(value.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, "")); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; }
