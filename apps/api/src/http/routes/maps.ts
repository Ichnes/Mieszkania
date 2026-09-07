import type { FastifyInstance } from "fastify";
import "../../config";
import { getWarsawRailwayMap } from "../../services/geography/railway-map";
import { enrichListingsFromLocalStreets } from "../../services/geography/street-enrichment-backfill";
import { getWarsawTramwayMap } from "../../services/geography/tramway-map";
import {
  backfillWarsawListingDistricts,
  importWarsawDistrictBoundaries,
} from "../../services/geography/warsaw-district-boundaries";
import { importWarsawStreets } from "../../services/geography/warsaw-street-importer";

export function registerMapsRoutes(app: FastifyInstance) {
  app.get("/api/map/railway", async () => getWarsawRailwayMap());

  app.get("/api/map/tramway", async () => getWarsawTramwayMap());

  app.post("/api/streets/warsaw/import", async () => importWarsawStreets());

  app.post("/api/streets/warsaw/enrich-listings", async () => enrichListingsFromLocalStreets());

  app.post("/api/streets/warsaw/import-and-enrich", async () => {
    const streets = await importWarsawStreets();
    const enriched = await enrichListingsFromLocalStreets();
    return { streets, enriched };
  });

  app.post("/api/districts/warsaw/import", async () => importWarsawDistrictBoundaries());

  app.post("/api/districts/warsaw/backfill-listings", async () => backfillWarsawListingDistricts());

  app.post("/api/districts/warsaw/import-and-backfill", async () => {
    const imported = await importWarsawDistrictBoundaries();
    const streets = await importWarsawStreets();
    const enriched = await enrichListingsFromLocalStreets();
    const backfill = await backfillWarsawListingDistricts();
    return { imported, streets, enriched, backfill };
  });
}
