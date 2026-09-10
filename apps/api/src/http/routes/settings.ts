import { type FamilySettings } from "@mieszkania/shared";
import type { FastifyInstance } from "fastify";
import "../../config";
import { restoreCriteriaExcludedListings } from "../../services/collecting/search-contract-enforcer";
import {
  getFamilySettings,
  updateFamilySettings,
  validateWorkplacePoints,
} from "../../services/settings/family-settings";
import { searchWorkplaceAddress } from "../../services/geography/workplace-search";

export function registerSettingsRoutes(app: FastifyInstance) {
  app.post<{ Body: { address?: string } }>(
    "/api/settings/workplace-search",
    async (request, reply) => {
      const address = request.body?.address;
      if (typeof address !== "string" || address.trim().length < 5 || address.length > 250) {
        return reply.code(400).send({ message: "Wpisz ulicę, numer budynku i miejscowość." });
      }
      try {
        return await searchWorkplaceAddress(address);
      } catch {
        return reply
          .code(503)
          .send({
            message: "Nie udało się wyszukać adresu. Wskaż punkt na mapie lub spróbuj później.",
          });
      }
    },
  );
  app.get("/api/settings/family", async () => getFamilySettings());

  app.post<{ Body: FamilySettings }>("/api/settings/family", async (request, reply) => {
    try {
      validateWorkplacePoints(request.body.workplaces);
    } catch {
      return reply
        .code(400)
        .send({ message: "Uzupełnij adresy i wybierz punkty miejsc pracy na mapie." });
    }
    const settings = await updateFamilySettings(request.body);
    await restoreCriteriaExcludedListings();
    return settings;
  });
}
