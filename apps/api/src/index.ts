import "./config";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import Fastify from "fastify";
import { getMarketStats, type MarketStatsQuery } from "./services/market-stats";
import {
  type AlertsResponse,
  type DashboardResponse,
  type FamilySettings,
  type ListingFilters,
  type ListingViewingStatus,
  type ListingsResponse,
  type RecentOffersResponse,
  type UpcomingViewingsResponse,
  type MarketStatsResponse,
  warsawMetropolitanRegion
} from "@mieszkania/shared";
import { getAlerts } from "./services/alert-repository";
import { RcnCollector } from "./collectors/rcn";
import { activeRegion } from "./domain/region";
import {
  addListingContactEvent,
  archiveListingRecord,
  archiveListingsWithArchivedNotice,
  deleteListingRecord,
  dismissListingRecord,
  getDashboardContext,
  getListingDetail,
  getListingInsights,
  getMapListings,
  getListings,
  getListingsPage,
  getRecentCollectedListings,
  updateListingManualData,
  updateListingShortlist
} from "./services/listing-repository";
import { ensureRuntimeSchema } from "./services/schema-bootstrap";
import { OtodomCollector } from "./collectors/otodom";
import { GratkaCollector } from "./collectors/gratka";
import { OlxCollector } from "./collectors/olx";
import { NieruchomosciOnlineCollector } from "./collectors/nieruchomosci-online";
import { DomiportaCollector } from "./collectors/domiporta";
import { MaxonCollector } from "./collectors/maxon";
import { AdresowoCollector } from "./collectors/adresowo";
import { MorizonCollector } from "./collectors/morizon";
import { findMediaFilePath } from "./services/image-repository";
import { backfillListingMedia } from "./services/media-downloader";
import { getFamilySettings, updateFamilySettings } from "./services/family-settings";
import { restoreCriteriaExcludedListings } from "./services/search-contract-enforcer";
import { deleteListingViewing, getUpcomingViewings, upsertListingViewing } from "./services/listing-viewings";
import { cleanupSeedData } from "./services/cleanup-seed-data";
import { confirmDuplicateGroup, getDuplicateCandidates, getDuplicateGroupOverviews, reviewDuplicateCandidate, runAutomaticDuplicateMergeByDescription, unmergeDuplicateListing } from "./services/listing-duplicates";
import { sanitizeBrokenPortalListings } from "./services/portal-listing-sanitizer";
import { enqueueStaleListingPriceUpdates, resetProcessingListingImportsNow } from "./services/listing-import-queue";
import { deletePortalSourceData } from "./services/source-data-cleanup";
import { importWarsawStreets } from "./services/warsaw-street-importer";
import { enrichListingsFromLocalStreets } from "./services/street-enrichment-backfill";
import { backfillWarsawListingDistricts, importWarsawDistrictBoundaries } from "./services/warsaw-district-boundaries";
import { getWarsawRailwayMap } from "./services/railway-map";
import { getWarsawTramwayMap } from "./services/tramway-map";
import { withDb } from "./db";
import { sanitizeStoredListingAddresses } from "./services/listing-address-sanitizer";
import { backfillEstimatedWarsawNeighborhoods } from "./services/listing-neighborhood-estimator";
import { canonicalWarsawDistrict, canonicalWarsawNeighborhood, inferWarsawNeighborhood } from "./services/warsaw-neighborhoods";
import { scanRelistedListings } from "./services/listing-relistings";
import { getListingAutomationPaused, setListingAutomationPaused } from "./services/listing-automation";
import { getListingParcelContext } from "./services/listing-parcel-context";
import { getListingPlanningContext } from "./services/listing-planning-context";

const app = Fastify({
  logger: true
});

// Collectors run work in the background after an HTTP request finishes. A
// blocked portal must be recorded as an import failure, not terminate Node and
// take the entire dashboard offline.
process.on("unhandledRejection", (reason) => {
  app.log.error({ err: reason }, "Unhandled background task rejection");
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error, "API request failed");
  reply.code(500).send({ message: "Operacja nie powiodła się. API nadal działa." });
});
const otodomCollector = new OtodomCollector();
const gratkaCollector = new GratkaCollector();
const olxCollector = new OlxCollector();
const nieruchomosciOnlineCollector = new NieruchomosciOnlineCollector();
const domiportaCollector = new DomiportaCollector();
const maxonCollector = new MaxonCollector();
const adresowoCollector = new AdresowoCollector();
const morizonCollector = new MorizonCollector();
const rcnCollector = new RcnCollector();
let staleRefreshRunning = false;
let scheduledRefreshRunning = false;
let listingAutomationPaused = false;
const scheduledRefreshIntervalMs = 60 * 1000;

type ScheduledQueueResult = { claimed: number; completed: number; failed: number };

