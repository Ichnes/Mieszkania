import type { FastifyInstance } from "fastify";
import type { OtodomQueueStatusResponse, PortalQueueStatusesResponse } from "@mieszkania/shared";
import type { Collectors } from "../../../collectors/registry";

export function createQueueStatusReader(
  readers: Record<string, () => Promise<OtodomQueueStatusResponse>>,
  timeoutMs = 8_000,
) {
  const lastSuccess = new Map<string, string>();
  const inFlight = new Map<string, Promise<OtodomQueueStatusResponse>>();
  return async (): Promise<PortalQueueStatusesResponse> => ({
    portals: await Promise.all(
      Object.entries(readers).map(async ([sourceKey, read]) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          let pending = inFlight.get(sourceKey);
          if (!pending) {
            pending = Promise.resolve()
              .then(read)
              .finally(() => inFlight.delete(sourceKey));
            inFlight.set(sourceKey, pending);
          }
          const status = await Promise.race([
            pending,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("Queue status timeout")), timeoutMs);
            }),
          ]);
          const lastSuccessfulAt = new Date().toISOString();
          lastSuccess.set(sourceKey, lastSuccessfulAt);
          return { sourceKey, available: true as const, status, lastSuccessfulAt };
        } catch {
          return {
            sourceKey,
            available: false as const,
            lastSuccessfulAt: lastSuccess.get(sourceKey),
          };
        } finally {
          clearTimeout(timer);
        }
      }),
    ),
  });
}

export function registerQueueStatusRoutes(app: FastifyInstance, collectors: Collectors) {
  const read = createQueueStatusReader({
    otodom: () => collectors.otodomCollector.getQueueStatus(),
    gratka: () => collectors.gratkaCollector.getQueueStatus(),
    olx: () => collectors.olxCollector.getQueueStatus(),
    "nieruchomosci-online": () => collectors.nieruchomosciOnlineCollector.getQueueStatus(),
    domiporta: () => collectors.domiportaCollector.getQueueStatus(),
    maxon: () => collectors.maxonCollector.getQueueStatus(),
    adresowo: () => collectors.adresowoCollector.getQueueStatus(),
    morizon: () => collectors.morizonCollector.getQueueStatus(),
  });
  app.get("/api/collectors/queue-status", read);
}
