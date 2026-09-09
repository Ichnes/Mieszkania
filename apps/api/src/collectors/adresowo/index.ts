import { createDefaultSearchContract, type SearchContract } from "@mieszkania/shared";
import { adresowoWarsawDistrictIds } from "../location-groups";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { withDb } from "../../db";
import { archiveOfferArtifacts } from "../../services/archive/offer-archive";
import {
  claimListingImportBatch,
  completeListingImport,
  enqueueListingImports,
  failListingImport,
  getKnownListingExternalIds,
  getListingImportQueueStatus,
  retryFailedListingImportsNow,
} from "../../services/collecting/listing-import-queue";
import { geocodeListing } from "../../services/geography/geocoding";
import { downloadListingMedia } from "../../services/media/media-downloader";
import { getFamilySettings } from "../../services/settings/family-settings";
import { OtodomStorage } from "../otodom/otodom-storage";
import type { ParsedListing, SourceListingReference } from "../types";

const sourceKey = "adresowo";

export class AdresowoCollector {
  private readonly storage = new OtodomStorage();

  async collectOne(
    url: string,
    options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean },
  ) {
    return this.collect(url, externalIdFromUrl(url), options);
  }

  async discoverAll(input: {
    city: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    priority?: number;
  }) {
    const settings = await getFamilySettings();
    const city = input.city.trim().toLowerCase() || settings.searchContract.city.toLowerCase();
    const startPage = Math.max(1, input.startPage ?? 1);
    const maxPages = Math.max(1, Math.min(500, input.maxPages ?? 250));
    const batchPages = Math.max(1, Math.min(20, input.batchPages ?? 5));
    let queued = 0,
      discovered = 0,
      scannedPages = 0,
      currentPage = startPage;
    let error: string | undefined;
    while (scannedPages < maxPages) {
      const pages = Math.min(batchPages, maxPages - scannedPages);
      try {
        const links = await this.discover(city, currentPage, pages);
        const result = await enqueueListingImports({
          sourceKey,
          city,
          priority: input.priority ?? 100,
          items: links,
        });
        queued += result.queued;
        discovered += links.length;
        scannedPages += pages;
        currentPage += pages;
        if (links.length === 0) break;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Adresowo discovery failed";
        break;
      }
    }
    return {
      city,
      startPage,
      scannedPages,
      discovered,
      queued,
      stoppedBecause: error ? "error" : scannedPages >= maxPages ? "max_pages" : "empty_batches",
      error,
    };
  }

  async processQueue(input?: {
    limit?: number;
    concurrency?: number;
    queueKind?: "all" | "price_updates";
  }) {
    const claimed = await claimListingImportBatch({
      sourceKey,
      limit: Math.max(1, Math.min(500, input?.limit ?? 100)),
      queueKind: input?.queueKind,
    });
    const known = await getKnownListingExternalIds({
      sourceKey,
      externalIds: claimed.map((item) => item.external_id),
    });
    // Adresowo throttles bursts aggressively. Two parallel detail requests are
    // faster in practice than four workers repeatedly landing in `fetch failed`.
    const concurrency = Math.max(1, Math.min(2, input?.concurrency ?? 2));
    let completed = 0,
      failed = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];
    for (let offset = 0; offset < claimed.length; offset += concurrency) {
      const batch = claimed.slice(offset, offset + concurrency);
      const results = await Promise.allSettled(
        batch.map((item) => {
          const priceOnly = known.has(item.external_id);
          return this.collect(item.canonical_url, item.external_id, {
            refreshMode: priceOnly ? "price_only" : "full",
            downloadMedia: !priceOnly,
          });
        }),
      );
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index],
          item = batch[index];
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

  async getQueueStatus() {
    return getListingImportQueueStatus(sourceKey);
  }
  async retryFailed(limit?: number) {
    return retryFailedListingImportsNow({ sourceKey, limit });
  }

  /** Queues existing Adresowo offers for a static refresh of their portal publication date. */
  async refreshPublishedDates(limit = 5_000) {
    return withDb(async (db) => {
      const result = await db.query<{ id: string }>(
        `
          with picked as (
            select q.id
            from listing_import_queue q
            join sources s on s.key = q.source_key
            join listings l on l.source_id = s.id and l.external_id = q.external_id
            where q.source_key = $1
              and l.published_at is null
              and l.status = 'active'
            order by l.first_seen_at asc
            limit $2
          )
          update listing_import_queue q
          set status = 'pending', next_attempt_at = now(), started_at = null,
              last_error = null,
              payload_raw = q.payload_raw || jsonb_build_object('publishedDateBackfillAt', now())
          from picked
          where q.id = picked.id
          returning q.id
        `,
        [sourceKey, Math.max(1, Math.min(10_000, limit))],
      );
      return { queued: result.rows.length };
    });
  }

  private async discover(city: string, startPage: number, pages: number) {
    const items: SourceListingReference[] = [];
    for (let offset = 0; offset < pages; offset += 1) {
      const html = await fetchHtml(
        buildSearchUrl(city, startPage + offset, (await getFamilySettings()).searchContract),
      );
      for (const match of html.matchAll(
        /href=["'](\/o\/mieszkanie-[^"'?#]+-([a-z]\d[a-z]\d[a-z]\d))["']/gi,
      )) {
        const url = new URL(match[1], "https://adresowo.pl").toString();
        items.push({ externalId: `adresowo-${match[2].toLowerCase()}`, url });
      }
    }
    return Array.from(new Map(items.map((item) => [item.externalId, item])).values());
  }

  private async collect(
    url: string,
    externalId: string,
    options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean },
  ) {
    const full = options?.refreshMode !== "price_only";
    let page;
    if (full) {
      page = await fetchRenderedPage(url);
    } else {
      try {
        page = await fetchStaticPage(url);
      } catch {
        page = await fetchRenderedPage(url);
      }
    }
    const parsed = parseListing(url, page.html, page.text, externalId);
    if (!parsed.priceAmount && parsed.status !== "removed")
      throw new Error(`MISSING_PRICE: ${externalId} (${url})`);
    if (full && (!parsed.latitude || !parsed.longitude)) {
      const point = await geocodeListing({
        city: parsed.city,
        district: parsed.district,
        neighborhood: parsed.neighborhood,
        street: parsed.street,
        addressText: parsed.addressText,
      });
      if (point) Object.assign(parsed, point);
    }
    const archived = full
      ? await archiveOfferArtifacts({
          sourceKey,
          externalId: parsed.externalId,
          timestamp: new Date().toISOString(),
          html: page.html,
          parsed,
        })
      : null;
    const stored = await this.storage.upsertListingSnapshot({
      sourceKey,
      listing: parsed,
      refreshMode: options?.refreshMode,
      rawArtifact: {
        type: full ? "html" : "json",
        storageKey:
          archived?.rawStorageKey ??
          `sources/${sourceKey}/${parsed.externalId}/price/${Date.now()}.json`,
        payload: full
          ? {
              url,
              checksum: archived?.rawChecksum,
              parsedStorageKey: archived?.parsedStorageKey,
              encoding: archived?.encoding,
            }
          : { url, priceAmount: parsed.priceAmount },
      },
    });
    if (options?.downloadMedia !== false) await downloadListingMedia(stored.mediaAssets);
    return stored;
  }
}