const scheduledPortalProcessors: Array<{
  sourceKey: string;
  batchSize: number;
  process: () => Promise<ScheduledQueueResult>;
}> = [
  { sourceKey: "otodom", batchSize: 200, process: () => otodomCollector.processQueue({ limit: 200, concurrency: 8 }) },
  { sourceKey: "gratka", batchSize: 200, process: () => gratkaCollector.processQueue({ limit: 200, concurrency: 8 }) },
  { sourceKey: "olx", batchSize: 200, process: () => olxCollector.processQueue({ limit: 200, concurrency: 8 }) },
  { sourceKey: "nieruchomosci_online", batchSize: 15, process: () => nieruchomosciOnlineCollector.processQueue({ limit: 15, concurrency: 1 }) },
  { sourceKey: "domiporta", batchSize: 200, process: () => domiportaCollector.processQueue({ limit: 200, concurrency: 8 }) },
  { sourceKey: "maxon", batchSize: 200, process: () => maxonCollector.processQueue({ limit: 200, concurrency: 8 }) },
  { sourceKey: "adresowo", batchSize: 200, process: () => adresowoCollector.processQueue({ limit: 200, concurrency: 8 }) },
  { sourceKey: "morizon", batchSize: 200, process: () => morizonCollector.processQueue({ limit: 200, concurrency: 4 }) }
];

async function getStaleListingCount() {
  return withDb(async (db) => {
    const result = await db.query<{ count: string }>(`
      select count(*)::text as count
      from listings
      where status not in ('removed', 'sold')
        and last_seen_at < now() - interval '24 hours'
    `);
    return Number(result.rows[0]?.count ?? 0);
  });
}

async function getStaleListingStatus() {
  return withDb(async (db) => {
    const result = await db.query<{
      due: string;
      refreshed_last_24_hours: string;
      next_due_at: string | null;
      last_checked_at: string | null;
    }>(`
      select
        count(*) filter (
          where status not in ('removed', 'sold')
            and last_seen_at < now() - interval '24 hours'
        )::text as due,
        count(*) filter (
          where status not in ('removed', 'sold')
            and last_seen_at >= now() - interval '24 hours'
        )::text as refreshed_last_24_hours,
        min(last_seen_at + interval '24 hours') filter (
          where status not in ('removed', 'sold')
            and last_seen_at >= now() - interval '24 hours'
        )::text as next_due_at,
        max(last_seen_at) filter (
          where status not in ('removed', 'sold')
        )::text as last_checked_at
      from listings
    `);
    const row = result.rows[0];
    return {
      due: Number(row?.due ?? 0),
      refreshedLast24Hours: Number(row?.refreshed_last_24_hours ?? 0),
      nextDueAt: row?.next_due_at ?? undefined,
      lastCheckedAt: row?.last_checked_at ?? undefined
    };
  });
}

async function refreshStaleListings() {
  if (staleRefreshRunning) return { due: await getStaleListingCountSafely(), queued: 0 };
  staleRefreshRunning = true;
  try {
    return await enqueueStaleListingPriceUpdates();
  } catch (error) {
    app.log.warn(error, "Stale listing price refresh enqueue failed");
    return { due: await getStaleListingCountSafely(), queued: 0 };
  }
  finally { staleRefreshRunning = false; }
}

async function getStaleListingCountSafely() {
  try {
    return await getStaleListingCount();
  } catch (error) {
    app.log.warn(error, "Stale listing count failed");
    return 0;
  }
}

async function runScheduledListingRefresh() {
  if (scheduledRefreshRunning || listingAutomationPaused) return;
  scheduledRefreshRunning = true;
  try {
    await refreshStaleListings();
    await Promise.all(scheduledPortalProcessors.map(async ({ sourceKey, batchSize, process }) => {
      if (listingAutomationPaused) return;
      try {
        let claimed = 0;
        let completed = 0;
        let failed = 0;
        for (let batch = 0; batch < 50; batch += 1) {
          if (listingAutomationPaused) break;
          const result = await process();
          claimed += result.claimed;
          completed += result.completed;
          failed += result.failed;
          if (result.claimed < batchSize) break;
        }
        if (claimed > 0) {
          app.log.info({ sourceKey, claimed, completed, failed }, "Scheduled listing refresh finished");
        }
      } catch (error) {
        app.log.warn({ err: error, sourceKey }, "Scheduled portal refresh failed");
      }
    }));
  } catch (error) {
    app.log.warn(error, "Scheduled listing refresh failed");
  } finally {
    scheduledRefreshRunning = false;
  }
}

app.addHook("onRequest", async (_request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
});

app.options("/*", async (_request, reply) => {
  reply.code(204).send();
});

app.get<{ Querystring: MarketStatsQuery }>("/api/market-stats", async (request) => getMarketStats(request.query));

