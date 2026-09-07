import { downloadListingMedia } from "../../services/media-downloader";
import { archiveOfferArtifacts } from "../../services/offer-archive";
import { getFamilySettings } from "../../services/family-settings";
import { geocodeListing, reverseGeocodeListing } from "../../services/geocoding";
import { isUnavailableListingDocument, markListingArchived } from "../../services/listing-archive";
import {
  claimListingImportBatch,
  completeListingImport,
  enqueueListingImports,
  failListingImport,
  getListingExternalIdsWithFewImages,
  getKnownListingExternalIds,
  getListingImportQueueStatus,
  retryFailedListingImportsNow
} from "../../services/listing-import-queue";
import { OtodomFetcher } from "../otodom/otodom-fetcher";
import { OtodomStorage } from "../otodom/otodom-storage";
import { GratkaDiscovery } from "./gratka-discovery";
import { GratkaFetcher } from "./gratka-fetcher";
import { GratkaParser } from "./gratka-parser";

export class GratkaCollector {
  private readonly discovery = new GratkaDiscovery(new OtodomFetcher());
  private readonly fetcher = new GratkaFetcher();
  private readonly parser = new GratkaParser();
  private readonly storage = new OtodomStorage();

  async collectOne(url: string, options?: { downloadMedia?: boolean; externalId?: string; refreshMode?: "full" | "price_only" }) {
    const isPriceOnlyRefresh = options?.refreshMode === "price_only";
    let document = await this.fetcher.fetchListing(url, {
      includeGallery: !isPriceOnlyRefresh,
      preferStaticHtml: isPriceOnlyRefresh
    });
    if (isUnavailableListingDocument(document)) {
      return archiveGratkaListing({
        sourceKey: "gratka",
        externalId: options?.externalId,
        canonicalUrl: url,
        reason: `Link niedostępny: HTTP ${document.statusCode}`
      });
    }

    let parsed = await this.parser.parse(document);
    if (options?.externalId) parsed = { ...parsed, externalId: options.externalId };
    if (parsed.status === "removed") {
      return archiveGratkaListing({
        sourceKey: "gratka",
        externalId: parsed.externalId,
        canonicalUrl: parsed.canonicalUrl,
        reason: "Portal przekierował lub oznaczył ofertę jako nieaktualną"
      });
    }
    // Gratka's static page exposes only three gallery previews. A browser
    // session can occasionally miss the modal gallery too, so retry once
    // before treating that partial result as the listing's image set.
    if (!isPriceOnlyRefresh && hasOnlyGalleryPreviews(parsed.images.length)) {
      const retryDocument = await this.fetcher.fetchListing(url, { includeGallery: true });
      let retryParsed = await this.parser.parse(retryDocument);
      if (options?.externalId) retryParsed = { ...retryParsed, externalId: options.externalId };
      if (retryParsed.status === "removed") {
        return archiveGratkaListing({
          sourceKey: "gratka",
          externalId: retryParsed.externalId,
          canonicalUrl: retryParsed.canonicalUrl,
          reason: "Portal przekierował lub oznaczył ofertę jako nieaktualną"
        });
      }
      if (retryParsed.images.length > parsed.images.length) {
        document = retryDocument;
        parsed = retryParsed;
      }
    }
    // Gratka can expose the price only in one of its two page variants. Price-only
    // refreshes start with static HTML and fall back to the rendered page. Full
    // gallery refreshes do the inverse and merge the price from static HTML so a
    // valid listing is not retried forever just because the browser DOM omitted it.
    if (!parsed.priceAmount || parsed.priceAmount <= 0) {
      const priceDocument = await this.fetcher.fetchListing(
        url,
        isPriceOnlyRefresh
          ? { includeGallery: false }
          : { includeGallery: false, preferStaticHtml: true }
      );
      let priceParsed = await this.parser.parse(priceDocument);
      if (options?.externalId) priceParsed = { ...priceParsed, externalId: options.externalId };
      if (priceParsed.status === "removed") {
        return archiveGratkaListing({
          sourceKey: "gratka",
          externalId: priceParsed.externalId,
          canonicalUrl: priceParsed.canonicalUrl,
          reason: "Portal przekierował lub oznaczył ofertę jako nieaktualną"
        });
      }
      if (isPriceOnlyRefresh) {
        document = priceDocument;
        parsed = priceParsed;
      } else if (priceParsed.priceAmount && priceParsed.priceAmount > 0) {
        parsed = { ...parsed, priceAmount: priceParsed.priceAmount };
      }
    }
    if (typeof parsed.priceAmount !== "number" || !Number.isFinite(parsed.priceAmount) || parsed.priceAmount <= 0) {
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
            addressText: parsed.addressText
          });
    const normalizedParsed = geocoded
      ? {
          ...parsed,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude
        }
      : parsed;
    const reverseGeocoded =
      !isPriceOnlyRefresh && normalizedParsed.latitude && normalizedParsed.longitude
        ? await reverseGeocodeListing({
            latitude: normalizedParsed.latitude,
            longitude: normalizedParsed.longitude
          })
        : null;
    const enrichedParsed = {
      ...normalizedParsed,
      city: normalizedParsed.city === "Unknown" ? reverseGeocoded?.city ?? normalizedParsed.city : normalizedParsed.city,
      district: normalizedParsed.district ?? reverseGeocoded?.district ?? undefined,
      neighborhood: normalizedParsed.neighborhood ?? reverseGeocoded?.neighborhood ?? undefined,
      street: normalizedParsed.street ?? reverseGeocoded?.street ?? undefined,
      addressText: normalizedParsed.addressText ?? reverseGeocoded?.addressText ?? undefined
    };
    const archivedArtifacts = isPriceOnlyRefresh
      ? { basePath: "", rawHtmlPath: "", parsedJsonPath: "" }
      : await archiveOfferArtifacts({
          sourceKey: "gratka",
          externalId: enrichedParsed.externalId,
          timestamp: new Date().toISOString(),
          html: document.html,
          parsed: enrichedParsed
        });
    const stored = await this.storage.upsertListingSnapshot({
      sourceKey: "gratka",
      listing: enrichedParsed,
      refreshMode: options?.refreshMode,
      rawArtifact: {
        type: isPriceOnlyRefresh ? "json" : "html",
        storageKey: "rawStorageKey" in archivedArtifacts
          ? archivedArtifacts.rawStorageKey
          : `sources/gratka/${enrichedParsed.externalId}/price/${Date.now()}.json`,
        payload: isPriceOnlyRefresh
          ? { url: document.url, priceAmount: enrichedParsed.priceAmount }
          : {
              url: document.url,
              checksum: "rawChecksum" in archivedArtifacts ? archivedArtifacts.rawChecksum : undefined,
              parsedStorageKey: "parsedStorageKey" in archivedArtifacts ? archivedArtifacts.parsedStorageKey : undefined,
              encoding: "encoding" in archivedArtifacts ? archivedArtifacts.encoding : undefined
            }
      }
    });

