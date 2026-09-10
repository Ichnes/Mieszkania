import assert from "node:assert/strict";
import test from "node:test";
import { getWarsawRailwayMap } from "./railway-map";
import { getWarsawTramwayMap } from "./tramway-map";

test("transport works offline on first and repeated requests, with complete local geometry", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Network unavailable");
  });
  const railway = await getWarsawRailwayMap();
  const tramway = await getWarsawTramwayMap();
  assert.equal(await getWarsawRailwayMap(), railway);
  assert.equal(await getWarsawTramwayMap(), tramway);
  for (const name of [
    "Warszawa Centralna",
    "Warszawa Zachodnia",
    "Warszawa Wschodnia",
    "Warszawa Gdańska",
    "Warszawa Lotnisko Chopina",
    "Warszawa Śródmieście WKD",
  ])
    assert.ok(
      railway.stations.some((s) => s.name === name),
      name,
    );
  assert.ok(tramway.stops.length > 300);
  assert.ok(railway.lines.length > 100);
  for (const lines of [railway.lines, tramway.lines]) {
    const keys = lines.map((line) => {
      assert.ok(line.length > 1);
      for (const [lat, lon] of line)
        assert.ok(lat >= 52 && lat <= 52.55 && lon >= 20.55 && lon <= 21.5);
      const a = JSON.stringify(line),
        b = JSON.stringify([...line].reverse());
      return a < b ? a : b;
    });
    assert.equal(new Set(keys).size, keys.length);
  }
});