app.get("/api/listings/refresh-stale/status", async () => ({
  ...await getStaleListingStatus(),
  running: staleRefreshRunning || scheduledRefreshRunning,
  automationPaused: listingAutomationPaused
}));

app.post("/api/listings/refresh-stale", async () => {
  const result = await refreshStaleListings();
  void runScheduledListingRefresh();
  return { ...result, started: !listingAutomationPaused && result.queued > 0, running: !listingAutomationPaused, automationPaused: listingAutomationPaused };
});

app.post("/api/listings/automation/pause", async () => {
  listingAutomationPaused = await setListingAutomationPaused(true);
  return { automationPaused: listingAutomationPaused, running: scheduledRefreshRunning };
});

app.post("/api/listings/automation/resume", async () => {
  listingAutomationPaused = await setListingAutomationPaused(false);
  return { automationPaused: listingAutomationPaused, running: scheduledRefreshRunning };
});

app.post("/api/listings/automation/run", async () => {
  if (!listingAutomationPaused) void runScheduledListingRefresh();
  return { automationPaused: listingAutomationPaused, running: scheduledRefreshRunning };
});

const buildDashboardResponse = async (): Promise<DashboardResponse> => {
  const context = await getDashboardContext();

  return {
    market: activeRegion.primaryCity,
    stats: context.stats,
    listings: context.listings
  };
};

const buildListingsResponse = async (): Promise<ListingsResponse> => {
  const items = await getListings();

  return {
    total: items.length,
    items
  };
};

const buildRecentOffersResponse = async (): Promise<RecentOffersResponse> => {
  const items = await getRecentCollectedListings();

  return {
    total: items.length,
    items
  };
};

const buildUpcomingViewingsResponse = async (): Promise<UpcomingViewingsResponse> => {
  return getUpcomingViewings();
};

const buildAlertsResponse = async (): Promise<AlertsResponse> => {
  const items = await getAlerts();

  return {
    total: items.length,
    items
  };
};

app.get("/health", async () => ({
  status: "ok",
  service: "mieszkania-api",
  date: new Date().toISOString()
}));

app.get("/api/dashboard", async () => buildDashboardResponse());
app.get("/api/region", async () => warsawMetropolitanRegion);

app.get("/api/listings", async (request) => {
  const query = request.query as Record<string, string | undefined>;
  return getListingsPage(parseListingFilters(query));
});
app.get("/api/listings/map", async () => getMapListings());
app.get("/api/map/railway", async () => getWarsawRailwayMap());
app.get("/api/map/tramway", async () => getWarsawTramwayMap());
app.get("/api/listings/recent", async () => buildRecentOffersResponse());

app.get<{ Params: { id: string } }>("/api/listings/:id", async (request, reply) => {
  const listing = await getListingDetail(request.params.id);

  if (!listing) {
    reply.code(404);
    return {
      message: "Listing not found"
    };
  }

  return listing;
});
app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>("/api/listings/:id/parcel", async (request, reply) => {
  try {
    const context = await getListingParcelContext(request.params.id, request.query.refresh === "true");
    if (!context) {
      reply.code(404);
      return { message: "Listing not found" };
    }
    return context;
  } catch (error) {
    app.log.warn(error, "ULDK parcel lookup failed");
    reply.code(502);
    return { message: "Nie udalo sie pobrac danych dzialki z ULDK." };
  }
});
app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>("/api/listings/:id/planning", async (request, reply) => {
  try {
    const context = await getListingPlanningContext(request.params.id, request.query.refresh === "true");
    if (!context) {
      reply.code(404);
      return { message: "Listing not found" };
    }
    return context;
  } catch (error) {
    app.log.warn(error, "Urban registry lookup failed");
    reply.code(502);
    return { message: "Nie udało się pobrać danych z Rejestru Urbanistycznego." };
  }
});
app.delete<{ Params: { id: string } }>("/api/listings/:id", async (request) => deleteListingRecord(request.params.id));
app.post<{ Params: { id: string } }>("/api/listings/:id/dismiss", async (request) => dismissListingRecord(request.params.id));
app.post<{ Params: { id: string } }>("/api/listings/:id/archive", async (request) => archiveListingRecord(request.params.id));

app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>("/api/listings/:id/insights", async (request, reply) => {
  let insights: Awaited<ReturnType<typeof getListingInsights>>;
  try {
    insights = await getListingInsights(request.params.id, request.query.refresh === "true");
  } catch (error) {
    app.log.warn(error, "Listing insights failed");
    return {
      commutes: [],
      amenities: [],
      amenityAnalysis: { status: "unavailable", source: "OpenStreetMap", radiusMeters: 2000, plannedFacilities: [] }
    };
  }

  if (!insights) {
    reply.code(404);
    return {
      message: "Listing not found"
    };
  }

  return insights;
});

