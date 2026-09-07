import { type UpcomingViewingsResponse } from "@mieszkania/shared";
import type { FastifyInstance } from "fastify";
import "../../config";
import { getUpcomingViewings } from "../../services/listings/listing-viewings";

export function registerViewingsRoutes(app: FastifyInstance) {
  app.get("/api/viewings/upcoming", async () => buildUpcomingViewingsResponse());
}

const buildUpcomingViewingsResponse = async (): Promise<UpcomingViewingsResponse> => {
  return getUpcomingViewings();
};
