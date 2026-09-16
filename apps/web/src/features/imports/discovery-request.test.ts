import assert from "node:assert/strict";
import test from "node:test";
import { discoveryRequest } from "./discovery-request";

test("long scan polls its job, tolerates a transient 504 and never submits the scan twice", async () => {
  const calls: Array<[string, string | undefined]> = [];
  const responses = [
    Response.json({ jobId: "scan-id" }, { status: 202 }),
    Response.json({ status: "running" }),
    new Response("timeout", { status: 504 }),
    Response.json({ status: "running" }),
    Response.json({ status: "completed", result: { scannedPages: 250, queued: 20 } }),
  ];
  const result = await discoveryRequest(
    async (url, options) => {
      calls.push([url, options?.method]);
      return responses.shift()!;
    },
    "/api/collectors/olx/discover-all",
    { method: "POST", body: "{}" },
    async () => {},
  );
  assert.deepEqual(await result.json(), { scannedPages: 250, queued: 20 });
  assert.deepEqual(calls[0], ["/api/collectors/olx/discover-all?background=1", "POST"]);
  assert.ok(
    calls
      .slice(1)
      .every(([url, method]) => url === "/api/collectors/discovery-jobs/scan-id" && !method),
  );
});

test("reattaches to an existing job and exposes scan errors", async () => {
  const responses = [
    Response.json({ jobId: "existing" }, { status: 409 }),
    Response.json({ status: "error", message: "portal unavailable" }),
  ];
  const result = await discoveryRequest(
    async () => responses.shift()!,
    "/api/collectors/olx/discover-all",
    {},
    async () => {},
  );
  assert.equal((await result.json()).error, "portal unavailable");
});

test("missing jobs and persistent polling failures stop without a new scan", async () => {
  for (const code of [404, 401, 504]) {
    let calls = 0;
    const result = await discoveryRequest(
      async () => {
        if (++calls === 1) return Response.json({ jobId: "id" }, { status: 202 });
        return new Response("unavailable", { status: code });
      },
      "/api/collectors/olx/discover-all",
      {},
      async () => {},
    );
    assert.equal(result.status, code);
    assert.equal(calls, code === 504 ? 4 : 2);
  }
});
