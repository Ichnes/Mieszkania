import { createHash } from "node:crypto";
import { archiveOfferArtifacts } from "../../services/offer-archive";
import { downloadListingMedia } from "../../services/media-downloader";
import { getFamilySettings } from "../../services/family-settings";
import { geocodeListing } from "../../services/geocoding";
import {
  claimListingImportBatch,
  completeListingImport,
  enqueueListingImports,
  failListingImport,
  getKnownListingExternalIds,
  getListingImportQueueStatus,
  retryFailedListingImportsNow
} from "../../services/listing-import-queue";
import { OtodomStorage } from "../otodom/otodom-storage";
import type { ParsedListing, SourceListingReference } from "../types";

const sourceKey = "maxon";

export class MaxonCollector {
  private readonly storage = new OtodomStorage();

  async collectOne(url: string, options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean }) {
    return this.collect(url, externalIdFromUrl(url), options);
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
        const links = await this.discover(city, currentPage, pages);
        const result = await enqueueListingImports({ sourceKey, city, priority: input.priority ?? 100, items: links });
        queued += result.queued;
        discovered += links.length;
        scannedPages += pages;
        currentPage += pages;
        if (links.length === 0) break;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Maxon discovery failed";
        break;
      }
    }

    return { city, startPage, scannedPages, discovered, queued, stoppedBecause: error ? "error" : scannedPages >= maxPages ? "max_pages" : "empty_batches", error };
  }

  async processQueue(input?: { limit?: number; concurrency?: number; queueKind?: "all" | "price_updates" }) {
    const claimed = await claimListingImportBatch({ sourceKey, limit: Math.max(1, Math.min(500, input?.limit ?? 100)), queueKind: input?.queueKind });
    const knownExternalIds = await getKnownListingExternalIds({ sourceKey, externalIds: claimed.map((item) => item.external_id) });
    const concurrency = Math.max(1, Math.min(2, input?.concurrency ?? 2));
    let completed = 0;
    let failed = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];
    for (let offset = 0; offset < claimed.length; offset += concurrency) {
      const batch = claimed.slice(offset, offset + concurrency);
      const results = await Promise.allSettled(batch.map((item) => {
        const priceOnly = knownExternalIds.has(item.external_id);
        return this.collect(item.canonical_url, item.external_id, { refreshMode: priceOnly ? "price_only" : "full", downloadMedia: priceOnly ? false : true });
      }));
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const item = batch[index];
        if (result.status === "fulfilled") {
          completed += 1;
          await completeListingImport(item.id);
        } else {
          failed += 1;
          const error = result.reason instanceof Error ? result.reason.message : "unknown error";
          failures.push({ externalId: item.external_id, url: item.canonical_url, error });
          await failListingImport({ id: item.id, error, attempts: item.attempts + 1 });
        }
      }
    }
    return { claimed: claimed.length, completed, failed, failures };
  }

  async getQueueStatus() { return getListingImportQueueStatus(sourceKey); }
  async retryFailed(limit?: number) { return retryFailedListingImportsNow({ sourceKey, limit }); }

  private async discover(city: string, startPage: number, pages: number) {
    const references: SourceListingReference[] = [];
    for (let offset = 0; offset < pages; offset += 1) {
      const html = await fetchHtml(buildSearchUrl(city, startPage + offset));
      references.push(...extractReferences(html));
    }
    return Array.from(new Map(references.map((item) => [item.externalId, item])).values());
  }

  private async collect(url: string, externalId: string, options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean }) {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    let rendered = isPriceOnlyRefresh ? await fetchStaticPage(url) : await fetchRenderedPage(url);
    // Queue rows are keyed by the ID that owns the existing listing. Some old
    // Maxon records predate numeric OfferId discovery and use a URL hash. During
    // refresh we must update that exact record instead of silently creating a
    // second listing under the newer numeric ID.
    const storedExternalId = isPriceOnlyRefresh ? externalId : resolveExternalId(externalId, rendered.html);
    let parsed = parseListing(url, rendered.html, rendered.text, storedExternalId);
    if (isPriceOnlyRefresh && !parsed.priceAmount) {
      rendered = await fetchRenderedPage(url, { mode: "price_only" });
      parsed = parseListing(url, rendered.html, rendered.text, storedExternalId);
    }
    if (!parsed.priceAmount) throw new Error(`MISSING_PRICE: ${parsed.externalId} (${url})`);
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
    return stored;
  }
}

