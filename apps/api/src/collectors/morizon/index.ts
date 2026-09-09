import { request as httpsRequest } from "node:https";
import { discoverLocationGroups } from "../grouped-discovery";
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
import {
  buildMorizonSearchUrl,
  externalIdFromMorizonUrl,
  extractMorizonReferences,
  parseMorizonListing,
} from "./morizon-parser";

const sourceKey = "morizon";
const maxQueueConcurrency = 4;

export class MorizonCollector {
  private readonly storage = new OtodomStorage();

  async collectOne(
    url: string,
    options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean },
  ) {
    return this.collect(url, externalIdFromMorizonUrl(url), options);
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
    return discoverLocationGroups({
      city,
      contract: settings.searchContract,
      startPage,
      maxPages,
      fetchReferences: async (page, contract) =>
        extractMorizonReferences(
          await fetchMorizonHtml(buildMorizonSearchUrl(city, page, contract)),
        ),
      enqueue: (items) =>
        enqueueListingImports({ sourceKey, city, priority: input.priority ?? 100, items }),
    });
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
    const knownExternalIds = await getKnownListingExternalIds({
      sourceKey,
      externalIds: claimed.map((item) => item.external_id),
    });
    const concurrency = Math.max(
      1,
      Math.min(maxQueueConcurrency, input?.concurrency ?? maxQueueConcurrency),
    );
    let completed = 0;
    let failed = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];

    for (let offset = 0; offset < claimed.length; offset += concurrency) {
      const batch = claimed.slice(offset, offset + concurrency);
      const results = await Promise.allSettled(
        batch.map((item) => {
          const priceOnly = knownExternalIds.has(item.external_id);
          return this.collect(item.canonical_url, item.external_id, {
            refreshMode: priceOnly ? "price_only" : "full",
            downloadMedia: !priceOnly,
          });
        }),
      );

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const item = batch[index];
        if (result.status === "fulfilled") {
          completed += 1;
          await completeListingImport(item.id);
        } else {
          failed += 1;
          const errorMessage =
            result.reason instanceof Error ? result.reason.message : "unknown error";
          failures.push({
            externalId: item.external_id,
            url: item.canonical_url,
            error: errorMessage,
          });
          await failListingImport({
            id: item.id,
            error: errorMessage,
            attempts: item.attempts + 1,
          });
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

  private async collect(
    url: string,
    externalId: string,
    options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean },
  ) {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    let document = isPriceOnlyRefresh
      ? await fetchStaticPage(url)
      : await fetchRenderedMorizonPage(url);
    let parsed = parseMorizonListing(url, document.html, document.text);

    if (parsed.externalId !== externalId) {
      throw new Error(
        `MORIZON_ID_MISMATCH: expected ${externalId}, received ${parsed.externalId} (${url})`,
      );
    }
    if (isPriceOnlyRefresh && !parsed.priceAmount) {
      document = await fetchRenderedMorizonPage(url, { mode: "price_only" });
      parsed = parseMorizonListing(url, document.html, document.text);
    }
    if (!parsed.priceAmount && parsed.status !== "removed") {
      throw new Error(`MISSING_PRICE: ${parsed.externalId} (${url})`);
    }
    if (!isPriceOnlyRefresh && (!parsed.latitude || !parsed.longitude)) {
      const point = await geocodeListing({
        city: parsed.city,
        district: parsed.district,
        neighborhood: parsed.neighborhood,
        street: parsed.street,
        addressText: parsed.addressText,
      });
      if (point) Object.assign(parsed, point);
    }

    const archived = isPriceOnlyRefresh
      ? null
      : await archiveOfferArtifacts({
          sourceKey,
          externalId: parsed.externalId,
          timestamp: new Date().toISOString(),
          html: document.html,
          parsed,
        });
    const stored = await this.storage.upsertListingSnapshot({
      sourceKey,
      listing: parsed,
      refreshMode: options?.refreshMode,
      rawArtifact: {
        type: isPriceOnlyRefresh ? "json" : "html",
        storageKey:
          archived?.rawStorageKey ??
          `sources/${sourceKey}/${parsed.externalId}/price/${Date.now()}.json`,
        payload: isPriceOnlyRefresh
          ? { url, priceAmount: parsed.priceAmount }
          : {
              url,
              checksum: archived?.rawChecksum,
              parsedStorageKey: archived?.parsedStorageKey,
              encoding: archived?.encoding,
            },
      },
    });
    if (options?.downloadMedia !== false) await downloadListingMedia(stored.mediaAssets);
    return stored;
  }
}

