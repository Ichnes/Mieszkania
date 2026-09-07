import assert from "node:assert/strict";
import test from "node:test";
import { analyzeImmediateSurroundings } from "./immediate-surroundings";

test("retains waste and civic features beyond twelve nearby rail segments", () => {
  const elements = Array.from({ length: 20 }, (_, id) => ({
    type: "node" as const,
    id,
    lat: 52,
    lon: 21,
    tags: { railway: "rail" },
  }));
  const result = analyzeImmediateSurroundings(
    [
      ...elements,
      { type: "node", id: 100, lat: 52.0003, lon: 21, tags: { amenity: "recycling" } },
      { type: "node", id: 101, lat: 52.0004, lon: 21, tags: { office: "government" } },
    ],
    52,
    21,
  );
  assert.equal(result.findings.length, 22);
  assert.ok(result.findings.some((finding) => finding.category === "waste"));
  assert.ok(
    result.findings.some(
      (finding) => finding.category === "civic" && finding.severity === "information",
    ),
  );
});

test("detects an industrial building crossing the 50 metre parcel surroundings", () => {
  const result = analyzeImmediateSurroundings(
    [
      { type: "node", id: 1, lat: 52.0001, lon: 20.9998 },
      { type: "node", id: 2, lat: 52.0001, lon: 21.0002 },
      { type: "node", id: 3, lat: 51.9999, lon: 21.0002 },
      { type: "node", id: 4, lat: 51.9999, lon: 20.9998 },
      {
        type: "way",
        id: 20,
        nodes: [1, 2, 3, 4, 1],
        tags: { building: "industrial", name: "Hala produkcyjna" },
      },
    ],
    52,
    21,
  );

  assert.equal(result.assessment, "attention");
  assert.equal(result.findings[0]?.category, "industry");
  assert.equal(result.findings[0]?.distanceMeters, 0);
  assert.equal(result.findings[0]?.name, "Hala produkcyjna");
});

test("ignores a major road outside the 50 metre analysis radius", () => {
  const result = analyzeImmediateSurroundings(
    [
      { type: "node", id: 1, lat: 52.001, lon: 21 },
      { type: "node", id: 2, lat: 52.001, lon: 21.001 },
      { type: "way", id: 30, nodes: [1, 2], tags: { highway: "primary", name: "Daleka arteria" } },
    ],
    52,
    21,
  );

  assert.equal(result.assessment, "clear");
  assert.deepEqual(result.findings, []);
});
