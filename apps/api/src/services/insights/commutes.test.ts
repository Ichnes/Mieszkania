import assert from "node:assert/strict";
import test from "node:test";
import type { FamilySettings } from "@mieszkania/shared";
import { getCommutes } from "./neighborhood-insights";

const settings = {
  workplaces: [{ key: "work", label: "Praca", address: "", latitude: 52, longitude: 21 }],
} as FamilySettings;

test("commutes use driving routes and preserve destination identity", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    urls.push(url.toString());
    return Response.json({ routes: [{ distance: 1250, duration: 660 }] });
  });
  assert.deepEqual(await getCommutes(51, 20, settings), [
    { key: "work", label: "Praca", distanceKm: 1.3, durationMinutes: 11 },
  ]);
  assert.match(urls[0], /driving\/20,51;21,52/);
  assert.equal(urls.length, 1);
});

test("missing coordinates do not fetch routes or invent travel times", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected fetch");
  });
  assert.deepEqual(await getCommutes(undefined, 21, settings), [{ key: "work", label: "Praca" }]);
  assert.deepEqual(
    await getCommutes(52, 21, {
      ...settings,
      workplaces: [{ key: "missing", label: "Cel", address: "" }],
    }),
    [{ key: "missing", label: "Cel" }],
  );
  assert.equal(fetch.mock.callCount(), 0);
});

test("route fallback accepts zero; invalid routes and provider outages stay missing", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? Response.json({ routes: [{ duration: -1, distance: 1 }] })
      : Response.json({ routes: [{ duration: 0, distance: 0 }] });
  });
  assert.deepEqual(await getCommutes(52, 21, settings), [
    { key: "work", label: "Praca", durationMinutes: 0, distanceKm: 0 },
  ]);
  assert.equal(calls, 2);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Offline");
  });
  assert.deepEqual(await getCommutes(52, 21, settings), [
    { key: "work", label: "Praca", durationMinutes: undefined, distanceKm: undefined },
  ]);
});
