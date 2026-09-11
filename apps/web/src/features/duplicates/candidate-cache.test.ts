import test from "node:test";
import assert from "node:assert/strict";
import { createCandidateCache } from "./candidate-cache";

test("empty results are cached, concurrent requests shared, and entries expire", async () => {
  let calls = 0,
    time = 0;
  const cache = createCandidateCache(
    async () => {
      calls++;
      return [];
    },
    () => time,
    10,
  );
  await Promise.all([cache.load("x"), cache.load("x")]);
  await cache.load("y");
  await cache.load("x");
  assert.equal(calls, 2);
  assert.deepEqual(cache.peek("x"), []);
  time = 10;
  await cache.load("x");
  assert.equal(calls, 3);
});
test("failures can be retried and least recently used entries are evicted", async () => {
  let fail = true;
  const cache = createCandidateCache(
    async () => {
      if (fail) throw Error("offline");
      return [];
    },
    Date.now,
    300000,
    2,
  );
  await assert.rejects(cache.load("x"));
  assert.equal(cache.peek("x"), undefined);
  fail = false;
  await cache.load("x");
  await cache.load("y");
  cache.peek("x");
  await cache.load("z");
  assert.equal(cache.peek("y"), undefined);
  assert.deepEqual(cache.peek("x"), []);
});
test("invalidation aborts pending requests and rejects late results", async () => {
  let release!: () => void;
  let signal!: AbortSignal;
  const cache = createCandidateCache(async (_id, s) => {
    signal = s;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return [];
  });
  const pending = cache.load("x");
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await Promise.resolve();
  cache.clear();
  assert.equal(signal.aborted, true);
  release();
  await rejected;
  assert.equal(cache.peek("x"), undefined);
});
