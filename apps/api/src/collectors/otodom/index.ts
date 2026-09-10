import { scanOtodomPages } from "./otodom-scan";
import { randomUUID } from "node:crypto";
import { archiveOfferArtifacts } from "../../services/archive/offer-archive";
import { appendImportFailureLog } from "../../services/collecting/import-failure-log";
import {
  claimListingImportBatch,
  completeListingImport,
  enqueueListingImports,
  failListingImport,
  getKnownListingExternalIds,
  getListingImportQueueStatus,
  retryFailedListingImportsNow,
} from "../../services/collecting/listing-import-queue";
import { geocodeListing, reverseGeocodeListing } from "../../services/geography/geocoding";
import {
  isUnavailableListingDocument,
  markListingArchived,
} from "../../services/listings/listing-archive";
import { purgeInvalidSourceListing } from "../../services/listings/listing-repository";
import { downloadListingMedia } from "../../services/media/media-downloader";
import { getFamilySettings } from "../../services/settings/family-settings";
import { missingPriceError, OtodomMissingPriceError } from "./otodom-diagnostics";
import { OtodomDiscovery } from "./otodom-discovery";
import { OtodomFetcher } from "./otodom-fetcher";
import { OtodomParser } from "./otodom-parser";
import { OtodomStorage } from "./otodom-storage";

export class OtodomCollector {
  private readonly discovery = new OtodomDiscovery();
  private readonly fetcher = new OtodomFetcher();
  private readonly parser = new OtodomParser();
  private readonly storage = new OtodomStorage();

  async collectOne(
    url: string,
    options?: { downloadMedia?: boolean; externalId?: string; refreshMode?: "full" | "price_only" },
  ) {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    const document = await this.fetcher.fetchListing(url);
    if (!isDirectOtodomListingDocument(document.finalUrl ?? document.url)) {
      throw new Error(`NOT_DIRECT_OTODOM_LISTING: ${document.finalUrl ?? document.url}`);
    }
    if (isUnavailableListingDocument(document)) {
      const archived = await markListingArchived({
        sourceKey: "otodom",
        externalId: options?.externalId,
        canonicalUrl: url,
        reason: `Link niedostępny: HTTP ${document.statusCode}`,
      });
      if (archived) {
        return buildArchivedCollectorResult(archived.listingId, options?.externalId ?? url, url);
      }
      throw new Error(`LISTING_ARCHIVED_NOT_FOUND: ${url}`);
    }

    const parsedFromPortal = await this.parser.parse(document);
    // Przy odświeżaniu rekord z bazy jest źródłem prawdy dla ID. Portal może
    // przekierować wygasły albo zmieniony link na stronę pomocniczą.
    const parsed = options?.externalId
      ? { ...parsedFromPortal, externalId: options.externalId }
      : parsedFromPortal;
    if (!parsed.priceAmount || parsed.priceAmount <= 0) {
      throw await missingPriceError(document, parsed.externalId);
    }
    const geocoded =
      isPriceOnlyRefresh || (parsed.latitude && parsed.longitude)
        ? null
        : await geocodeListing({
            city: parsed.city,
            district: parsed.district,
            neighborhood: parsed.neighborhood,
            street: parsed.street,
            addressText: parsed.addressText,
          });
    const normalizedParsed = geocoded
      ? {
          ...parsed,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
        }
      : parsed;
    const reverseGeocoded =
      !isPriceOnlyRefresh && normalizedParsed.latitude && normalizedParsed.longitude
        ? await reverseGeocodeListing({
            latitude: normalizedParsed.latitude,
            longitude: normalizedParsed.longitude,
          }).catch(async (error: unknown) => {
            await appendImportFailureLog({
              sourceKey: "otodom",
              externalId: normalizedParsed.externalId,
              canonicalUrl: url,
              error: error instanceof Error ? error.message : String(error),
              attempts: 1,
              context: {
                stage: "reverse_geocoding",
                fallback: "portal_location",
                cause: error instanceof Error ? String(error.cause ?? "") : "",
              },
            });
            return null;
          })
        : null;
    const enrichedParsed = {
      ...normalizedParsed,
      city:
        normalizedParsed.city === "Unknown"
          ? (reverseGeocoded?.city ?? normalizedParsed.city)
          : normalizedParsed.city,
      district: normalizedParsed.district ?? reverseGeocoded?.district ?? undefined,
      neighborhood: normalizedParsed.neighborhood ?? reverseGeocoded?.neighborhood ?? undefined,
      street: normalizedParsed.street ?? reverseGeocoded?.street ?? undefined,
      addressText: normalizedParsed.addressText ?? reverseGeocoded?.addressText ?? undefined,
    };
    const archivedArtifacts = isPriceOnlyRefresh
      ? { basePath: "", rawHtmlPath: "", parsedJsonPath: "" }
      : await archiveOfferArtifacts({
          sourceKey: "otodom",
          externalId: enrichedParsed.externalId,
          timestamp: new Date().toISOString(),
          html: document.html,
          parsed: enrichedParsed,
        });
    const stored = await this.storage.upsertListingSnapshot({
      sourceKey: "otodom",
      listing: enrichedParsed,
      refreshMode: options?.refreshMode,
      rawArtifact: {
        type: isPriceOnlyRefresh ? "json" : "html",
        storageKey:
          "rawStorageKey" in archivedArtifacts
            ? archivedArtifacts.rawStorageKey
            : `sources/otodom/${enrichedParsed.externalId}/price/${Date.now()}.json`,
        payload: isPriceOnlyRefresh
          ? { url: document.url, priceAmount: enrichedParsed.priceAmount }
          : {
              url: document.url,
              checksum:
                "rawChecksum" in archivedArtifacts ? archivedArtifacts.rawChecksum : undefined,
              parsedStorageKey:
                "parsedStorageKey" in archivedArtifacts
                  ? archivedArtifacts.parsedStorageKey
                  : undefined,
              encoding: "encoding" in archivedArtifacts ? archivedArtifacts.encoding : undefined,
            },
      },
    });

    const mediaResults =
      options?.downloadMedia === false ? [] : await downloadListingMedia(stored.mediaAssets);
    return {
      ...stored,
      parsed: {
        externalId: enrichedParsed.externalId,
        title: enrichedParsed.title,
        city: enrichedParsed.city,
        district: enrichedParsed.district,
        neighborhood: enrichedParsed.neighborhood,
        imageCount: enrichedParsed.images.length,
      },
      mediaResults,
      archivedArtifacts,
    };
  }

