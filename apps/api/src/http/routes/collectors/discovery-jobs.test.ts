import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerDiscoveryJobRoutes, runDiscoveryRequest } from "./discovery-jobs";

test("scan accepts immediately, rejects duplicates, retains each result and supports synchronous clients", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  registerDiscoveryJobRoutes(app);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const result = { scannedPages: 250, queued: 17, stoppedBecause: "max_pages", extra: "retained" };
  app.post("/scan", (request, reply) =>
    runDiscoveryRequest(request, reply, "job-test", async () => {
      calls++;
      await gate;
      return result;
    }),
  );
  const accepted = await app.inject({ method: "POST", url: "/scan?background=1" });
  assert.equal(accepted.statusCode, 202);
  const id = accepted.json().jobId;
  const read = () => app.inject(`/api/collectors/discovery-jobs/${id}`);
  assert.equal((await read()).json().status, "running");
  const duplicate = await app.inject({ method: "POST", url: "/scan?background=1" });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().jobId, id);
  assert.equal(calls, 1);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual((await read()).json().result, result);
  const next = await app.inject({ method: "POST", url: "/scan?background=1" });
  assert.notEqual(next.json().jobId, id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual((await read()).json().result, result);
  const sync = await app.inject({ method: "POST", url: "/scan" });
  assert.equal(sync.statusCode, 200);
  assert.deepEqual(sync.json(), result);
  assert.equal((await app.inject("/api/collectors/discovery-jobs/missing")).statusCode, 404);
});

test("background failures become a readable terminal state without unhandled rejection", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  registerDiscoveryJobRoutes(app);
  app.post("/scan", (request, reply) =>
    runDiscoveryRequest(request, reply, "job-failure", async () => {
      throw new Error("portal unavailable");
    }),
  );
  const accepted = await app.inject({ method: "POST", url: "/scan?background=1" });
  await new Promise((resolve) => setImmediate(resolve));
  const status = await app.inject(`/api/collectors/discovery-jobs/${accepted.json().jobId}`);
  assert.equal(status.json().status, "error");
  assert.equal(status.json().message, "portal unavailable");
});