app.post<{ Params: { id: string }; Body: { shortlisted?: boolean } }>("/api/listings/:id/shortlist", async (request, reply) => {
  if (typeof request.body?.shortlisted !== "boolean") {
    reply.code(400);
    return { message: "Missing shortlisted boolean" };
  }

  const shortlisted = await updateListingShortlist(request.params.id, request.body.shortlisted);

  if (shortlisted === null) {
    reply.code(404);
    return { message: "Listing not found" };
  }

  return { id: request.params.id, shortlisted };
});

app.post<{
  Params: { id: string };
  Body: {
    contactStatus?: "new" | "contacted" | "negotiating" | "viewing_scheduled" | "rejected" | "closed";
    decisionStage?: "new" | "to_call" | "after_call" | "to_viewing" | "after_viewing" | "to_offer" | "rejected" | "bought";
    contactName?: string;
    contactPhone?: string;
    contactRole?: string;
    negotiatedPriceAmount?: number;
    askingPriceOverride?: number;
    notes?: string;
    sourceNotes?: string;
    lastContactAt?: string;
  };
}>("/api/listings/:id/manual", async (request, reply) => {
  const listing = await updateListingManualData(request.params.id, request.body ?? {});

  if (!listing) {
    reply.code(404);
    return { message: "Listing not found" };
  }

  return listing;
});

app.post<{
  Params: { id: string };
  Body: {
    eventType?: "call" | "message" | "email" | "meeting" | "viewing_note" | "negotiation" | "status_change" | "other";
    occurredAt?: string;
    title?: string;
    notes?: string;
    contactName?: string;
    amount?: number;
  };
}>("/api/listings/:id/contact-events", async (request, reply) => {
  if (!request.body?.eventType || !request.body?.occurredAt) {
    reply.code(400);
    return { message: "Missing eventType or occurredAt" };
  }

  const listing = await addListingContactEvent(request.params.id, request.body);

  if (!listing) {
    reply.code(404);
    return { message: "Listing not found or invalid event payload" };
  }

  return listing;
});

app.get("/api/settings/family", async () => getFamilySettings());

app.post<{ Body: FamilySettings }>("/api/settings/family", async (request) => {
  const settings = await updateFamilySettings(request.body);
  await restoreCriteriaExcludedListings();
  return settings;
});

app.get("/api/alerts", async () => buildAlertsResponse());
app.get("/api/duplicates/candidates", async (request) => {
  const query = request.query as { limit?: string; listingId?: string };
  return getDuplicateCandidates(query.limit ? Number(query.limit) : undefined, query.listingId || undefined);
});
app.get("/api/duplicates/groups", async (request) => {
  const query = request.query as { limit?: string; summary?: string };
  const limit = Number(query.limit ?? 200);
  return query.summary === "true" ? getDuplicateGroupOverviews(limit, true) : getDuplicateGroupOverviews(limit);
});
app.post<{ Body: { primaryListingId?: string; duplicateListingId?: string } }>("/api/duplicates/unmerge", async (request, reply) => {
  if (!request.body?.primaryListingId || !request.body?.duplicateListingId) return reply.code(400).send({ message: "Missing duplicate group members" });
  return unmergeDuplicateListing(request.body.primaryListingId, request.body.duplicateListingId);
});
app.post<{ Body: { primaryListingId?: string } }>("/api/duplicates/confirm", async (request, reply) => {
  if (!request.body?.primaryListingId) return reply.code(400).send({ message: "Missing primary listing" });
  return confirmDuplicateGroup(request.body.primaryListingId);
});

app.post<{ Body: { limit?: number } }>("/api/duplicates/auto-merge", async (request) => {
  return runAutomaticDuplicateMergeByDescription(request.body?.limit);
});

app.post<{ Body: { limit?: number } }>("/api/listings/relistings/scan", async (request) => {
  return scanRelistedListings(request.body?.limit);
});

app.post<{
  Body: {
    leftId?: string;
    rightId?: string;
    primaryListingId?: string;
    status?: "same_listing" | "different_listing";
    notes?: string;
  };
}>("/api/duplicates/review", async (request, reply) => {
  if (!request.body?.leftId || !request.body?.rightId || !request.body?.status) {
    reply.code(400);
    return { message: "Missing duplicate review payload" };
  }

  return reviewDuplicateCandidate({
    leftId: request.body.leftId,
    rightId: request.body.rightId,
    primaryListingId: request.body.primaryListingId,
    status: request.body.status,
    notes: request.body.notes
  });
});

app.get("/api/viewings/upcoming", async () => buildUpcomingViewingsResponse());

app.post<{ Params: { id: string }; Body: { scheduledAt?: string; status?: ListingViewingStatus; notes?: string } }>("/api/listings/:id/viewing", async (request, reply) => {
  if (!request.body?.scheduledAt) {
    reply.code(400);
    return { message: "Missing scheduledAt" };
  }

  return upsertListingViewing({
    listingId: request.params.id,
    scheduledAt: request.body.scheduledAt,
    status: request.body.status,
    notes: request.body.notes
  });
});

