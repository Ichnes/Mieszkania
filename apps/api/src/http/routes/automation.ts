import type { FastifyInstance } from "fastify";
import type { ListingAutomation } from "../../background/listing-refresh";
import "../../config";

export function registerAutomationRoutes(app: FastifyInstance, automation: ListingAutomation) {
  app.get("/api/listings/refresh-stale/status", async () => ({
    ...(await automation.status()),
    running: automation.running,
    automationPaused: automation.paused,
  }));

  app.post("/api/listings/refresh-stale", async () => {
    const result = await automation.refresh();
    void automation.run();
    return {
      ...result,
      started: !automation.paused && result.queued > 0,
      running: !automation.paused,
      automationPaused: automation.paused,
    };
  });

  app.post("/api/listings/automation/pause", async () => {
    await automation.pause();
    return { automationPaused: automation.paused, running: automation.running };
  });

  app.post("/api/listings/automation/resume", async () => {
    await automation.resume();
    return { automationPaused: automation.paused, running: automation.running };
  });

  app.post("/api/listings/automation/run", async () => {
    if (!automation.paused) void automation.run();
    return { automationPaused: automation.paused, running: automation.running };
  });
}
