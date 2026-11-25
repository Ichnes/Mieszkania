import type { FastifyInstance } from "fastify";
import "../../config";
import { getOfferComparison } from "../../services/market/buyer-market";
import { getMarketStats, type MarketStatsQuery } from "../../services/market/market-stats";

export function registerStatisticsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/listings/:id/market-comparison",
    async (request, reply) => {
      if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(request.params.id))
        return reply.code(400).send();
      return getOfferComparison(request.params.id);
    },
  );
  app.get<{ Querystring: MarketStatsQuery }>("/api/market-stats", async (request) =>
    getMarketStats(request.query),
  );
}
