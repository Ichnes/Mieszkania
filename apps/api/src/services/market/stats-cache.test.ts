import test from "node:test";
import assert from "node:assert/strict";
import { createStatsCache } from "./stats-cache";

test("parallel identical requests share computation; cache expires and separates filters", async () => {
  let time = 0,
    calls = 0;
  const cache = createStatsCache<number>(30, 2, () => time);
  let release!: (value: number) => void;
  const compute = () => {
    calls++;
    return new Promise<number>((resolve) => {
      release = resolve;
    });
  };
  const first = cache("filters-a", compute),
    second = cache("filters-a", compute);
  await Promise.resolve();
  release(7);
  assert.deepEqual(await Promise.all([first, second]), [7, 7]);
  assert.equal(calls, 1);
  time = 29;
  assert.equal(await cache("filters-a", async () => 99), 7);
  assert.equal(await cache("filters-b", async () => 8), 8);
  time = 30;
  assert.equal(await cache("filters-a", async () => 9), 9);
});

test("failed work can be retried and result cache has a bounded size", async () => {
  const cache = createStatsCache<number>(1000, 2);
  await assert.rejects(
    cache("a", async () => {
      throw new Error("database unavailable");
    }),
  );
  assert.equal(await cache("a", async () => 1), 1);
  await cache("b", async () => 2);
  await cache("c", async () => 3);
  assert.equal(await cache("a", async () => 4), 4);
});