function buildSearchUrl(city: string, page: number) {
  const url = new URL("https://www.maxon.pl/mieszkania/oferty/mieszkania/sprzedaz");
  url.searchParams.set("Location", `MAZOWIECKIE|${city === "warszawa" ? "Warszawa" : city}`);
  url.searchParams.set("PriceTotalPLNFrom", "900000");
  url.searchParams.set("PriceTotalPLNTo", "2000000");
  url.searchParams.set("AreaFrom", "56");
  url.searchParams.set("PrimaryMarket", "2");
  url.searchParams.set("RoomsCountFrom", "3");
  url.searchParams.set("Page", String(page));
  return url.toString();
}

function externalIdFromUrl(url: string) {
  const numeric = url.match(/(?:[?&](?:id|offerid)=|\/(\d+)(?:$|[/?#]))/i)?.[1];
  return `maxon-${numeric ?? createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

function resolveExternalId(fallbackExternalId: string, html: string) {
  if (/^maxon-\d+$/.test(fallbackExternalId)) return fallbackExternalId;
  const offerId = html.match(/(?:data-offer-id|"OfferId")\s*[=:]\s*["']?(\d+)/i)?.[1]
    ?? html.match(/class=["'][^"']*btn_show_phone[^"']*["'][^>]*data-id=["'](\d+)/i)?.[1];
  return offerId ? `maxon-${offerId}` : fallbackExternalId;
}

function extractReferences(html: string) {
  const references: SourceListingReference[] = [];
  // Maxon renders result cards from embedded JSON, so there are no populated href values in the initial HTML.
  for (const match of html.matchAll(/"OfferId"\s*:\s*(\d+)[\s\S]{0,3000}?"URL"\s*:\s*"([^"]+)"/gi)) {
    const url = new URL(match[2].replace(/\\\//g, "/"), "https://www.maxon.pl").toString();
    references.push({ externalId: `maxon-${match[1]}`, url });
  }
  return references;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

async function fetchStaticPage(url: string) {
  const html = await fetchHtml(url);
  return { html, text: html.replace(/<[^>]+>/g, " ") };
}

async function fetchRenderedPage(url: string, options?: { mode?: "full" | "price_only" }) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}: ${url}`);
    for (const consent of ["Akceptuj", "Zgadzam się", "Tylko niezbędne"]) {
      const button = page.getByRole("button", { name: new RegExp(consent, "i") }).first();
      if (await button.count()) { await button.click({ timeout: 1500 }).catch(() => undefined); break; }
    }
    if (options?.mode !== "price_only") {
      const galleryLink = page.locator(".item.slick-slide a[href*='cdn.maxon.pl/Photos/']").first();
      if (await galleryLink.count()) {
        await galleryLink.click({ timeout: 2500 }).catch(() => undefined);
        await page.waitForTimeout(250);
      }
    }
    await page.waitForTimeout(options?.mode === "price_only" ? 100 : 400);
    return { html: await page.content(), text: await page.locator("body").innerText() };
  } finally {
    await browser.close();
  }
}

function parseListing(url: string, html: string, visibleText: string, externalId: string): ParsedListing {
  const title = firstText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || meta(html, "og:title") || "Oferta Maxon";
  const description = firstText(html, /<div[^>]+class=["'][^"']*description_cnt[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const address = firstText(html, /<[^>]+class=["'][^"']*(?:address|location)[^"']*["'][^>]*>([\s\S]*?)<\//i) ?? "Warszawa";
  const details = {
    area: amount(labeledValue(visibleText, "Powierzchnia")),
    rooms: amount(labeledValue(visibleText, "Liczba pokoi")),
    price: jsonLdOfferPrice(html) ?? amount(labeledValue(visibleText, "Cena")) ?? amount(meta(html, "product:price:amount")),
    fee: amount(labeledValue(visibleText, "Czynsz")),
    floor: labeledValue(visibleText, "Piętro")
  };
  const floor = parseFloor(details.floor);
  const phone = html.match(/href=["']tel:([^"']+)["']/i)?.[1]?.replace(/[^0-9+]/g, "");
  const publishedAt = firstValidPublishedAt(
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"dateCreated"\s*:\s*"([^"]+)"/i)?.[1],
    meta(html, "article:published_time"),
    meta(html, "datePublished")
  );
  const location = [title, address, description].join(" ");
  const district = location.match(/(?:Mokotów|Wilanów|Wola|Ursynów|Żoliborz|Bemowo|Ochota|Bielany|Włochy|Praga-Północ|Praga-Południe|Śródmieście)/i)?.[0];
  const images = extractImages(html);
  return {
    externalId,
    canonicalUrl: url,
    title: strip(title),
    description: description || undefined,
    city: "Warszawa",
    district,
    addressText: strip(address),
    sourceContactPhone: phone,
    priceAmount: details.price,
    areaSqm: details.area,
    rooms: details.rooms,
    floor: floor.floor,
    totalFloors: floor.totalFloors,
    publishedAt: publishedAt ?? undefined,
    marketType: /Rynek:\s*wtórny/i.test(visibleText) ? "secondary" : "primary",
    offerType: "sale",
    status: /og[łl]oszenie archiwalne/i.test(`${title} ${description} ${visibleText}`) ? "removed" : "active",
    images: images.map((sourceUrl, position) => ({ sourceUrl, position, isPrimary: position === 0 })),
    rawPayload: { url, portalFeatures: details.fee ? { fees: `${new Intl.NumberFormat("pl-PL").format(details.fee)} PLN` } : undefined }
  };
}

function labeledValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`${escaped}\\s*:\\s*([\\s\\S]{0,80}?)(?=\\n(?:[A-ZĄĆĘŁŃÓŚŹŻ][^\\n]{0,40}:)|$)`, "i"))?.[1]?.trim();
}

