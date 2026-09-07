import { type AlertsResponse, type DashboardResponse } from "@mieszkania/shared";
import type { FastifyInstance } from "fastify";
import "../../config";
import { activeRegion } from "../../domain/region";
import { getDashboardContext } from "../../services/listings/listing-repository";
import { getAlerts } from "../../services/market/alert-repository";

export function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", async () => buildDashboardResponse());

  app.get("/api/alerts", async () => buildAlertsResponse());
}

const buildDashboardResponse = async (): Promise<DashboardResponse> => {
  const context = await getDashboardContext();

  return {
    market: activeRegion.primaryCity,
    stats: context.stats,
    listings: context.listings,
  };
};

const buildAlertsResponse = async (): Promise<AlertsResponse> => {
  const items = await getAlerts();

  return {
    total: items.length,
    items,
  };
};