    const mediaResults = options?.downloadMedia === false ? [] : await downloadListingMedia(stored.mediaAssets);
    return {
      ...stored,
      galleryVerified: !isPriceOnlyRefresh && document.html.includes("data-gratka-gallery-state"),
      parsed: {
        externalId: enrichedParsed.externalId,
        title: enrichedParsed.title,
        city: enrichedParsed.city,
        district: enrichedParsed.district,
        neighborhood: enrichedParsed.neighborhood,
        imageCount: enrichedParsed.images.length
      },
      mediaResults,
      archivedArtifacts
    };
  }

  async discover(input: { city: string; page?: number; pages?: number; startPage?: number }) {
    const settings = await getFamilySettings();
    return this.discovery.discoverListingUrls({
      ...input,
      city: input.city || settings.searchContract.city,
      contract: settings.searchContract
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
    const batchPages = Math.max(1, Math.min(25, input.batchPages ?? 5));
    let queued = 0;
    let discovered = 0;
    let scannedPages = 0;
    let currentPage = startPage;
    let error: string | undefined;

    while (scannedPages < maxPages) {
      const pagesInBatch = Math.min(batchPages, maxPages - scannedPages);
      let links;

      try {
        links = await this.discovery.discoverListingUrls({
          city,
          startPage: currentPage,
          pages: pagesInBatch,
          contract: settings.searchContract
        });
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Gratka discovery failed";
        break;
      }

      const imageRefreshExternalIds = await getListingExternalIdsWithFewImages({
        sourceKey: "gratka",
        externalIds: links.map((item) => item.externalId),
        maximumImageCount: GALLERY_PREVIEW_IMAGE_COUNT
      });
      const batchResult = await enqueueListingImports({
        sourceKey: "gratka",
        city,
        priority: input.priority ?? 110,
        items: links,
        forceRefreshExternalIds: imageRefreshExternalIds
      });

      queued += batchResult.queued;
      discovered += links.length;
      scannedPages += pagesInBatch;
      currentPage += pagesInBatch;

      if (links.length === 0) {
        break;
      }
    }

    return {
      city,
      startPage,
      scannedPages,
      discovered,
      queued,
      stoppedBecause: error
        ? "error"
        : scannedPages >= maxPages
          ? "max_pages"
          : "empty_batches",
      error
    };
  }

  async processQueue(input?: { limit?: number; concurrency?: number; downloadMedia?: boolean; queueKind?: "all" | "price_updates" }) {
    const limit = Math.max(1, Math.min(500, input?.limit ?? 100));
    const concurrency = Math.max(1, Math.min(6, input?.concurrency ?? 4));
    const claimed = await claimListingImportBatch({
      sourceKey: "gratka",
      limit,
      queueKind: input?.queueKind
    });
    const knownExternalIds = await getKnownListingExternalIds({ sourceKey: "gratka", externalIds: claimed.map((item) => item.external_id) });
    const listingsNeedingImageRefresh = await getListingExternalIdsWithFewImages({
      sourceKey: "gratka",
      externalIds: claimed.map((item) => item.external_id),
      maximumImageCount: GALLERY_PREVIEW_IMAGE_COUNT
    });

    let completed = 0;
    let failed = 0;
    const failures: Array<{ externalId: string; url: string; error: string }> = [];

    for (let index = 0; index < claimed.length; index += concurrency) {
      const batch = claimed.slice(index, index + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const priceOnly = knownExternalIds.has(item.external_id) && !listingsNeedingImageRefresh.has(item.external_id);
          const collected = await this.collectOne(item.canonical_url, { downloadMedia: priceOnly ? false : input?.downloadMedia !== false, externalId: item.external_id, refreshMode: priceOnly ? "price_only" : "full" });
          await completeListingImport(item.id, "galleryVerified" in collected && collected.galleryVerified
            ? {
                galleryVerifiedAt: new Date().toISOString(),
                galleryImageCount: collected.parsed.imageCount
              }
            : undefined);
          return item;
        })
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
        failures.push({
          externalId: item.external_id,
          url: item.canonical_url,
          error: message
        });
        await failListingImport({
          id: item.id,
          error: message,
          attempts: item.attempts + 1,
          metadata: message.startsWith("MISSING_PRICE:")
            ? {
                failureCode: "missing_price",
                missingPrice: true,
                externalId: item.external_id,
                canonicalUrl: item.canonical_url
              }
            : undefined
        });
      }
    }

    return {
      claimed: claimed.length,
      completed,
      failed,
      failures
    };
  }

  async getQueueStatus() {
    return getListingImportQueueStatus("gratka");
  }

  async retryFailed(limit?: number) {
    return retryFailedListingImportsNow({
      sourceKey: "gratka",
      limit
    });
  }

  async runAll(input?: {
    city?: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
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
      priority: input?.priority
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
        downloadMedia: true
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
      stoppedBecause
    };
  }
}

const GALLERY_PREVIEW_IMAGE_COUNT = 3;

function hasOnlyGalleryPreviews(imageCount: number) {
  return imageCount <= GALLERY_PREVIEW_IMAGE_COUNT;
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
      imageCount: 0
    },
    mediaResults: [],
    archivedArtifacts: {
      basePath: "",
      rawHtmlPath: "",
      parsedJsonPath: url
    }
  };
}

async function archiveGratkaListing(input: {
  sourceKey: "gratka";
  externalId?: string;
  canonicalUrl: string;
  reason: string;
}) {
  const archived = await markListingArchived(input);
  return buildArchivedCollectorResult(
    archived?.listingId ?? "",
    input.externalId ?? input.canonicalUrl,
    input.canonicalUrl
  );
}
