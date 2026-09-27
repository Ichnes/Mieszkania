import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { OtodomQueueStatusResponse } from "@mieszkania/shared";
import type { Collectors } from "../../../collectors/registry";
import { createQueueStatusReader, registerQueueStatusRoutes } from "./queue-status";

const status = (sourceKey = "otodom"): OtodomQueueStatusResponse => ({
  sourceKey,
  counts: { pending: 2, processing: 0, completed: 4, failed: 1 },
  pendingNew: 1,
  pendingPriceUpdates: 1,
  readyPending: 1,
  delayedPending: 1,
  nextAttemptAt: "2026-09-28T12:00:00Z",
  recentFailures: [],
});

test("combined route covers all eight portals and retains each queue payload", async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  const keys = [
    "otodom",
    "gratka",
    "olx",
    "nieruchomosciOnline",
    "domiporta",
    "maxon",
    "adresowo",
    "morizon",
  ];
  const calls: string[] = [];
  const collectors = Object.fromEntries(
    keys.map((key) => [
      `${key}Collector`,
      {
        getQueueStatus: async () => {
          calls.push(key);
          return status(key);
        },
      },
    ]),
  ) as unknown as Collectors;
  registerQueueStatusRoutes(app, collectors);
  const result = await app.inject("/api/collectors/queue-status");
  assert.equal(result.statusCode, 200);
  const portals = result.json().portals;
  assert.equal(portals.length, 8);
  assert.equal(calls.length, 8);
  assert.ok(
    portals.some((item: { sourceKey: string }) => item.sourceKey === "nieruchomosci-online"),
  );
  for (const item of portals) {
    assert.equal(item.available, true);
    assert.deepEqual(item.status, status(item.status.sourceKey));
    assert.ok(Number.isFinite(Date.parse(item.lastSuccessfulAt)));
  }
});

test("partial failure retains last successful timestamp and recovery supplies fresh data", async () => {
  let failing = false;
  const read = createQueueStatusReader({
    good: async () => status("good"),
    flaky: async () => {
      if (failing) throw new Error("private database error");
      return status("flaky");
    },
  });
  const first = await read();
  failing = true;
  const second = await read();
  assert.equal(second.portals[0].available, true);
  assert.deepEqual(second.portals[1], {
    sourceKey: "flaky",
    available: false,
    lastSuccessfulAt: first.portals[1].lastSuccessfulAt,
  });
  assert.ok(!JSON.stringify(second).includes("private database error"));
  failing = false;
  assert.equal((await read()).portals[1].available, true);
});

test("slow portal times out independently and concurrent polls reuse its pending read", async () => {
  let calls = 0;
  let release!: (value: OtodomQueueStatusResponse) => void;
  const pending = new Promise<OtodomQueueStatusResponse>((resolve) => {
    release = resolve;
  });
  const read = createQueueStatusReader(
    {
      good: async () => status(),
      slow: () => {
        calls++;
        return pending;
      },
    },
    15,
  );
  const results = await Promise.all([read(), read()]);
  for (const result of results) {
    assert.equal(result.portals[0].available, true);
    assert.equal(result.portals[1].available, false);
  }
  assert.equal(calls, 1);
  release(status("slow"));
  await pending;
  assert.equal((await read()).portals[1].available, true);
});

test("failure of every portal returns individual unavailable states", async () => {
  const fail = () => {
    throw new Error("offline");
  };
  const result = await createQueueStatusReader({ first: fail, second: fail })();
  assert.ok(result.portals.every((portal) => !portal.available && !portal.lastSuccessfulAt));
});