export function buildSearchUrl(
  city: string,
  page: number,
  contract: SearchContract = createDefaultSearchContract(),
) {
  const normalized = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  // Adresowo encodes result pages in the filter path: lod (page 1), l2od,
  // l3od, … rather than in a query string.
  const pageSegment = page === 1 ? "lod" : `l${page}od`;
  const roomCodes = Array.from(
    { length: Math.max(0, 7 - contract.roomsMin) },
    (_, index) => `p${contract.roomsMin + index}`,
  ).join("");
  const searchPathPrefix = `a${contract.minArea}_f${roomCodes}uz`;
  const searchPathSuffix = `p${Math.floor(contract.minPrice / 10000)}-${Math.ceil(contract.maxPrice / 10000)}`;
  const ids = [...new Set(contract.districts ?? [])].map((district) => {
    if (normalized !== "warszawa" || !adresowoWarsawDistrictIds[district])
      throw new Error(`Brak identyfikatora dzielnicy Adresowo: ${district}`);
    return adresowoWarsawDistrictIds[district];
  });
  // Gocław is a separate search location on Adresowo, inside Praga-Południe.
  if (contract.districts?.includes("Praga-Południe")) ids.push("430518");
  return `https://adresowo.pl/f/mieszkania/${normalized}/${ids.length ? `${ids.join("_")}/` : ""}${searchPathPrefix}_${pageSegment}_${searchPathSuffix}`;
}