app.delete<{ Params: { id: string } }>("/api/listings/:id/viewing", async (request, reply) => {
  const deleted = await deleteListingViewing(request.params.id);

  if (!deleted) {
    reply.code(404);
    return { message: "Viewing not found" };
  }

  return { deleted: true };
});

app.get("/api/collectors/otodom/discover", async (request) => {
  const query = request.query as { city?: string; page?: string; pages?: string; startPage?: string };
  const city = query.city ?? activeRegion.primaryCity.toLowerCase();
  const page = query.page ? Number(query.page) : undefined;
  const pages = query.pages ? Number(query.pages) : undefined;
  const startPage = query.startPage ? Number(query.startPage) : undefined;

  return otodomCollector.discover({ city, page, pages, startPage });
});

app.post("/api/collectors/otodom/discover-all", async (request) => {
  const body = (request.body ?? {}) as {
    city?: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    stopAfterEmptyBatches?: number;
    priority?: number;
  };

  return otodomCollector.discoverAll({
    city: body.city ?? activeRegion.primaryCity.toLowerCase(),
    startPage: body.startPage,
    maxPages: body.maxPages,
    batchPages: body.batchPages,
    stopAfterEmptyBatches: body.stopAfterEmptyBatches,
    priority: body.priority
  });
});

app.get("/api/collectors/gratka/discover", async (request) => {
  const query = request.query as { city?: string; page?: string; pages?: string; startPage?: string };
  const city = query.city ?? activeRegion.primaryCity.toLowerCase();
  const page = query.page ? Number(query.page) : undefined;
  const pages = query.pages ? Number(query.pages) : undefined;
  const startPage = query.startPage ? Number(query.startPage) : undefined;

  return gratkaCollector.discover({ city, page, pages, startPage });
});

app.post("/api/collectors/gratka/discover-all", async (request) => {
  const body = (request.body ?? {}) as {
    city?: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    priority?: number;
  };

  return gratkaCollector.discoverAll({
    city: body.city ?? activeRegion.primaryCity.toLowerCase(),
    startPage: body.startPage,
    maxPages: body.maxPages,
    batchPages: body.batchPages,
    priority: body.priority
  });
});

app.post("/api/collectors/gratka/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number; downloadMedia?: boolean };
  return gratkaCollector.processQueue({
    limit: body.limit,
    concurrency: body.concurrency,
    downloadMedia: body.downloadMedia
  });
});

app.post("/api/collectors/gratka/retry-failed", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return gratkaCollector.retryFailed(body.limit);
});

app.post("/api/collectors/gratka/reset-processing", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return resetProcessingListingImportsNow({ sourceKey: "gratka", limit: body.limit });
});

app.post("/api/collectors/gratka/run-all", async (request) => {
  const body = (request.body ?? {}) as {
    city?: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    priority?: number;
    processLimit?: number;
    concurrency?: number;
    maxRounds?: number;
    downloadMedia?: boolean;
  };

  return gratkaCollector.runAll({
    city: body.city ?? activeRegion.primaryCity.toLowerCase(),
    startPage: body.startPage,
    maxPages: body.maxPages,
    batchPages: body.batchPages,
    priority: body.priority,
    processLimit: body.processLimit,
    concurrency: body.concurrency,
    maxRounds: body.maxRounds,
    downloadMedia: body.downloadMedia
  });
});

app.get("/api/collectors/olx/discover", async (request) => {
  const query = request.query as { city?: string; page?: string; pages?: string; startPage?: string };
  return olxCollector.discover({
    city: query.city ?? "warszawa",
    page: query.page ? Number(query.page) : undefined,
    pages: query.pages ? Number(query.pages) : undefined,
    startPage: query.startPage ? Number(query.startPage) : undefined
  });
});

app.post("/api/collectors/olx/discover-all", async (request) => {
  const body = (request.body ?? {}) as {
    city?: string;
    startPage?: number;
    maxPages?: number;
    batchPages?: number;
    priority?: number;
  };
  return olxCollector.discoverAll({
    city: body.city ?? "warszawa",
    startPage: body.startPage,
    maxPages: body.maxPages,
    batchPages: body.batchPages,
    priority: body.priority
  });
});

app.post("/api/collectors/olx/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number; downloadMedia?: boolean };
  return olxCollector.processQueue({
    limit: body.limit,
    concurrency: body.concurrency,
    downloadMedia: body.downloadMedia
  });
});

app.post("/api/collectors/olx/retry-failed", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return olxCollector.retryFailed(body.limit);
});

app.post("/api/collectors/olx/reset-processing", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return resetProcessingListingImportsNow({ sourceKey: "olx", limit: body.limit });
});