function parseFloor(value?: string) {
  if (!value) return {};
  if (/parter/i.test(value)) return { floor: 0 };
  const values = value.match(/\d+/g)?.map(Number) ?? [];
  return { floor: values[0], totalFloors: values[1] };
}

function extractImages(html: string) {
  const images = Array.from(html.matchAll(/(?:src|href)=["'](https:\/\/cdn\.maxon\.pl\/Photos\/[^"']+\/wwwxl\/[^"']+\.(?:jpg|jpeg|webp|png))["']/gi)).map((match) => match[1]);
  return Array.from(new Set(images));
}

function jsonLdOfferPrice(html: string) {
  const rawPrice = html.match(/"offers"\s*:\s*\{[\s\S]{0,500}?"price"\s*:\s*"?([0-9][0-9\s,.]*)"?/i)?.[1];
  const parsedRawPrice = amount(rawPrice);
  if (parsedRawPrice) return parsedRawPrice;

  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>;
      const offers = data.offers as Record<string, unknown> | undefined;
      const price = offers?.price;
      if (typeof price === "number") return price;
      if (typeof price === "string") return amount(price);
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks.
    }
  }
  return undefined;
}

function firstValidPublishedAt(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value?.trim()) continue;
    const date = new Date(value.trim());
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function firstText(html: string, expression: RegExp) { return strip(html.match(expression)?.[1] ?? ""); }
function meta(html: string, key: string) { return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)`, "i"))?.[1]; }
function amount(value?: string) { const parsed = Number((value ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, "")); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; }
function strip(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)));
}

const requestHeaders = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "pl-PL,pl;q=0.9",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
};
