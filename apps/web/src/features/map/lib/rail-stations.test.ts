import assert from "node:assert/strict";
import test from "node:test";
import { mapRailStations } from "./rail-stations";

test("bundled WKD stations are available without a database or after a partial remote response", () => {
  for (const remote of [
    undefined,
    [],
    [{ name: "Warszawa Centralna", latitude: 52.228, longitude: 21 }],
  ]) {
    const names = mapRailStations(remote).map((station) => station.name);
    assert.ok(names.includes("Warszawa Śródmieście WKD"));
    assert.ok(names.includes("Warszawa Ochota WKD"));
    assert.ok(names.includes("Warszawa Salomea"));
    assert.ok(names.includes("Michałowice"));
  }
});

test("matching remote station retains its more detailed coordinates without a duplicate", () => {
  const remote = { name: "Warszawa Śródmieście WKD", latitude: 52.227, longitude: 21.001 };
  const matches = mapRailStations([remote]).filter((station) => station.name === remote.name);
  assert.deepEqual(matches, [remote]);
});

import { wkdLines, wkdStations } from "../data/wkd";
test("bundled WKD includes all 28 stops and connected Grodzisk and Milanówek branches", () => {
  assert.equal(wkdStations.length, 28);
  assert.equal(new Set(wkdStations.map((s) => s.name)).size, 28);
  assert.equal(wkdLines[0]!.stations.at(-1)!.name, "Grodzisk Mazowiecki Radońska");
  assert.equal(wkdLines[1]!.stations[0]!.name, "Podkowa Leśna Zachodnia");
  assert.equal(wkdLines[1]!.stations.at(-1)!.name, "Milanówek Grudów");
  for (const station of wkdStations) {
    assert.ok(station.latitude > 52.06 && station.latitude < 52.25);
    assert.ok(station.longitude > 20.55 && station.longitude < 21.04);
    assert.ok(
      mapRailStations([{ name: "Other", latitude: 52, longitude: 21 }]).some(
        (s) => s.name === station.name,
      ),
    );
  }
});
