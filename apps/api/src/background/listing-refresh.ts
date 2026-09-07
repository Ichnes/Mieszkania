import type { FastifyInstance } from "fastify";
import type { Collectors } from "../collectors/registry";
import "../config";
import { withDb } from "../db";
import {
  getListingAutomationPaused,
  setListingAutomationPaused,
} from "../services/collecting/listing-automation";
import { enqueueStaleListingPriceUpdates } from "../services/collecting/listing-import-queue";
export function createListingAutomation(app: FastifyInstance, collectors: Collectors) {
  const {
    otodomCollector,
    gratkaCollector,
    olxCollector,
    nieruchomosciOnlineCollector,
    domiportaCollector,
    maxonCollector,
    adresowoCollector,
    morizonCollector,
  } = collectors;
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
    {
      sourceKey: "otodom",
      batchSize: 200,
      process: () => otodomCollector.processQueue({ limit: 200, concurrency: 8 }),
    },
    {
      sourceKey: "gratka",
      batchSize: 200,
      process: () => gratkaCollector.processQueue({ limit: 200, concurrency: 8 }),
    },
    {
      sourceKey: "olx",
      batchSize: 200,
      process: () => olxCollector.processQueue({ limit: 200, concurrency: 8 }),
    },
    {
      sourceKey: "nieruchomosci_online",
      batchSize: 15,
      process: () => nieruchomosciOnlineCollector.processQueue({ limit: 15, concurrency: 1 }),
    },
    {
      sourceKey: "domiporta",
      batchSize: 200,
      process: () => domiportaCollector.processQueue({ limit: 200, concurrency: 8 }),
    },
    {
      sourceKey: "maxon",
      batchSize: 200,
      process: () => maxonCollector.processQueue({ limit: 200, concurrency: 8 }),
    },
    {
      sourceKey: "adresowo",
      batchSize: 200,
      process: () => adresowoCollector.processQueue({ limit: 200, concurrency: 8 }),
    },
    {
      sourceKey: "morizon",
      batchSize: 200,
      process: () => morizonCollector.processQueue({ limit: 200, concurrency: 4 }),
    },
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
        lastCheckedAt: row?.last_checked_at ?? undefined,
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
    } finally {
      staleRefreshRunning = false;
    }
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
      await Promise.all(
        scheduledPortalProcessors.map(async ({ sourceKey, batchSize, process }) => {
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
              app.log.info(
                { sourceKey, claimed, completed, failed },
                "Scheduled listing refresh finished",
              );
            }
          } catch (error) {
            app.log.warn({ err: error, sourceKey }, "Scheduled portal refresh failed");
          }
        }),
      );
    } catch (error) {
      app.log.warn(error, "Scheduled listing refresh failed");
    } finally {
      scheduledRefreshRunning = false;
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    get paused() {
      return listingAutomationPaused;
    },
    get running() {
      return staleRefreshRunning || scheduledRefreshRunning;
    },
    status: getStaleListingStatus,
    refresh: refreshStaleListings,
    run: runScheduledListingRefresh,
    async initialize() {
      listingAutomationPaused = await getListingAutomationPaused();
    },
    async pause() {
      listingAutomationPaused = await setListingAutomationPaused(true);
    },
    async resume() {
      listingAutomationPaused = await setListingAutomationPaused(false);
    },
    start() {
      void runScheduledListingRefresh();
      timer = setInterval(() => void runScheduledListingRefresh(), scheduledRefreshIntervalMs);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
export type ListingAutomation = ReturnType<typeof createListingAutomation>;
