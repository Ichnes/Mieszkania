import type { FastifyInstance } from "fastify";
import { validDecisionNote } from "./routes/decision-notes";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const booleans = new Set([
  "shortlisted",
  "resume",
  "downloadMedia",
  "hasLiftOverride",
  "hasGarageOverride",
  "hasStorageOverride",
  "requiresGarage",
  "prefersBalcony",
]);
const integers = new Set([
  "limit",
  "concurrency",
  "page",
  "pages",
  "startPage",
  "maxPages",
  "batchPages",
  "stopAfterEmptyBatches",
  "priority",
  "roomsMin",
  "minRooms",
  "processLimit",
  "maxRounds",
]);
const numbers = new Set([
  "negotiatedPriceAmount",
  "askingPriceOverride",
  "garageCostOverride",
  "storageCostOverride",
  "amount",
  "minPrice",
  "maxPrice",
  "minArea",
  "maxArea",
  "maxPricePerSqm",
  "maxMetroDistanceMeters",
  "downPayment",
  "latitude",
  "longitude",
]);
const strings = new Set([
  "email",
  "password",
  "url",
  "city",
  "scope",
  "resumeKey",
  "contactName",
  "contactPhone",
  "contactRole",
  "notes",
  "sourceNotes",
  "title",
  "address",
  "key",
  "label",
  "confirmation",
]);
const enums: Record<string, string[]> = {
  refreshMode: ["full", "price_only"],
  contactStatus: ["new", "contacted", "negotiating", "viewing_scheduled", "rejected", "closed"],
  decisionStage: [
    "new",
    "to_call",
    "after_call",
    "to_viewing",
    "after_viewing",
    "to_offer",
    "rejected",
    "bought",
  ],
  eventType: [
    "call",
    "message",
    "email",
    "meeting",
    "viewing_note",
    "negotiation",
    "status_change",
    "other",
  ],
  status: ["same_listing", "different_listing", "scheduled", "completed", "cancelled"],
};
const ids = new Set(["listingId", "primaryListingId", "duplicateListingId", "leftId", "rightId"]);
const dates = new Set(["scheduledAt", "occurredAt", "lastContactAt"]);
const stringArrays = new Set(["districts", "preferredDistricts", "exposureDirectionsOverride"]);
const objects = new Set(["financing", "searchContract", "dreamProfile"]);

export function validatePayload(body: unknown, depth = 0): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body) || depth > 3) return false;
  return Object.entries(body).every(([key, value]) => {
    if (booleans.has(key)) return typeof value === "boolean";
    if (integers.has(key))
      return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000;
    if (numbers.has(key))
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        Math.abs(value) <= 1e11 &&
        (key === "latitude"
          ? Math.abs(value) <= 90
          : key === "longitude"
            ? Math.abs(value) <= 180
            : value >= 0)
      );
    if (strings.has(key))
      return (
        typeof value === "string" &&
        value.length <=
          (key === "notes" || key === "sourceNotes" ? 20_000 : key === "url" ? 4096 : 1000)
      );
    if (ids.has(key)) return typeof value === "string" && uuid.test(value);
    if (dates.has(key))
      return (
        typeof value === "string" &&
        value.length <= 40 &&
        (value === "" || Number.isFinite(Date.parse(value)))
      );
    if (enums[key]) return typeof value === "string" && enums[key].includes(value);
    if (stringArrays.has(key))
      return (
        Array.isArray(value) &&
        value.length <= 200 &&
        value.every((item) => typeof item === "string" && item.length <= 200)
      );
    if (objects.has(key)) return validatePayload(value, depth + 1);
    if (key === "workplaces")
      return (
        Array.isArray(value) &&
        value.length <= 20 &&
        value.every((item) => validatePayload(item, depth + 1))
      );
    return false;
  });
}

export function registerPayloadValidation(app: FastifyInstance) {
  app.addHook("preValidation", async (request, reply) => {
    const params = request.params as Record<string, unknown>;
    if (
      params?.id !== undefined &&
      typeof params.id === "string" &&
      request.url.startsWith("/api/listings/") &&
      !uuid.test(params.id)
    )
      return reply.code(400).send({ message: "Nieprawidłowy identyfikator oferty." });
    const decisionNote = /^\/api\/listings\/[0-9a-f-]+\/decision-notes(?:\?|$)/i.test(request.url);
    if (
      request.body !== undefined &&
      !(decisionNote ? validDecisionNote(request.body) : validatePayload(request.body))
    )
      return reply.code(400).send({ message: "Nieprawidłowy format danych formularza." });
    const body = request.body as Record<string, unknown> | undefined;
    const path = request.url.split("?")[0];
    if (
      path === "/api/settings/family" &&
      request.method === "POST" &&
      (!body || !Array.isArray(body.workplaces) || !body.searchContract || !body.dreamProfile)
    )
      return reply.code(400).send({ message: "Prześlij kompletne preferencje wyszukiwania." });
    if (
      body?.status !== undefined &&
      ((path.endsWith("/viewing") &&
        !["scheduled", "completed", "cancelled"].includes(String(body.status))) ||
        (path === "/api/duplicates/review" &&
          !["same_listing", "different_listing"].includes(String(body.status))))
    )
      return reply.code(400).send({ message: "Nieprawidłowy status." });
  });
}
