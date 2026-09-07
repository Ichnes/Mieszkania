import { warsawMetropolitanRegion } from "@mieszkania/shared";
import type { FastifyInstance } from "fastify";
import "../../config";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "mieszkania-api",
    date: new Date().toISOString(),
  }));

  app.get("/api/region", async () => warsawMetropolitanRegion);
}
