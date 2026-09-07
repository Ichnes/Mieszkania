import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";
import { deletePortalSourceData } from "../../../services/collecting/source-data-cleanup";

export function registerCollectorsAdresowoRoutes(app: FastifyInstance, collectors: Collectors) {
  const { adresowoCollector } = collectors;
  app.post("/api/collectors/adresowo/discover-all", async (request) => {
    const body = (request.body ?? {}) as {
      city?: string;
      startPage?: number;
      maxPages?: number;
      batchPages?: number;
      priority?: number;
    };
    return adresowoCollector.discoverAll({
      city: body.city ?? "warszawa",
      startPage: body.startPage,
      maxPages: body.maxPages,
      batchPages: body.batchPages,
      priority: body.priority,
    });
  });

  app.post("/api/collectors/adresowo/process-queue", async (request) => {
    const body = (request.body ?? {}) as { limit?: number; concurrency?: number };
    return adresowoCollector.processQueue(body);
  });

  app.post("/api/collectors/adresowo/retry-failed", async (request) =>
    adresowoCollector.retryFailed((request.body as { limit?: number } | undefined)?.limit),
  );

  app.post("/api/collectors/adresowo/backfill-published-dates", async (request) =>
    adresowoCollector.refreshPublishedDates(
      (request.body as { limit?: number } | undefined)?.limit,
    ),
  );

  app.post("/api/collectors/adresowo/reset-processing", async (request) =>
    resetProcessingListingImportsNow({
      sourceKey: "adresowo",
      limit: (request.body as { limit?: number } | undefined)?.limit,
    }),
  );

  app.get("/api/collectors/adresowo/queue-status", async () => adresowoCollector.getQueueStatus());

  app.post("/api/collectors/adresowo/delete-data", async () => deletePortalSourceData("adresowo"));

  app.post<{ Body: { url: string } }>(
    "/api/collectors/adresowo/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }
      return adresowoCollector.collectOne(request.body.url);
    },
  );
}