app.post("/api/collectors/olx/delete-data", async () => {
  return deletePortalSourceData("olx");
});

app.post("/api/collectors/nieruchomosci-online/discover-all", async (request) => {
  const body = (request.body ?? {}) as { city?: string; startPage?: number; maxPages?: number; batchPages?: number; priority?: number };
  return nieruchomosciOnlineCollector.discoverAll({ city: body.city ?? "warszawa", startPage: body.startPage, maxPages: body.maxPages, batchPages: body.batchPages, priority: body.priority });
});

app.post("/api/collectors/nieruchomosci-online/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number; force?: boolean };
  return nieruchomosciOnlineCollector.processQueue(body);
});

app.post("/api/collectors/nieruchomosci-online/retry-failed", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return nieruchomosciOnlineCollector.retryFailed(body.limit);
});

app.post("/api/collectors/nieruchomosci-online/reset-processing", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return resetProcessingListingImportsNow({ sourceKey: "nieruchomosci_online", limit: body.limit });
});

app.get("/api/collectors/nieruchomosci-online/queue-status", async () => nieruchomosciOnlineCollector.getQueueStatus());
app.post("/api/collectors/nieruchomosci-online/delete-data", async () => deletePortalSourceData("nieruchomosci_online"));
app.post<{ Body: { url: string } }>("/api/collectors/nieruchomosci-online/collect-one", async (request, reply) => {
  if (!request.body?.url) { reply.code(400); return { message: "Missing url" }; }
  return nieruchomosciOnlineCollector.collectOne(request.body.url);
});

app.post("/api/collectors/domiporta/discover-all", async (request) => {
  const body = (request.body ?? {}) as { city?: string; startPage?: number; maxPages?: number; batchPages?: number; priority?: number };
  return domiportaCollector.discoverAll({ city: body.city ?? "warszawa", startPage: body.startPage, maxPages: body.maxPages, batchPages: body.batchPages, priority: body.priority });
});
app.post("/api/collectors/domiporta/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
  return domiportaCollector.processQueue(body);
});
app.post("/api/collectors/domiporta/retry-failed", async (request) => domiportaCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit));
app.post("/api/collectors/domiporta/reset-processing", async (request) => resetProcessingListingImportsNow({ sourceKey: "domiporta", limit: (request.body as { limit?: number } | undefined)?.limit }));
app.get("/api/collectors/domiporta/queue-status", async () => domiportaCollector.getQueueStatus());
app.post("/api/collectors/domiporta/delete-data", async () => deletePortalSourceData("domiporta"));
app.post<{ Body: { url: string } }>("/api/collectors/domiporta/collect-one", async (request, reply) => {
  if (!request.body?.url) { reply.code(400); return { message: "Missing url" }; }
  return domiportaCollector.collectOne(request.body.url);
});

app.post("/api/collectors/maxon/discover-all", async (request) => {
  const body = (request.body ?? {}) as { city?: string; startPage?: number; maxPages?: number; batchPages?: number; priority?: number };
  return maxonCollector.discoverAll({ city: body.city ?? "warszawa", startPage: body.startPage, maxPages: body.maxPages, batchPages: body.batchPages, priority: body.priority });
});
app.post("/api/collectors/maxon/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
  return maxonCollector.processQueue(body);
});
app.post("/api/collectors/maxon/retry-failed", async (request) => maxonCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit));
app.post("/api/collectors/maxon/reset-processing", async (request) => resetProcessingListingImportsNow({ sourceKey: "maxon", limit: (request.body as { limit?: number } | undefined)?.limit }));
app.get("/api/collectors/maxon/queue-status", async () => maxonCollector.getQueueStatus());
app.post("/api/collectors/maxon/delete-data", async () => deletePortalSourceData("maxon"));
app.post<{ Body: { url: string } }>("/api/collectors/maxon/collect-one", async (request, reply) => {
  if (!request.body?.url) { reply.code(400); return { message: "Missing url" }; }
  return maxonCollector.collectOne(request.body.url);
});

app.post("/api/collectors/adresowo/discover-all", async (request) => {
  const body = (request.body ?? {}) as { city?: string; startPage?: number; maxPages?: number; batchPages?: number; priority?: number };
  return adresowoCollector.discoverAll({ city: body.city ?? "warszawa", startPage: body.startPage, maxPages: body.maxPages, batchPages: body.batchPages, priority: body.priority });
});
app.post("/api/collectors/adresowo/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
  return adresowoCollector.processQueue(body);
});
app.post("/api/collectors/adresowo/retry-failed", async (request) => adresowoCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit));
app.post("/api/collectors/adresowo/backfill-published-dates", async (request) => adresowoCollector.refreshPublishedDates((request.body as { limit?: number } | undefined)?.limit));
app.post("/api/collectors/adresowo/reset-processing", async (request) => resetProcessingListingImportsNow({ sourceKey: "adresowo", limit: (request.body as { limit?: number } | undefined)?.limit }));
app.get("/api/collectors/adresowo/queue-status", async () => adresowoCollector.getQueueStatus());
app.post("/api/collectors/adresowo/delete-data", async () => deletePortalSourceData("adresowo"));
app.post<{ Body: { url: string } }>("/api/collectors/adresowo/collect-one", async (request, reply) => {
  if (!request.body?.url) { reply.code(400); return { message: "Missing url" }; }
  return adresowoCollector.collectOne(request.body.url);
});

