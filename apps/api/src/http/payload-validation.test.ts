import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { createDefaultFamilySettings } from "@mieszkania/shared";
import { registerPayloadValidation, validatePayload } from "./payload-validation";

test("payload validation preserves current forms and rejects invalid types before writes", async () => {
  assert.equal(validatePayload(createDefaultFamilySettings()), true);
  assert.equal(
    validatePayload({
      ...createDefaultFamilySettings(),
      workplaces: [{ key: "home", label: "Dom", address: "", workMode: "remote" }],
      financing: { downPayment: 400000, maxMonthlyPayment: 6500 },
    }),
    true,
  );
  assert.equal(validatePayload({ workplaces: [{ workMode: "other" }] }), false);
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

test("archive duplicate and relisting forms reach handlers through global validation", async () => {
  const app = Fastify();
  registerPayloadValidation(app);
  const current = "00000000-0000-0000-0000-000000000001";
  const previous = "00000000-0000-0000-0000-000000000002";
  const relistingUrl = `/api/listings/${current}/relisting-review`;
  const received: unknown[] = [];
  for (const url of ["/api/duplicates/review", "/api/listings/:id/relisting-review"])
    app.post(url, async (request) => {
      received.push(request.body);
      return { ok: true };
    });
  try {
    const forms = [
      {
        url: "/api/duplicates/review",
        payload: {
          leftId: previous,
          rightId: current,
          primaryListingId: previous,
          status: "same_listing",
        },
      },
      {
        url: "/api/duplicates/review",
        payload: { leftId: previous, rightId: current, status: "different_listing" },
      },
      ...["confirmed", "rejected"].map((decision) => ({
        url: relistingUrl,
        payload: { previousId: previous, decision },
      })),
    ];
    for (const form of forms) {
      const response = await app.inject({ method: "POST", ...form });
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(received.at(-1), form.payload);
    }
    for (const payload of [
      { previousId: "bad", decision: "confirmed" },
      { previousId: previous, decision: "same_listing" },
      { previousId: previous, decision: true },
      { previousId: previous, decision: "confirmed", unexpected: true },
    ])
      assert.equal(
        (await app.inject({ method: "POST", url: relistingUrl, payload })).statusCode,
        400,
      );
    assert.equal(received.length, forms.length, "invalid input must not reach a write handler");
  } finally {
    await app.close();
  }
});
