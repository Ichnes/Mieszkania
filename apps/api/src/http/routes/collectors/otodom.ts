import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { activeRegion } from "../../../domain/region";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";

export function registerCollectorsOtodomRoutes(app: FastifyInstance, collectors: Collectors) {
  const { otodomCollector } = collectors;
  app.get("/api/collectors/otodom/discovery-checkpoint", async (request) => {
    const { city } = request.query as { city?: string };
    return otodomCollector.discoveryCheckpoint(city ?? activeRegion.primaryCity.toLowerCase());
  });
  app.get("/api/collectors/otodom/discover", async (request) => {
    const query = request.query as {
      city?: string;
      page?: string;
      pages?: string;
      startPage?: string;
    };
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
      resume?: boolean;
      resumeKey?: string;
    };

    return otodomCollector.discoverAll({
      city: body.city ?? activeRegion.primaryCity.toLowerCase(),
      startPage: body.startPage,
      maxPages: body.maxPages,
      batchPages: body.batchPages,
      stopAfterEmptyBatches: body.stopAfterEmptyBatches,
      priority: body.priority,
      resume: body.resume === true,
      resumeKey: body.resumeKey,
    });
  });

  app.post<{ Body: { url: string } }>(
    "/api/collectors/otodom/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }

      return otodomCollector.collectOne(request.body.url);
    },
  );

  app.post("/api/collectors/otodom/collect-page", async (request) => {
    const body = (request.body ?? {}) as {
      city?: string;
      page?: number;
      startPage?: number;
      pages?: number;
      limit?: number;
    };
    return otodomCollector.collectPage({
      city: body.city ?? activeRegion.primaryCity.toLowerCase(),
      page: body.page,
      startPage: body.startPage,
      pages: body.pages,
      limit: body.limit,
    });
  });

  app.post("/api/collectors/otodom/process-queue", async (request) => {
    const body = (request.body ?? {}) as {
      limit?: number;
      concurrency?: number;
      downloadMedia?: boolean;
    };
    return otodomCollector.processQueue({
      limit: body.limit,
      concurrency: body.concurrency,
      downloadMedia: body.downloadMedia,
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
      downloadMedia: body.downloadMedia,
    });
  });

  app.get("/api/collectors/otodom/queue-status", async () => {
    return otodomCollector.getQueueStatus();
  });
}
