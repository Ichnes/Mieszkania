import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";
import { resetProcessingListingImportsNow } from "../../../services/collecting/listing-import-queue";
import { deletePortalSourceData } from "../../../services/collecting/source-data-cleanup";

export function registerCollectorsNieruchomosciOnlineRoutes(
  app: FastifyInstance,
  collectors: Collectors,
) {
  const { nieruchomosciOnlineCollector } = collectors;
  app.post("/api/collectors/nieruchomosci-online/discover-all", async (request) => {
    const body = (request.body ?? {}) as {
      city?: string;
      startPage?: number;
      maxPages?: number;
      batchPages?: number;
      priority?: number;
    };
    return nieruchomosciOnlineCollector.discoverAll({
      city: body.city ?? "warszawa",
      startPage: body.startPage,
      maxPages: body.maxPages,
      batchPages: body.batchPages,
      priority: body.priority,
    });
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
    return resetProcessingListingImportsNow({
      sourceKey: "nieruchomosci_online",
      limit: body.limit,
    });
  });

  app.get("/api/collectors/nieruchomosci-online/queue-status", async () =>
    nieruchomosciOnlineCollector.getQueueStatus(),
  );

  app.post("/api/collectors/nieruchomosci-online/delete-data", async () =>
    deletePortalSourceData("nieruchomosci_online"),
  );

  app.post<{ Body: { url: string } }>(
    "/api/collectors/nieruchomosci-online/collect-one",
    async (request, reply) => {
      if (!request.body?.url) {
        reply.code(400);
        return { message: "Missing url" };
      }
      return nieruchomosciOnlineCollector.collectOne(request.body.url);
    },
  );
}
