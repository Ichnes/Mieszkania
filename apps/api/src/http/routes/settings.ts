import { type FamilySettings } from "@mieszkania/shared";
import type { FastifyInstance } from "fastify";
import "../../config";
import { restoreCriteriaExcludedListings } from "../../services/collecting/search-contract-enforcer";
import { getFamilySettings, updateFamilySettings } from "../../services/settings/family-settings";

export function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/api/settings/family", async () => getFamilySettings());

  app.post<{ Body: FamilySettings }>("/api/settings/family", async (request) => {
    const settings = await updateFamilySettings(request.body);
    await restoreCriteriaExcludedListings();
    return settings;
  });
}
