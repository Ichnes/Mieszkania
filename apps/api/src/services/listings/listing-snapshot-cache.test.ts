import assert from "node:assert/strict";
import test from "node:test";
import { createListingSnapshotCache } from "./listing-snapshot-cache";

const ref = (id: string, version = "1") => ({ snapshot_id: id, snapshot_version: version });
const snapshot = (id: string, version = "1", payload = { floor: 1 }) => ({ id, version, payload });

test("unchanged versions reuse payloads; new snapshots and in-place updates fetch current facts", async () => {
  const cache = createListingSnapshotCache();
  const calls: string[][] = [];
  let current = snapshot("a");
  const fetch = async (ids: string[]) => {
    calls.push(ids);
    return [current];
  };
  assert.equal((await cache.load([ref("a")], fetch)).get("a")?.floor, 1);
  await cache.load([ref("a"), ref("a")], fetch);
  assert.deepEqual(calls, [["a"]]);
  current = snapshot("a", "2", { floor: 7 });
  assert.equal((await cache.load([ref("a", "2")], fetch)).get("a")?.floor, 7);
  current = snapshot("b", "3", { floor: 4 });
  assert.equal((await cache.load([ref("b", "3")], fetch)).get("b")?.floor, 4);
  assert.deepEqual(calls, [["a"], ["a"], ["b"]]);
});

test("cache records the payload's actual version when an update races with discovery", async () => {
  const cache = createListingSnapshotCache();
  await cache.load([ref("a", "1")], async () => [snapshot("a", "2", { floor: 5 })]);
  const result = await cache.load([ref("a", "2")], async () => {
    throw Error("Cache should match version 2");
  });
  assert.equal(result.get("a")?.floor, 5);
});

test("failed or deleted snapshots do not fall back to stale facts and can be retried", async () => {
  const cache = createListingSnapshotCache();
  await cache.load([ref("a")], async () => [snapshot("a")]);
  await assert.rejects(
    cache.load([ref("a", "2")], async () => {
      throw Error("offline");
    }),
    /offline/,
  );
  assert.equal((await cache.load([ref("a", "2")], async () => [])).size, 0);
  assert.equal(
    (await cache.load([ref("a", "2")], async () => [snapshot("a", "2", { floor: 8 })])).get("a")
      ?.floor,
    8,
  );
  assert.equal(
    (
      await cache.load([{}], async () => {
        throw Error("No snapshot to fetch");
      })
    ).size,
    0,
  );
});

test("LRU eviction limits both entries and serialized bytes; oversized payloads remain usable", async () => {
  const size = Buffer.byteLength(JSON.stringify({ floor: 1 }));
  for (const cache of [
    createListingSnapshotCache(size * 2, 10),
    createListingSnapshotCache(1000, 2),
  ]) {
    await cache.load([ref("a"), ref("b")], async () => [snapshot("a"), snapshot("b")]);
    await cache.load([ref("a")], async () => {
      throw Error("a should be cached");
    });
    await cache.load([ref("c")], async () => [snapshot("c")]);
    let missing: string[] = [];
    await cache.load([ref("a"), ref("b"), ref("c")], async (ids) => {
      missing = ids;
      return [snapshot("b")];
    });
    assert.deepEqual(missing, ["b"]);
  }
  const tiny = createListingSnapshotCache(1);
  let calls = 0;
  for (let i = 0; i < 2; i++) {
    const result = await tiny.load([ref("a")], async () => {
      calls++;
      return [snapshot("a")];
    });
    assert.equal(result.get("a")?.floor, 1);
  }
  assert.equal(calls, 2);
});

test("out of order loads never label an older payload with a newer version", async () => {
  const cache = createListingSnapshotCache();
  let release!: (value: ReturnType<typeof snapshot>[]) => void;
  const old = cache.load(
    [ref("a", "1")],
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await cache.load([ref("a", "2")], async () => [snapshot("a", "2", { floor: 2 })]);
  release([snapshot("a", "1")]);
  await old;
  let fetched = false;
  const current = await cache.load([ref("a", "2")], async () => {
    fetched = true;
    return [snapshot("a", "2", { floor: 2 })];
  });
  assert.equal(fetched, true);
  assert.equal(current.get("a")?.floor, 2);
});
