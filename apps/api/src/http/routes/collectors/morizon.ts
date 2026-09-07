import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";
import { deletePortalSourceData } from "../../../services/collecting/source-data-cleanup";

export function registerCollectorsMorizonRoutes(app: FastifyInstance, collectors: Collectors) {
  const { morizonCollector } = collectors;
  app.post("/api/collectors/morizon/discover-all", async (request) => {
    const body = (request.body ?? {}) as {
      city?: string;
      startPage?: number;
      maxPages?: number;
      batchPages?: number;
      priority?: number;
    };
    return morizonCollector.discoverAll({
      city: body.city ?? "warszawa",
      startPage: body.startPage,
      maxPages: body.maxPages,
      batchPages: body.batchPages,
      priority: body.priority,
    });
  });

  app.post("/api/collectors/morizon/process-queue", async (request) => {
    const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
    return morizonCollector.processQueue(body);
  });

  app.post("/api/collectors/morizon/retry-failed", async (request) =>
    morizonCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit),
  );

  app.post("/api/collectors/morizon/reset-processing", async (request) =>
    resetProcessingListingImportsNow({
      sourceKey: "morizon",
      limit: (request.body as { limit?: number } | undefined)?.limit,
    }),
  );

  app.get("/api/collectors/morizon/queue-status", async () => morizonCollector.getQueueStatus());

  app.post("/api/collectors/morizon/delete-data", async () => deletePortalSourceData("morizon"));

  app.post<{ Body: { url: string } }>(
    "/api/collectors/morizon/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }
      return morizonCollector.collectOne(request.body.url);
    },
  );
}