function externalIdFromUrl(url: string) {
  const id = url.match(/-([a-z]\d[a-z]\d[a-z]\d)(?:$|[?#])/i)?.[1]?.toLowerCase();
  return `adresowo-${id ?? createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

async function fetchHtml(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: requestHeaders,
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response.text();
    } catch (error) {
      if (error instanceof TypeError && error.message === "fetch failed") {
        return fetchTrustedAdresowoPage(url);
      }
      lastError = error;
      if (attempt < 3) await delay(attempt * 900);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Adresowo fetch failed: ${url}`);
}

function fetchTrustedAdresowoPage(url: string, redirectsLeft = 4): Promise<string> {
  const target = new URL(url);
  if (target.hostname !== "adresowo.pl" && !target.hostname.endsWith(".adresowo.pl")) {
    return Promise.reject(
      new Error(`Refusing TLS fallback for untrusted Adresowo host ${target.hostname}`),
    );
  }
  return new Promise((resolvePage, rejectPage) => {
    const request = httpsRequest(
      url,
      { method: "GET", headers: requestHeaders, rejectUnauthorized: false, timeout: 45_000 },
      (response) => {
        const status = response.statusCode ?? 500;
        const location = response.headers.location;
        if (location && status >= 300 && status < 400 && redirectsLeft > 0) {
          response.resume();
          const redirectedUrl = new URL(location, url);
          if (
            redirectedUrl.hostname !== "adresowo.pl" &&
            !redirectedUrl.hostname.endsWith(".adresowo.pl")
          ) {
            rejectPage(
              new Error(`Refusing untrusted Adresowo redirect to ${redirectedUrl.hostname}`),
            );
            return;
          }
          void fetchTrustedAdresowoPage(redirectedUrl.toString(), redirectsLeft - 1).then(
            resolvePage,
            rejectPage,
          );
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          rejectPage(new Error(`HTTP ${status}: ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => resolvePage(Buffer.concat(chunks).toString("utf8")));
      },
    );
    request.on("timeout", () =>
      request.destroy(new Error(`Adresowo request timed out for ${url}`)),
    );
    request.on("error", rejectPage);
    request.end();
  });
}

async function fetchStaticPage(url: string) {
  const html = await fetchHtml(url);
  return { html, text: strip(html) };
}

async function fetchRenderedPage(url: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}: ${url}`);
    for (const name of ["Tylko niezbędne", "Akceptuj"]) {
      const button = page.getByRole("button", { name: new RegExp(name, "i") }).first();
      if (await button.count()) {
        await button.click({ timeout: 1_500 }).catch(() => undefined);
        break;
      }
    }
    // The initial page carries only the cover. Opening this exact showcase
    // renders all slides belonging to the current offer.
    const gallery = page
      .locator(
        "button[data-track='offer-gallery-more-images'], button[data-track='offer-gallery-show-all'], button[onclick*='showcase.image.show']",
      )
      .first();
    if (await gallery.count()) {
      await gallery.click({ timeout: 4_000, force: true }).catch(() => undefined);
      await page
        .locator(".swiper-container-showcase .swiper-slide img")
        .first()
        .waitFor({ state: "attached", timeout: 4_000 })
        .catch(() => undefined);
      await page.waitForTimeout(350);
    }
    const description = page.locator("#showMore").first();
    if (await description.count()) {
      await description.click({ timeout: 4_000, force: true }).catch(() => undefined);
      await page.waitForTimeout(150);
    }
    return { html: await page.content(), text: await page.locator("body").innerText() };
  } finally {
    await browser.close();
  }
}

function parseListing(
  url: string,
  html: string,
  visibleText: string,
  externalId: string,
): ParsedListing {
  const json = jsonLd(html);
  const offer = json.find((node) => typeIncludes(node, "Offer"));
  const place = json.find((node) => typeIncludes(node, "Place"));
  const extractedDescription = strip(
    html.match(/<p[^>]+id=["']description["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
      string(place?.description) ??
      "",
  );
  const title = strip(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? meta(html, "og:title") ?? "Oferta Adresowo",
  );
  const isOwnerListing =
    /bezpośrednio\s+od\s+właściciela|bez\s+pośrednik(?:a|ów)|sprzedaż\s+bezpośrednia/i.test(
      `${title} ${extractedDescription} ${visibleText}`,
    );
  // The shared commercial-info classifier reads the description. Preserve the
  // portal's owner label there so an owner offer is never shown as an agency.
  const description =
    isOwnerListing && !/bezpośrednio\s+od\s+właściciela/i.test(extractedDescription)
      ? `${extractedDescription}\n\nBezpośrednio od właściciela.`.trim()
      : extractedDescription;
  const text = `${title} ${description} ${visibleText}`;
  const address = string(record(place?.address)?.streetAddress) ?? "Warszawa";
  const geo = record(place?.geo);
  const area = amount(
    title.match(/([\d,.]+)\s*m(?:²|2)/i)?.[1] ??
      text.match(/powierzchni\s+([\d,.]+)\s*m(?:²|2)/i)?.[1],
  );
  const rooms = amount(title.match(/(\d+)\s*-?pokoj/i)?.[1] ?? text.match(/(\d+)\s+pokoje/i)?.[1]);
  const floor = amount(text.match(/(\d+)\.?\s*piętro/i)?.[1]);
  const yearBuilt = extractAdresowoConstructionYear(html, visibleText);
  const publishedAt = extractRelativePublishedAt(visibleText);
  const district = text.match(
    /(?:Mokotów|Wilanów|Wola|Ursynów|Żoliborz|Bemowo|Ochota|Bielany|Włochy|Praga-Północ|Praga-Południe|Śródmieście|Targówek|Białołęka|Wawer)/i,
  )?.[0];
  const phone = visibleText
    .match(/\b(?:\+48\s*)?(\d{3}[\s-]?\d{3}[\s-]?\d{3})\b/)?.[1]
    ?.replace(/[\s-]/g, "");
  const images = extractShowcaseImages(html);
  const normalizedImages = Array.from(
    new Map(images.map((value) => [value.replace(/_xbig(?=-)/i, ""), value])).values(),
  );
  return {
    externalId,
    canonicalUrl: url,
    title,
    description: description || undefined,
    city: "Warszawa",
    district,
    addressText: address,
    latitude: amount(string(geo?.latitude)),
    longitude: amount(string(geo?.longitude)),
    sourceContactPhone: phone,
    priceAmount: amount(string(offer?.price) ?? text.match(/([\d\s.]+)\s*zł/i)?.[1]),
    areaSqm: area,
    rooms,
    floor,
    yearBuilt,
    publishedAt,
    marketType: /deweloper|rynek pierwotny/i.test(text) ? "primary" : "secondary",
    offerType: "sale",
    status: /ogłoszenie (?:jest )?nieaktualne|oferta nieaktualna/i.test(text)
      ? "removed"
      : "active",
    images: normalizedImages.map((sourceUrl, position) => ({
      sourceUrl,
      position,
      isPrimary: position === 0,
    })),
    rawPayload: {
      url,
      jsonLd: json,
      yearBuilt,
      advertiserType: isOwnerListing ? "private" : undefined,
    },
  };
}

export function extractAdresowoConstructionYear(html: string, visibleText = "") {
  const fromCurrentSummary = html.match(
    /rok\s+budowy(?:\s|&nbsp;|&#160;)*:?(?:\s|&nbsp;|&#160;)*((?:18|19|20)\d{2})/i,
  )?.[1];
  const fromAttributeBox = html.match(
    /box__attributes--content[\s\S]{0,500}?Rok\s+budowy\s*:[\s\S]{0,220}?class=["'][^"']*fsize-a[^"']*["'][^>]*>\s*((?:18|19|20)\d{2})\s*</i,
  )?.[1];
  const fromText = visibleText.match(/Rok\s+budowy\s*:?\s*((?:18|19|20)\d{2})/i)?.[1];
  const parsed = Number(fromCurrentSummary ?? fromAttributeBox ?? fromText);
  return Number.isInteger(parsed) && parsed >= 1800 && parsed <= new Date().getFullYear() + 5
    ? parsed
    : undefined;
}

function extractShowcaseImages(html: string) {
  const showcaseStart = html.search(
    /<div[^>]*class=["'][^"']*\bswiper-container-showcase\b[^"']*["'][^>]*>/i,
  );
  const similarOffersStart = html.search(/<div[^>]*id=["']similar-offers["'][^>]*>/i);
  const paginationOffset =
    showcaseStart >= 0
      ? html
          .slice(showcaseStart)
          .search(/<div[^>]*class=["'][^"']*\bswiper-pagination\b[^"']*["'][^>]*>/i)
      : -1;
  const paginationStart = paginationOffset > 0 ? showcaseStart + paginationOffset : -1;
  const safeEnds = [paginationStart, similarOffersStart].filter(
    (position) => position > showcaseStart,
  );
  // If the showcase cannot be bounded safely, keep only og:image. Never scan
  // the remainder of the document, where Adresowo renders similar offers.
  const showcaseEnd = safeEnds.length > 0 ? Math.min(...safeEnds) : -1;
  const showcaseHtml =
    showcaseStart >= 0 && showcaseEnd > showcaseStart ? html.slice(showcaseStart, showcaseEnd) : "";
  const galleryImages = Array.from(
    showcaseHtml.matchAll(/https:\/\/s\d+\.adresowa\.pl\/oi\/[^"'\s<>]+\.(?:jpg|jpeg|webp|png)/gi),
    (match) => match[0],
  );
  const coverImage = meta(html, "og:image");
  return [...(coverImage?.includes(".adresowa.pl/oi/") ? [coverImage] : []), ...galleryImages]
    .map((value) => value.replace(/&amp;/g, "&").split("?")[0])
    .map((value) => value.replace(/_(?:small|big|cover)(?:@2x)?(?=-)/i, "_xbig"));
}

function extractRelativePublishedAt(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const match = normalized.match(
    /dodana\s+(?:ponad\s+)?(?:(\d+)\s+)?(minut\w*|godzin\w*|dni?\w*|tygodni\w*|miesiac\w*|lat\w*)\s+temu/,
  );
  if (!match) return undefined;
  const quantity = Number(match[1] ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return undefined;
  const unit = match[2];
  const milliseconds = unit.startsWith("minut")
    ? quantity * 60_000
    : unit.startsWith("godzin")
      ? quantity * 3_600_000
      : /^(?:dzien|dni)/.test(unit)
        ? quantity * 86_400_000
        : unit.startsWith("tygod")
          ? quantity * 7 * 86_400_000
          : // Adresowo gives relative, rounded text. For ranking, treat a month
            // as four weeks from the moment this offer was fetched.
            unit.startsWith("miesiac")
            ? quantity * 28 * 86_400_000
            : quantity * 365 * 86_400_000;
  return new Date(Date.now() - milliseconds).toISOString();
}

function jsonLd(html: string) {
  return Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ).flatMap((match) => {
    try {
      const value = JSON.parse(match[1]) as Record<string, unknown>;
      const graph = value["@graph"];
      return Array.isArray(graph)
        ? graph.filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === "object",
          )
        : [value];
    } catch {
      return [];
    }
  });
}
function typeIncludes(value: Record<string, unknown>, type: string) {
  const candidate = value["@type"];
  return Array.isArray(candidate) ? candidate.includes(type) : candidate === type;
}
function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function string(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}
function meta(html: string, key: string) {
  return html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)`, "i"),
  )?.[1];
}
function amount(value?: string) {
  const parsed = Number(
    (value ?? "")
      .replace(/\s/g, "")
      .replace(",", ".")
      .replace(/[^0-9.]/g, ""),
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function strip(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
const requestHeaders = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "pl-PL,pl;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};
