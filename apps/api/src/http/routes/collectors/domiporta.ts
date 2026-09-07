import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";
import { deletePortalSourceData } from "../../../services/collecting/source-data-cleanup";

export function registerCollectorsDomiportaRoutes(app: FastifyInstance, collectors: Collectors) {
  const { domiportaCollector } = collectors;
  app.post("/api/collectors/domiporta/discover-all", async (request) => {
    const body = (request.body ?? {}) as {
      city?: string;
      startPage?: number;
      maxPages?: number;
      batchPages?: number;
      priority?: number;
    };
    return domiportaCollector.discoverAll({
      city: body.city ?? "warszawa",
      startPage: body.startPage,
      maxPages: body.maxPages,
      batchPages: body.batchPages,
      priority: body.priority,
    });
  });

  app.post("/api/collectors/domiporta/process-queue", async (request) => {
    const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
    return domiportaCollector.processQueue(body);
  });

  app.post("/api/collectors/domiporta/retry-failed", async (request) =>
    domiportaCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit),
  );

  app.post("/api/collectors/domiporta/reset-processing", async (request) =>
    resetProcessingListingImportsNow({
      sourceKey: "domiporta",
      limit: (request.body as { limit?: number } | undefined)?.limit,
    }),
  );

  app.get("/api/collectors/domiporta/queue-status", async () =>
    domiportaCollector.getQueueStatus(),
  );

  app.post("/api/collectors/domiporta/delete-data", async () =>
    deletePortalSourceData("domiporta"),
  );

  app.post<{ Body: { url: string } }>(
    "/api/collectors/domiporta/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }
      return domiportaCollector.collectOne(request.body.url);
    },
  );
}
