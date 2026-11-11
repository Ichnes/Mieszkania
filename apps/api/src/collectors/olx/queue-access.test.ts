import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../../db";
import { OlxCollector } from "./index";

test("OLX access denial defers the remaining batch and pauses new claims", async (t) => {
  const rows = Array.from({ length: 4 }, (_, index) => ({
    id: String(index),
    external_id: `olx-${index}`,
    canonical_url: `https://www.olx.pl/d/oferta/${index}`,
    attempts: 0,
    payload_raw: {},
  }));
  let claims = 0;
  const deferred: unknown[][] = [];
  t.mock.method(pool, "connect", async () => ({
    query: async (sql: string) => {
      if (sql.includes("select q.id")) {
        claims++;
        return { rows };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  }));
  t.mock.method(pool, "query", async (sql: string, values: unknown[]) => {
    if (sql.includes("set status = 'pending'")) deferred.push(values);
    return { rows: [], rowCount: 0 };
  });
  const collector = new OlxCollector();
  const collect = t.mock.method(collector, "collectOne", async () => {
    throw new Error("HTTP 403: blocked");
  });
  const result = await collector.processQueue({ limit: 4, concurrency: 2 });
  assert.equal(result.failed, 0);
  assert.equal(result.deferred, 4);
  assert.equal(deferred.length, 4);
  assert.equal(collect.mock.callCount(), 2);
  assert.ok(result.pausedUntil);
  const paused = await collector.processQueue({ limit: 4 });
  assert.equal(paused.claimed, 0);
  assert.equal(claims, 1);
});
