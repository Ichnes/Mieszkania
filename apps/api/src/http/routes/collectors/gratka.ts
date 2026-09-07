import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { activeRegion } from "../../../domain/region";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";

export function registerCollectorsGratkaRoutes(app: FastifyInstance, collectors: Collectors) {
  const { gratkaCollector } = collectors;
  app.get("/api/collectors/gratka/discover", async (request) => {
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
      priority: body.priority,
    });
  });

  app.post("/api/collectors/gratka/process-queue", async (request) => {
    const body = (request.body ?? {}) as {
      limit?: number;
      concurrency?: number;
      downloadMedia?: boolean;
    };
    return gratkaCollector.processQueue({
      limit: body.limit,
      concurrency: body.concurrency,
      downloadMedia: body.downloadMedia,
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
      downloadMedia: body.downloadMedia,
    });
  });

  app.post<{ Body: { url: string; refreshMode?: "full" | "price_only" } }>(
    "/api/collectors/gratka/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }

      return gratkaCollector.collectOne(request.body.url, {
        refreshMode: request.body.refreshMode,
      });
    },
  );

  app.get("/api/collectors/gratka/queue-status", async () => {
    return gratkaCollector.getQueueStatus();
  });
}