app.post("/api/collectors/morizon/discover-all", async (request) => {
  const body = (request.body ?? {}) as { city?: string; startPage?: number; maxPages?: number; batchPages?: number; priority?: number };
  return morizonCollector.discoverAll({ city: body.city ?? "warszawa", startPage: body.startPage, maxPages: body.maxPages, batchPages: body.batchPages, priority: body.priority });
});
app.post("/api/collectors/morizon/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
  return morizonCollector.processQueue(body);
});
app.post("/api/collectors/morizon/retry-failed", async (request) => morizonCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit));
app.post("/api/collectors/morizon/reset-processing", async (request) => resetProcessingListingImportsNow({ sourceKey: "morizon", limit: (request.body as { limit?: number } | undefined)?.limit }));
app.get("/api/collectors/morizon/queue-status", async () => morizonCollector.getQueueStatus());
app.post("/api/collectors/morizon/delete-data", async () => deletePortalSourceData("morizon"));
app.post<{ Body: { url: string } }>("/api/collectors/morizon/collect-one", async (request, reply) => {
  if (!request.body?.url) { reply.code(400); return { message: "Missing url" }; }
  return morizonCollector.collectOne(request.body.url);
});

app.post<{ Body: { url: string } }>("/api/collectors/otodom/collect-one", async (request, reply) => {
  if (!request.body?.url) {
    reply.code(400);
    return { message: "Missing url" };
  }

  return otodomCollector.collectOne(request.body.url);
});

app.post<{ Body: { url: string; refreshMode?: "full" | "price_only" } }>("/api/collectors/gratka/collect-one", async (request, reply) => {
  if (!request.body?.url) {
    reply.code(400);
    return { message: "Missing url" };
  }

  return gratkaCollector.collectOne(request.body.url, { refreshMode: request.body.refreshMode });
});

app.post<{ Body: { url: string } }>("/api/collectors/olx/collect-one", async (request, reply) => {
  if (!request.body?.url) {
    reply.code(400);
    return { message: "Missing url" };
  }

  return olxCollector.collectOne(request.body.url);
});

app.post("/api/collectors/otodom/collect-page", async (request) => {
  const body = (request.body ?? {}) as { city?: string; page?: number; startPage?: number; pages?: number; limit?: number };
  return otodomCollector.collectPage({
    city: body.city ?? activeRegion.primaryCity.toLowerCase(),
    page: body.page,
    startPage: body.startPage,
    pages: body.pages,
    limit: body.limit
  });
});

app.post("/api/collectors/otodom/process-queue", async (request) => {
  const body = (request.body ?? {}) as { limit?: number; concurrency?: number; downloadMedia?: boolean };
  return otodomCollector.processQueue({
    limit: body.limit,
    concurrency: body.concurrency,
    downloadMedia: body.downloadMedia
  });
});

app.post("/api/collectors/otodom/retry-failed", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return otodomCollector.retryFailed(body.limit);
});

app.post("/api/collectors/otodom/reset-processing", async (request) => {
  const body = (request.body ?? {}) as { limit?: number };
  return resetProcessingListingImportsNow({ sourceKey: "otodom", limit: body.limit });
});

app.post("/api/collectors/otodom/run-all", async (request) => {
  const body = (request.body ?? {}) as {
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
  };

  return otodomCollector.runAll({
    city: body.city ?? activeRegion.primaryCity.toLowerCase(),
    startPage: body.startPage,
    maxPages: body.maxPages,
    batchPages: body.batchPages,
    stopAfterEmptyBatches: body.stopAfterEmptyBatches,
    priority: body.priority,
    processLimit: body.processLimit,
    concurrency: body.concurrency,
    maxRounds: body.maxRounds,
    downloadMedia: body.downloadMedia
  });
});

app.post<{ Body: { listingId?: string; limit?: number } }>("/api/media/backfill", async (request) => {
  const body = (request.body ?? {}) as { listingId?: string; limit?: number };
  return backfillListingMedia({
    listingId: body.listingId,
    limit: body.limit
  });
});

app.post<{ Params: { id: string } }>("/api/listings/:id/media/backfill", async (request) => {
  return backfillListingMedia({
    listingId: request.params.id,
    limit: 500
  });
});

app.get("/api/collectors/otodom/queue-status", async () => {
  return otodomCollector.getQueueStatus();
});

