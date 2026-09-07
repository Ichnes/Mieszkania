import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";
import { deletePortalSourceData } from "../../../services/collecting/source-data-cleanup";

export function registerCollectorsOlxRoutes(app: FastifyInstance, collectors: Collectors) {
  const { olxCollector } = collectors;
  app.get("/api/collectors/olx/discover", async (request) => {
    const query = request.query as {
      city?: string;
      page?: string;
      pages?: string;
      startPage?: string;
    };
    return olxCollector.discover({
      city: query.city ?? "warszawa",
      page: query.page ? Number(query.page) : undefined,
      pages: query.pages ? Number(query.pages) : undefined,
      startPage: query.startPage ? Number(query.startPage) : undefined,
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
      priority: body.priority,
    });
  });

  app.post("/api/collectors/olx/process-queue", async (request) => {
    const body = (request.body ?? {}) as {
      limit?: number;
      concurrency?: number;
      downloadMedia?: boolean;
    };
    return olxCollector.processQueue({
      limit: body.limit,
      concurrency: body.concurrency,
      downloadMedia: body.downloadMedia,
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

  app.post<{ Body: { url: string } }>("/api/collectors/olx/collect-one", async (request, reply) => {
    if (!request.body?.url) {
      reply.code(400);
      return { message: "Missing url" };
    }

    return olxCollector.collectOne(request.body.url);
  });

  app.get("/api/collectors/olx/queue-status", async () => {
    return olxCollector.getQueueStatus();
  });
}
