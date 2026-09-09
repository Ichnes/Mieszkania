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
import { geocodeListing, reverseGeocodeListing } from "../../services/geography/geocoding";
import {
  isUnavailableListingDocument,
  markListingArchived,
} from "../../services/listings/listing-archive";
import { downloadListingMedia } from "../../services/media/media-downloader";
import { getFamilySettings } from "../../services/settings/family-settings";
import { OtodomStorage } from "../otodom/otodom-storage";
import { OlxDiscovery } from "./olx-discovery";
import { OlxFetcher } from "./olx-fetcher";
import { OlxParser } from "./olx-parser";

export class OlxCollector {
  private readonly discovery = new OlxDiscovery();
  private readonly fetcher = new OlxFetcher();
  private readonly parser = new OlxParser();
  private readonly storage = new OtodomStorage();

  async collectOne(
    url: string,
    options?: { downloadMedia?: boolean; externalId?: string; refreshMode?: "full" | "price_only" },
  ) {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    const document = await this.fetcher.fetchListing(url);
    if (!isDirectOlxListingDocument(document.finalUrl ?? document.url)) {
      throw new Error(`NOT_DIRECT_OLX_LISTING: ${document.finalUrl ?? document.url}`);
    }
    if (isUnavailableListingDocument(document)) {
      const archived = await markListingArchived({
        sourceKey: "olx",
        externalId: options?.externalId,
        canonicalUrl: url,
        reason: `Link niedostępny: HTTP ${document.statusCode}`,
      });
      if (archived) {
        return buildArchivedCollectorResult(archived.listingId, options?.externalId ?? url, url);
      }
      throw new OlxListingUnavailableBeforeImportError(url);
    }

    const parsedFromPortal = await this.parser.parse(document);
    const parsed = options?.externalId
      ? { ...parsedFromPortal, externalId: options.externalId }
      : parsedFromPortal;

    if (
      typeof parsed.priceAmount !== "number" ||
      !Number.isFinite(parsed.priceAmount) ||
      parsed.priceAmount <= 0
    ) {
      throw new Error(`MISSING_PRICE: ${parsed.externalId} (${parsed.canonicalUrl})`);
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
      ? { ...parsed, latitude: geocoded.latitude, longitude: geocoded.longitude }
      : parsed;
    const reverseGeocoded =
      !isPriceOnlyRefresh && normalizedParsed.latitude && normalizedParsed.longitude
        ? await reverseGeocodeListing({
            latitude: normalizedParsed.latitude,
            longitude: normalizedParsed.longitude,
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
          sourceKey: "olx",
          externalId: enrichedParsed.externalId,
          timestamp: new Date().toISOString(),
          html: document.html,
          parsed: enrichedParsed,
        });
    const stored = await this.storage.upsertListingSnapshot({
      sourceKey: "olx",
      listing: enrichedParsed,
      refreshMode: options?.refreshMode,
      rawArtifact: {
        type: isPriceOnlyRefresh ? "json" : "html",
        storageKey:
          "rawStorageKey" in archivedArtifacts
            ? archivedArtifacts.rawStorageKey
            : `sources/olx/${enrichedParsed.externalId}/price/${Date.now()}.json`,
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
    priority?: number;
  }) {
    const settings = await getFamilySettings();
    const city = input.city.trim().toLowerCase() || settings.searchContract.city.toLowerCase();
    const startPage = Math.max(1, input.startPage ?? 1);
    const maxPages = Math.max(1, Math.min(5000, input.maxPages ?? 250));
    return discoverLocationGroups({
      city,
      contract: settings.searchContract,
      startPage,
      maxPages,
      groupSize: 1,
      fetchReferences: (page, contract) =>
        this.discovery.discoverListingUrls({ city, page, pages: 1, contract }),
      enqueue: (items) =>
        enqueueListingImports({ sourceKey: "olx", city, priority: input.priority ?? 100, items }),
    });
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
      sourceKey: "olx",
      limit,
      queueKind: input?.queueKind,
    });
    const knownExternalIds = await getKnownListingExternalIds({
      sourceKey: "olx",
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
          try {
            await this.collectOne(item.canonical_url, {
              downloadMedia: priceOnly ? false : true,
              externalId: item.external_id,
              refreshMode: priceOnly ? "price_only" : "full",
            });
          } catch (error) {
            if (!(error instanceof OlxListingUnavailableBeforeImportError)) throw error;
            await completeListingImport(item.id, { unavailableBeforeImport: true });
            return item;
          }
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
        const message = result.reason instanceof Error ? result.reason.message : "unknown error";
        failures.push({ externalId: item.external_id, url: item.canonical_url, error: message });
        await failListingImport({
          id: item.id,
          error: message,
          attempts: item.attempts + 1,
          metadata: message.startsWith("MISSING_PRICE:")
            ? {
                failureCode: "missing_price",
                missingPrice: true,
                externalId: item.external_id,
                canonicalUrl: item.canonical_url,
              }
            : undefined,
        });
      }
    }

    return { claimed: claimed.length, completed, failed, failures };
  }

  async getQueueStatus() {
    return getListingImportQueueStatus("olx");
  }

  async retryFailed(limit?: number) {
    return retryFailedListingImportsNow({ sourceKey: "olx", limit });
  }
}

class OlxListingUnavailableBeforeImportError extends Error {
  constructor(url: string) {
    super(`LISTING_UNAVAILABLE_BEFORE_IMPORT: ${url}`);
    this.name = "OlxListingUnavailableBeforeImportError";
  }
}

function isDirectOlxListingDocument(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("olx.pl") && url.pathname.includes("/d/oferta/");
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