  async discover(input: { city: string; page?: number; pages?: number; startPage?: number }) {
    const settings = await getFamilySettings();
    return this.discovery.discoverListingUrls({
      ...input,
      city: input.city || settings.searchContract.city,
      contract: settings.searchContract,
    });
  }

  async discoverAll(input: {
    city: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    stopAfterEmptyBatches?: number;
    priority?: number;
  }) {
    const settings = await getFamilySettings();
    const city = input.city.toLowerCase();
    const startPage = Math.max(1, input.startPage ?? 1);
    const maxPages = Math.max(1, Math.min(5000, input.maxPages ?? 700));
    const batchPages = Math.max(1, Math.min(25, input.batchPages ?? 5));
    const stopAfterEmptyBatches = Math.max(1, Math.min(10, input.stopAfterEmptyBatches ?? 2));
    const runId = randomUUID();
    const result = await scanOtodomPages({
      startPage,
      maxPages,
      batchPages,
      stopAfterEmptyBatches,
      fetchPage: (page) =>
        this.discovery.discoverListingUrls({
          city,
          startPage: page,
          pages: 1,
          contract: settings.searchContract,
          context: { runId, startPage, maxPages, batchPages },
        }),
      enqueue: (items) =>
        enqueueListingImports({
          sourceKey: "otodom",
          city,
          priority: input.priority ?? 100,
          items,
        }),
      onError: (error, progress) =>
        appendImportFailureLog({
          sourceKey: "otodom",
          externalId: `search-run-${runId}`,
          canonicalUrl: "https://www.otodom.pl/pl/wyniki",
          error,
          attempts: 1,
          context: { phase: "discovery-run", runId, startPage, maxPages, batchPages, ...progress },
        }).catch((logError) => console.error("Otodom discovery log failed", logError)),
    });
    return { city, ...result };
  }

  async collectPage(input: {
    city: string;
    page?: number;
    startPage?: number;
    pages?: number;
    limit?: number;
  }) {
    const settings = await getFamilySettings();
    const pages = Math.max(1, Math.min(5, input.pages ?? 1));
    const limit = Math.max(1, Math.min(50, input.limit ?? 12));
    const discovered = await this.discovery.discoverListingUrls({
      ...input,
      city: input.city,
      pages,
      contract: settings.searchContract,
    });
    const results = [];
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const item of discovered.slice(0, limit)) {
      try {
        const result = await this.collectOne(item.url);
        if (result.action === "created") {
          created += 1;
        } else if (result.action === "updated") {
          updated += 1;
        } else {
          unchanged += 1;
        }
        results.push(result);
      } catch (error) {
        failed += 1;
        results.push({
          error: error instanceof Error ? error.message : "unknown error",
          externalId: item.externalId,
          url: item.url,
        });
      }
    }

