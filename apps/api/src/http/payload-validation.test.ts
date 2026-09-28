import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createDefaultFamilySettings } from "@mieszkania/shared";
import { registerPayloadValidation, validatePayload } from "./payload-validation";

test("payload validation preserves current forms and rejects invalid types before writes", async () => {
  assert.equal(validatePayload(createDefaultFamilySettings()), true);
  for (const value of [
    null,
    [],
    { shortlisted: "false" },
    { limit: -1 },
    { limit: 2.5 },
    { notes: {} },
    { status: "unknown" },
    { listingId: "bad" },
    { workplaces: [{}, null] },
    { notes: "x".repeat(20001) },
    { unknown: true },
  ])
    assert.equal(validatePayload(value), false, JSON.stringify(value).slice(0, 100));
  assert.equal(
    validatePayload({
      notes: "",
      exposureDirectionsOverride: [],
      hasGarageOverride: false,
      garageCostOverride: 0,
    }),
    true,
  );
  const app = Fastify();
  registerPayloadValidation(app);
  let writes = 0;
  app.post("/api/listings/:id/manual", async () => {
    writes++;
    return { ok: true };
  });
  try {
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/listings/bad/manual", payload: {} }))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/listings/00000000-0000-0000-0000-000000000001/manual",
          payload: { notes: 42 },
        })
      ).statusCode,
      400,
    );
    assert.equal(writes, 0);
  } finally {
    await app.close();
  }
});
