import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app";

test("API factory registers routes without starting a server or automation", async () => {
  const { app } = createApp();
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().status, "ok");
    const region = await app.inject({ method: "GET", url: "/api/region" });
    assert.equal(region.statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/roadmap" })).statusCode, 404);
    assert.equal((await app.inject({ method: "OPTIONS", url: "/api/listings" })).statusCode, 204);
  } finally {
    await app.close();
  }
});
