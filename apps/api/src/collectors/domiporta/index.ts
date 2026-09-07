import { request as httpsRequest } from "node:https";

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
import { fetchRenderedPage, parseListing } from "../nieruchomosci-online";
import { OtodomStorage } from "../otodom/otodom-storage";
import type { SourceListingReference } from "../types";

const sourceKey = "domiporta";
const maxQueueConcurrency = 8;
const requestHeaders = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "pl-PL,pl;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

export class DomiportaCollector {
  private readonly storage = new OtodomStorage();

  async collectOne(
    url: string,
    options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean },
  ) {
    const match = url.match(/\/(\d+)(?:$|[?#])/);
    return this.collect(
      url,
      `domiporta-${match?.[1] ?? Buffer.from(url).toString("base64url").slice(0, 16)}`,
      options,
    );
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
      currentPage = startPage,
      emptyBatches = 0;
    let error: string | undefined;
    while (scannedPages < maxPages) {
      try {
        const links = await this.discover(
          city,
          currentPage,
          Math.min(batchPages, maxPages - scannedPages),
        );
        const result = await enqueueListingImports({
          sourceKey,
          city,
          priority: input.priority ?? 100,
          items: links,
        });
        queued += result.queued;
        discovered += links.length;
        scannedPages += Math.min(batchPages, maxPages - scannedPages);
        currentPage += batchPages;
        emptyBatches = links.length === 0 ? emptyBatches + 1 : 0;
        // Domiporta intermittently serves an empty result page. Do not stop a long scan on one such response.
        if (emptyBatches >= 3) break;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Domiporta discovery failed";
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
    const knownExternalIds = await getKnownListingExternalIds({
      sourceKey,
      externalIds: claimed.map((item) => item.external_id),
    });
    const concurrency = Math.max(
      1,
      Math.min(maxQueueConcurrency, input?.concurrency ?? maxQueueConcurrency),
    );
    let completed = 0,
      failed = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];
    for (let offset = 0; offset < claimed.length; offset += concurrency) {
      const batch = claimed.slice(offset, offset + concurrency);
      const results = await Promise.allSettled(
        batch.map((item) => {
          const priceOnly = knownExternalIds.has(item.external_id);
          return this.collect(item.canonical_url, item.external_id, {
            refreshMode: priceOnly ? "price_only" : "full",
            downloadMedia: priceOnly ? false : true,
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

  private async discover(city: string, startPage: number, pages: number) {
    const all: SourceListingReference[] = [];
    for (let offset = 0; offset < pages; offset += 1) {
      const url = new URL(`https://www.domiporta.pl/mieszkanie/sprzedam/mazowieckie/${city}`);
      url.searchParams.set("Price.From", "900000");
      url.searchParams.set("Price.To", "2000000");
      url.searchParams.set("Rooms.From", "3");
      url.searchParams.set("Rynek", "Wtorny");
      if (startPage + offset > 1) {
        const page = String(startPage + offset);
        url.searchParams.set("PageNumber", page);
      }
      const html = await fetchHtml(url.toString());
      for (const match of html.matchAll(
        /(?:href|data-href)=["']([^"']*\/(?:nieruchomosci|mieszkanie)\/[^"']*\/(\d+)(?:[?#][^"']*)?)["']/gi,
      )) {
        all.push({
          externalId: `domiporta-${match[2]}`,
          url: new URL(match[1], "https://www.domiporta.pl").toString(),
        });
      }
    }
    return Array.from(new Map(all.map((item) => [item.externalId, item])).values());
  }

  private async collect(
    url: string,
    externalId: string,
    options?: { refreshMode?: "full" | "price_only"; downloadMedia?: boolean },
  ) {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    let rendered = isPriceOnlyRefresh
      ? await fetchStaticPage(url)
      : await fetchRenderedPage(url, ["Rozwiń", "Pokaż telefon", "Zobacz galerię"]);
    let parsed = parseListing(url, rendered.html, externalId, rendered.text, rendered.description);
    if (isPriceOnlyRefresh && !parsed.priceAmount) {
      rendered = await fetchRenderedPage(url, ["Rozwiń", "Pokaż telefon", "Zobacz galerię"], {
        mode: "price_only",
      });
      parsed = parseListing(url, rendered.html, externalId, rendered.text, rendered.description);
    }
    if (!parsed.priceAmount && parsed.status !== "removed")
      throw new Error(`MISSING_PRICE: ${parsed.externalId} (${url})`);
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
          html: rendered.html,
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

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.text();
  } catch (error) {
    const hostname = new URL(url).hostname;
    if (
      error instanceof TypeError &&
      error.message === "fetch failed" &&
      isDomiportaHost(hostname)
    ) {
      return fetchTrustedDomiportaPage(url);
    }
    throw error;
  }
}

async function fetchStaticPage(url: string) {
  const html = await fetchHtml(url);
  return { html, text: html.replace(/<[^>]+>/g, " "), description: "" };
}

function fetchTrustedDomiportaPage(url: string, redirectsLeft = 4): Promise<string> {
  const target = new URL(url);
  if (!isDomiportaHost(target.hostname)) {
    return Promise.reject(
      new Error(`Refusing Domiporta fallback for untrusted host ${target.hostname}`),
    );
  }

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      target,
      {
        method: "GET",
        headers: requestHeaders,
        rejectUnauthorized: false,
        timeout: 45_000,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location && redirectsLeft > 0) {
          response.resume();
          const redirectedUrl = new URL(location, target);
          if (!isDomiportaHost(redirectedUrl.hostname)) {
            reject(
              new Error(`Refusing Domiporta redirect to untrusted host ${redirectedUrl.hostname}`),
            );
            return;
          }
          void fetchTrustedDomiportaPage(redirectedUrl.toString(), redirectsLeft - 1).then(
            resolve,
            reject,
          );
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode}: ${url}`));
          return;
        }
        response.setEncoding("utf8");
        let html = "";
        response.on("data", (chunk: string) => {
          html += chunk;
        });
        response.on("end", () => resolve(html));
      },
    );
    request.on("timeout", () => request.destroy(new Error(`Timeout while fetching ${url}`)));
    request.on("error", reject);
    request.end();
  });
}

function isDomiportaHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "domiporta.pl" || normalized.endsWith(".domiporta.pl");
}
