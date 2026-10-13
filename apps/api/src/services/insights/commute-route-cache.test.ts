import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createCommuteRouteCache } from "./commute-route-cache";
async function cleanup(directory: string) {
  const target = resolve(directory);
  assert.equal(dirname(target), resolve(tmpdir()));
  assert.ok(basename(target).startsWith("commute-test-"));
  await rm(target, { recursive: true, force: true });
}

test("route matrices persist, deduplicate and invalidate after destination changes; remote goals are skipped", async () => {
  const dir = await mkdtemp(join(tmpdir(), "commute-test-"));
  const origin = { latitude: 52.1, longitude: 21.1 };
  const workplace = {
    key: "office",
    label: "Office",
    address: "",
    latitude: 52.2,
    longitude: 21.2,
  };
  let calls = 0;
  const request: typeof fetch = async (input) => {
    calls++;
    assert.match(String(input), /table\/v1\/driving/);
    return Response.json({ code: "Ok", durations: [[2100]], distances: [[18000]] });
  };
  try {
    const cache = createCommuteRouteCache(join(dir, "routes.json"), request, async () => {});
    await cache.load();
    cache.prepare([origin, origin], [workplace, { ...workplace, key: "home", workMode: "remote" }]);
    cache.prepare([origin], [workplace]);
    await cache.settle();
    assert.equal(calls, 1);
    assert.equal(cache.pending, 0);
    assert.equal(cache.read(origin, [workplace])[0].durationMinutes, 35);
    assert.deepEqual(cache.read(origin, [{ ...workplace, workMode: "remote" }]), []);
    const restored = createCommuteRouteCache(join(dir, "routes.json"), request, async () => {});
    await restored.load();
    restored.prepare([origin], [workplace]);
    await restored.settle();
    assert.equal(calls, 1);
    assert.equal(restored.read(origin, [workplace])[0].durationMinutes, 35);
    assert.equal(
      restored.read(origin, [{ ...workplace, longitude: 21.3 }])[0].durationMinutes,
      undefined,
    );
    assert.equal(
      restored.read({ ...origin, latitude: 52.3 }, [workplace])[0].durationMinutes,
      undefined,
    );
  } finally {
    await cleanup(dir);
  }
});

test("unreachable routes and outages stay unknown without straight-line substitutes or retry storms", async () => {
  const dir = await mkdtemp(join(tmpdir(), "commute-test-"));
  const origin = { latitude: 52, longitude: 21 };
  const workplace = { key: "work", label: "Work", address: "", latitude: 52.2, longitude: 21.2 };
  let calls = 0;
  try {
    const cache = createCommuteRouteCache(
      join(dir, "routes.json"),
      async () => {
        calls++;
        throw new Error("offline");
      },
      async () => {},
    );
    await cache.load();
    cache.prepare([origin], [workplace]);
    await cache.settle();
    assert.equal(cache.read(origin, [workplace])[0].durationMinutes, undefined);
    cache.prepare([origin], [workplace]);
    await cache.settle();
    assert.equal(calls, 2);
    assert.equal(cache.pending, 0);
  } finally {
    await cleanup(dir);
  }
});