export async function fetchMorizonHtml(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: requestHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) {
      if (isCertificateError(error) && isMorizonPageHost(new URL(url).hostname)) {
        return fetchTrustedMorizonPage(url);
      }
      lastError = error;
      if (attempt < 3) await delay(attempt * 800);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Morizon fetch failed: ${url}`);
}

function isMorizonNotFound(error: unknown) {
  return error instanceof Error && /^HTTP 404(?:\s|:)/i.test(error.message);
}

async function fetchStaticPage(url: string) {
  const html = await fetchMorizonHtml(url);
  return { html, text: html.replace(/<[^>]+>/g, " ") };
}

export async function fetchRenderedMorizonPage(
  url: string,
  options?: { mode?: "full" | "price_only" },
) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ locale: "pl-PL", ignoreHTTPSErrors: true });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 75_000 });
    if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}: ${url}`);
    await page
      .locator("h1")
      .first()
      .waitFor({ state: "attached", timeout: 15_000 })
      .catch(() => undefined);

    if (options?.mode !== "price_only") {
      for (const label of [/Akceptuj/i, /Zgadzam się/i, /Tylko niezbędne/i]) {
        const consent = page.getByRole("button", { name: label }).first();
        if (await consent.count()) {
          await consent.click({ timeout: 2_000 }).catch(() => undefined);
          break;
        }
      }

      const showDescription = page.getByRole("button", { name: /Pokaż cały opis/i }).first();
      if (await showDescription.count()) {
        await showDescription.click({ timeout: 4_000, force: true }).catch(() => undefined);
      }

      const showPhone = page.locator('button[data-cy="phoneContactButton"]').first();
      if (await showPhone.count()) {
        await showPhone.click({ timeout: 5_000, force: true }).catch(() => undefined);
        await page
          .locator('[data-cy="phoneContactNumber"]')
          .first()
          .waitFor({ state: "attached", timeout: 5_000 })
          .catch(() => undefined);
      }

      // Opening the full-screen gallery replaces the offer details in the DOM.
      // Preserve the expanded description, tables and revealed phone before that happens,
      // then append the gallery document so the parser can consume both views.
      const detailsHtml = await page.content();
      const detailsText = await page.locator("body").innerText();

      const galleryOpener = page.getByRole("button", { name: /Zobacz \d+ zdjęć/i }).first();
      await galleryOpener.click({ timeout: 10_000, force: true }).catch(async () => {
        await page
          .locator('button[data-cy="detailsGalleryItemPhoto"]')
          .last()
          .click({ timeout: 5_000, force: true })
          .catch(() => undefined);
      });
      const firstGalleryItem = page
        .locator(
          'button.gallery__photos-item[aria-label="Zdjęcie nr 1"], button.gallery__photos-item',
        )
        .first();
      await firstGalleryItem.waitFor({ state: "attached", timeout: 7_000 }).catch(() => undefined);
      if (await firstGalleryItem.count()) {
        await firstGalleryItem.click({ timeout: 5_000, force: true }).catch(() => undefined);
        await page
          .locator("swiper-slide img.slider__item-image")
          .first()
          .waitFor({ state: "attached", timeout: 8_000 })
          .catch(() => undefined);
      }
      await page.waitForTimeout(400);
      const galleryHtml = await page.content();
      const galleryText = await page.locator("body").innerText();
      return { html: `${detailsHtml}\n${galleryHtml}`, text: `${detailsText}\n${galleryText}` };
    }

    return { html: await page.content(), text: await page.locator("body").innerText() };
  } finally {
    await browser.close();
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function fetchTrustedMorizonPage(url: string, redirectsLeft = 4): Promise<string> {
  return new Promise((resolvePage, rejectPage) => {
    const target = new URL(url);
    if (!isMorizonPageHost(target.hostname)) {
      rejectPage(new Error(`Refusing untrusted Morizon page host: ${target.hostname}`));
      return;
    }
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: requestHeaders,
        rejectUnauthorized: false,
        timeout: 60_000,
      },
      (response) => {
        const status = response.statusCode ?? 500;
        const location = response.headers.location;
        if (location && status >= 300 && status < 400 && redirectsLeft > 0) {
          response.resume();
          const redirectedUrl = new URL(location, url);
          if (!isMorizonPageHost(redirectedUrl.hostname)) {
            rejectPage(
              new Error(`Refusing untrusted Morizon redirect to ${redirectedUrl.hostname}`),
            );
            return;
          }
          void fetchTrustedMorizonPage(redirectedUrl.toString(), redirectsLeft - 1).then(
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
    request.on("timeout", () => request.destroy(new Error(`Morizon request timed out for ${url}`)));
    request.on("error", rejectPage);
    request.end();
  });
}

function isMorizonPageHost(hostname: string) {
  return hostname === "morizon.pl" || hostname === "www.morizon.pl";
}

function isCertificateError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  return (
    cause instanceof Error &&
    /certificate|cert_|unable to verify/i.test(
      `${cause.message} ${(cause as NodeJS.ErrnoException).code ?? ""}`,
    )
  );
}

const requestHeaders = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "pl-PL,pl;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
};
