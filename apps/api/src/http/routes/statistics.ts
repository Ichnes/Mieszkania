import type { FastifyInstance } from "fastify";
import "../../config";
import { getMarketStats, type MarketStatsQuery } from "../../services/market/market-stats";

export function registerStatisticsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: MarketStatsQuery }>("/api/market-stats", async (request) =>
    getMarketStats(request.query),
  );
}
