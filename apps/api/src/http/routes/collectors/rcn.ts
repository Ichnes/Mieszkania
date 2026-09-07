import type { FastifyInstance } from "fastify";
import type { Collectors } from "../../../collectors/registry";
import "../../../config";

export function registerCollectorsRcnRoutes(app: FastifyInstance, collectors: Collectors) {
  const { rcnCollector } = collectors;
  app.get("/api/collectors/rcn/plan", async () => {
    return rcnCollector.planWarsawAreaImport();
  });

  app.get("/api/collectors/rcn/inspect", async (request) => {
    const query = request.query as { scope?: string };
    return rcnCollector.inspectCapabilities(query.scope);
  });

  app.post("/api/collectors/rcn/import", async (request) => {
    const body = (request.body ?? {}) as { scope?: string };
    return rcnCollector.importScope(body.scope);
  });
}
