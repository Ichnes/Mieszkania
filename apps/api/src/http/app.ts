import Fastify from "fastify";
import { registerAuth } from "./auth";
import { registerPortalUrlGuard } from "./portal-url-guard";
import { createListingAutomation } from "../background/listing-refresh";
import { createCollectors } from "../collectors/registry";
import { registerAutomationRoutes } from "./routes/automation";
import { registerCollectorsAdresowoRoutes } from "./routes/collectors/adresowo";
import { registerCollectorsDomiportaRoutes } from "./routes/collectors/domiporta";
import { registerCollectorsGratkaRoutes } from "./routes/collectors/gratka";
import { registerCollectorsMaxonRoutes } from "./routes/collectors/maxon";
import { registerCollectorsMorizonRoutes } from "./routes/collectors/morizon";
import { registerCollectorsNieruchomosciOnlineRoutes } from "./routes/collectors/nieruchomosci-online";
import { registerCollectorsOlxRoutes } from "./routes/collectors/olx";
import { registerCollectorsOtodomRoutes } from "./routes/collectors/otodom";
import { registerCollectorsRcnRoutes } from "./routes/collectors/rcn";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerDuplicatesRoutes } from "./routes/duplicates";
import { registerHealthRoutes } from "./routes/health";
import { registerListingsRoutes } from "./routes/listings";
import { registerMapsRoutes } from "./routes/maps";
import { registerMediaRoutes } from "./routes/media";
import { registerSettingsRoutes } from "./routes/settings";
import { registerStatisticsRoutes } from "./routes/statistics";
import { registerViewingsRoutes } from "./routes/viewings";

export function createApp(options: { auth?: Parameters<typeof registerAuth>[1] } = {}) {
  const app = Fastify({ logger: true });
  registerAuth(app, options.auth);
  registerPortalUrlGuard(app);
  const collectors = createCollectors();
  const automation = createListingAutomation(app, collectors);
  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500)
      return reply.code(status).send({ message: "Nieprawidłowe żądanie." });
    app.log.error(error, "API request failed");
    reply.code(500).send({ message: "Operacja nie powiodła się. API nadal działa." });
  });

  app.options("/*", async (_request, reply) => {
    reply.code(204).send();
  });
  registerStatisticsRoutes(app);
  registerAutomationRoutes(app, automation);
  registerHealthRoutes(app);
  registerDashboardRoutes(app);
  registerListingsRoutes(app);
  registerMapsRoutes(app);
  registerSettingsRoutes(app);
  registerDuplicatesRoutes(app);
  registerViewingsRoutes(app);
  registerCollectorsOtodomRoutes(app, collectors);
  registerCollectorsGratkaRoutes(app, collectors);
  registerCollectorsOlxRoutes(app, collectors);
  registerCollectorsNieruchomosciOnlineRoutes(app, collectors);
  registerCollectorsDomiportaRoutes(app, collectors);
  registerCollectorsMaxonRoutes(app, collectors);
  registerCollectorsAdresowoRoutes(app, collectors);
  registerCollectorsMorizonRoutes(app, collectors);
  registerMediaRoutes(app);
  registerCollectorsRcnRoutes(app, collectors);
  app.addHook("onClose", async () => automation.stop());
  return { app, automation };
}