    return {
      discovered: discovered.length,
      collected: results.length,
      startPage: input.startPage ?? input.page ?? 1,
      pagesScanned: pages,
      limitApplied: limit,
      created,
      updated,
      unchanged,
      failed,
      results,
    };
  }

  async processQueue(input?: {
    limit?: number;
    concurrency?: number;
    downloadMedia?: boolean;
    queueKind?: "all" | "price_updates";
  }) {
    const limit = Math.max(1, Math.min(500, input?.limit ?? 100));
    const concurrency = Math.max(1, Math.min(16, input?.concurrency ?? 8));
    const claimed = await claimListingImportBatch({
      sourceKey: "otodom",
      limit,
      queueKind: input?.queueKind,
    });
    const knownExternalIds = await getKnownListingExternalIds({
      sourceKey: "otodom",
      externalIds: claimed.map((item) => item.external_id),
    });

    let completed = 0;
    let failed = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];

    for (let index = 0; index < claimed.length; index += concurrency) {
      const batch = claimed.slice(index, index + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const priceOnly = knownExternalIds.has(item.external_id);
          await this.collectOne(item.canonical_url, {
            downloadMedia: priceOnly ? false : true,
            externalId: item.external_id,
            refreshMode: priceOnly ? "price_only" : "full",
          });
          await completeListingImport(item.id);
          return item;
        }),
      );

      for (let offset = 0; offset < results.length; offset += 1) {
        const result = results[offset];
        const item = batch[offset];

        if (result.status === "fulfilled") {
          completed += 1;
          continue;
        }

        failed += 1;
        const message = describeCollectorError(result.reason);
        failures.push({
          externalId: item.external_id,
          url: item.canonical_url,
          error: message,
        });
        if (message.startsWith("NOT_DIRECT_OTODOM_LISTING:")) {
          await purgeInvalidSourceListing({
            sourceKey: "otodom",
            externalId: item.external_id,
            queueItemId: item.id,
          });
          continue;
        }
        await failListingImport({
          id: item.id,
          error: message,
          attempts: item.attempts + 1,
          metadata:
            result.reason instanceof OtodomMissingPriceError
              ? result.reason.diagnostics
              : undefined,
        });
      }
    }

    return {
      claimed: claimed.length,
      completed,
      failed,
      failures,
    };
  }

  async getQueueStatus() {
    return getListingImportQueueStatus("otodom");
  }

  async retryFailed(limit?: number) {
    return retryFailedListingImportsNow({
      sourceKey: "otodom",
      limit,
    });
  }

  async runAll(input?: {
    city?: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    stopAfterEmptyBatches?: number;
    priority?: number;
    processLimit?: number;
    concurrency?: number;
    maxRounds?: number;
    downloadMedia?: boolean;
  }) {
    const discoverAll = await this.discoverAll({
      city: input?.city ?? "warszawa",
      startPage: input?.startPage,
      maxPages: input?.maxPages,
      batchPages: input?.batchPages,
      stopAfterEmptyBatches: input?.stopAfterEmptyBatches,
      priority: input?.priority,
    });

    const maxRounds = Math.max(1, Math.min(200, input?.maxRounds ?? 50));
    let processedRounds = 0;
    let totalClaimed = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let stoppedBecause: "queue_empty" | "max_rounds" | "no_progress" = "max_rounds";

    while (processedRounds < maxRounds) {
      const batch = await this.processQueue({
        limit: input?.processLimit ?? 200,
        concurrency: input?.concurrency ?? 8,
        downloadMedia: true,
      });

      processedRounds += 1;
      totalClaimed += batch.claimed;
      totalCompleted += batch.completed;
      totalFailed += batch.failed;

      if (batch.claimed === 0) {
        stoppedBecause = "queue_empty";
        break;
      }

      if (batch.completed === 0 && batch.failed === 0) {
        stoppedBecause = "no_progress";
        break;
      }
    }

    const finalQueueStatus = await this.getQueueStatus();

    return {
      discoverAll,
      processedRounds,
      totalClaimed,
      totalCompleted,
      totalFailed,
      finalQueueStatus,
      stoppedBecause,
    };
  }
}

function describeCollectorError(error: unknown): string {
  if (error instanceof AggregateError) {
    const nested = error.errors.map(describeCollectorError).filter(Boolean);
    if (nested.length > 0) return nested.join("; ");
  }
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    const message = error.message.trim();
    if (message) return code && !message.includes(code) ? `${code}: ${message}` : message;
    if (code) return code;
    return error.name || "unknown error";
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : "unknown error";
  } catch {
    return "unknown error";
  }
}

function isDirectOtodomListingDocument(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith("otodom.pl") &&
      /^\/pl\/oferta\/[^/]+ID[a-z0-9]+/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function buildArchivedCollectorResult(listingId: string, externalId: string, url: string) {
  return {
    listingId,
    snapshotId: "",
    action: "updated" as const,
    mediaAssets: [],
    parsed: {
      externalId,
      title: "Oferta archiwalna",
      city: "Unknown",
      imageCount: 0,
    },
    mediaResults: [],
    archivedArtifacts: {
      basePath: "",
      rawHtmlPath: "",
      parsedJsonPath: url,
    },
  };
}
