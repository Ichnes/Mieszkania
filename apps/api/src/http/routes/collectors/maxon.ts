import { withDiscoveryProgress } from "../../../collectors/discovery-progress";
import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";
import { deletePortalSourceData } from "../../../services/collecting/source-data-cleanup";

export function registerCollectorsMaxonRoutes(app: FastifyInstance, collectors: Collectors) {
  const { maxonCollector } = collectors;
  app.post("/api/collectors/maxon/discover-all", async (request) => {
    const body = (request.body ?? {}) as {
      city?: string;
      startPage?: number;
      maxPages?: number;
      batchPages?: number;
      priority?: number;
    };
    return withDiscoveryProgress("maxon", () =>
      maxonCollector.discoverAll({
        city: body.city ?? "warszawa",
        startPage: body.startPage,
        maxPages: body.maxPages,
        batchPages: body.batchPages,
        priority: body.priority,
      }),
    );
  });

  app.post("/api/collectors/maxon/process-queue", async (request) => {
    const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
    return maxonCollector.processQueue(body);
  });

  app.post("/api/collectors/maxon/retry-failed", async (request) =>
    maxonCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit),
  );

  app.post("/api/collectors/maxon/reset-processing", async (request) =>
    resetProcessingListingImportsNow({
      sourceKey: "maxon",
      limit: (request.body as { limit?: number } | undefined)?.limit,
    }),
  );

  app.get("/api/collectors/maxon/queue-status", async () => maxonCollector.getQueueStatus());

  app.post("/api/collectors/maxon/delete-data", async () => deletePortalSourceData("maxon"));

  app.post<{ Body: { url: string } }>(
    "/api/collectors/maxon/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }
      return maxonCollector.collectOne(request.body.url);
    },
  );
}