app.get("/api/collectors/gratka/queue-status", async () => {
  return gratkaCollector.getQueueStatus();
});

app.get("/api/collectors/olx/queue-status", async () => {
  return olxCollector.getQueueStatus();
});

app.get("/api/collectors/rcn/plan", async () => {
  return rcnCollector.planWarsawAreaImport();
});

app.get("/api/collectors/rcn/inspect", async (request) => {
  const query = request.query as { scope?: string };
  return rcnCollector.inspectCapabilities(query.scope);
});

app.post("/api/streets/warsaw/import", async () => importWarsawStreets());
app.post("/api/streets/warsaw/enrich-listings", async () => enrichListingsFromLocalStreets());
app.post("/api/streets/warsaw/import-and-enrich", async () => {
  const streets = await importWarsawStreets();
  const enriched = await enrichListingsFromLocalStreets();
  return { streets, enriched };
});
app.post("/api/districts/warsaw/import", async () => importWarsawDistrictBoundaries());
app.post("/api/districts/warsaw/backfill-listings", async () => backfillWarsawListingDistricts());
app.post("/api/districts/warsaw/import-and-backfill", async () => {
  const imported = await importWarsawDistrictBoundaries();
  const streets = await importWarsawStreets();
  const enriched = await enrichListingsFromLocalStreets();
  const backfill = await backfillWarsawListingDistricts();
  return { imported, streets, enriched, backfill };
});

app.post("/api/collectors/rcn/import", async (request) => {
  const body = (request.body ?? {}) as { scope?: string };
  return rcnCollector.importScope(body.scope);
});

app.get<{ Params: { storageKey: string } }>("/api/media/:storageKey", async (request, reply) => {
  const storageKey = decodeURIComponent(request.params.storageKey);
  const filePath = findMediaFilePath(storageKey);

  if (!filePath) {
    reply.code(404);
    return { message: "Media not found" };
  }

  const bytes = await readFile(filePath);
  reply.header("Content-Type", getMimeType(filePath));
  return reply.send(bytes);
});

app.get("/api/roadmap", async () => ({
  phases: [
    {
      name: "foundation",
      items: [
        "collectors contract",
        "listing snapshots",
        "price events"
      ]
    },
    {
      name: "analytics",
      items: [
        "rcn import",
        "district medians",
        "alert rules"
      ]
    }
  ]
}));

const start = async () => {
  try {
    await ensureRuntimeSchema();
    listingAutomationPaused = await getListingAutomationPaused();
    await cleanupSeedData();
    await sanitizeBrokenPortalListings();
    await archiveListingsWithArchivedNotice();
    await restoreCriteriaExcludedListings();
    await sanitizeStoredListingAddresses();
    await backfillWarsawListingDistricts();
    await backfillEstimatedWarsawNeighborhoods();
    await app.listen({
      host: "0.0.0.0",
      port: 3001
    });
    void runScheduledListingRefresh();
    setInterval(() => void runScheduledListingRefresh(), scheduledRefreshIntervalMs).unref();
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "application/octet-stream";
}

function parseListingFilters(query: Record<string, string | undefined>): ListingFilters {
  return {
    city: query.city || undefined,
    district: query.district || undefined,
    minPrice: toNumber(query.minPrice),
    maxPrice: toNumber(query.maxPrice),
    minArea: toNumber(query.minArea),
    maxArea: toNumber(query.maxArea),
    minYearBuilt: toNumber(query.minYearBuilt),
    maxYearBuilt: toNumber(query.maxYearBuilt),
    minPricePerSqm: toNumber(query.minPricePerSqm),
    maxPricePerSqm: toNumber(query.maxPricePerSqm),
    roomsMin: toNumber(query.roomsMin),
    roomsMax: toNumber(query.roomsMax),
    search: query.search || undefined,
    shortlistedOnly: query.shortlistedOnly === "true",
    priceChangedOnly: query.priceChangedOnly === "true",
    archivedOnly: query.archivedOnly === "true",
    hiddenOnly: query.hiddenOnly === "true",
    includeAllCities: query.includeAllCities === "true",
    page: toPositiveInteger(query.page),
    pageSize: toPositiveInteger(query.pageSize),
    sort: toListingSort(query.sort)
  };
}

function toNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function toPositiveInteger(value?: string) {
  const numeric = toNumber(value);
  if (numeric === undefined) {
    return undefined;
  }

  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

function toListingSort(value?: string): ListingFilters["sort"] {
  const allowed: NonNullable<ListingFilters["sort"]>[] = ["newest", "oldest", "price_desc", "price_asc", "area_desc", "area_asc", "dream_desc"];
  return allowed.includes(value as NonNullable<ListingFilters["sort"]>)
    ? (value as NonNullable<ListingFilters["sort"]>)
    : undefined;
}
