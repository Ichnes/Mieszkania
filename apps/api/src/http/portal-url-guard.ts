import type { FastifyInstance } from "fastify";
const hosts: Record<string, string> = {
  otodom: "otodom.pl",
  gratka: "gratka.pl",
  olx: "olx.pl",
  "nieruchomosci-online": "nieruchomosci-online.pl",
  domiporta: "domiporta.pl",
  maxon: "maxon.pl",
  adresowo: "adresowo.pl",
  morizon: "morizon.pl",
};
export function isPortalUrl(source: string, value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const host = hosts[source];
    return (
      Boolean(host) &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === host || url.hostname.endsWith("." + host))
    );
  } catch {
    return false;
  }
}
export function registerPortalUrlGuard(app: FastifyInstance) {
  app.addHook("preValidation", async (request, reply) => {
    const match = request.url.split("?")[0].match(/^\/api\/collectors\/([^/]+)\/collect-one$/);
    if (match && !isPortalUrl(match[1], (request.body as { url?: unknown } | undefined)?.url))
      return reply.code(400).send({ message: "Wklej link HTTPS do oferty z wybranego portalu." });
  });
}
