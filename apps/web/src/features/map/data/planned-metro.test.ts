import assert from "node:assert/strict";
import test from "node:test";
import { warsawMetroStations } from "@mieszkania/shared";
import { plannedMetroLines } from "./planned-metro";
import { warsawMetroLines } from "./transit";

test("metro expansions join their parent line without duplicating connection markers", () => {
  const extensions = plannedMetroLines.filter((line) => line.code === "M2");
  assert.deepEqual(extensions[0].stations[0], {
    ...warsawMetroStations.find((station) => station.name === "Bemowo"),
    connectionOnly: true,
  });
  assert.deepEqual(extensions[1].stations[0], {
    ...extensions[0].stations.at(-1),
    connectionOnly: true,
  });
  assert.equal(
    extensions.flatMap((line) => line.stations).filter((station) => !station.connectionOnly).length,
    6,
  );
  assert.ok(
    extensions[0].stations[1].latitude > 52.237,
    "Lazurowa must be at Górczewska, not a kilometre south",
  );
});

test("M4 and M5 are complete, geographically bounded and distinguish concepts from active metro", () => {
  assert.equal(plannedMetroLines.find((line) => line.code === "M4")!.stations.length, 23);
  const m5 = plannedMetroLines.find((line) => line.code === "M5")!;
  assert.equal(m5.stations.length, 20);
  assert.equal(m5.stations[0].name, "Szamoty");
  assert.equal(m5.stations.at(-1)!.name, "Gocławek");
  for (const line of plannedMetroLines) {
    assert.ok(line.planned && line.sourceUrl && line.statusLabel);
    for (const station of line.stations) {
      assert.ok(station.latitude > 52.1 && station.latitude < 52.4);
      assert.ok(station.longitude > 20.8 && station.longitude < 21.2);
    }
  }
  const m3 = warsawMetroLines.find((line) => line.code === "M3")!;
  const station = m3.stations.find((item) => item.name === "Ostrobramska")!;
  assert.deepEqual(
    m5.stations.find((item) => item.name === "Ostrobramska"),
    station,
  );
  assert.deepEqual(
    warsawMetroLines.find((line) => line.code === "M1")!.stations,
    warsawMetroStations.slice(0, 21),
  );
});
