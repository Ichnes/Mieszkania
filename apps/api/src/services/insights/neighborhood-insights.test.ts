import assert from "node:assert/strict";
import test from "node:test";
import { analyzeAmenityElements, buildOverpassQuery } from "./neighborhood-insights";

test("summarizes amenities into walking-distance bands and keeps nearest names", () => {
  const result = analyzeAmenityElements(
    [
      {
        id: 1,
        type: "node",
        lat: 52.0009,
        lon: 21,
        tags: { amenity: "school", name: "Szkoła blisko" },
      },
      {
        id: 2,
        type: "node",
        lat: 52.006,
        lon: 21,
        tags: { amenity: "school", name: "Szkoła dalej" },
      },
      {
        id: 3,
        type: "node",
        lat: 52.013,
        lon: 21,
        tags: { amenity: "school", name: "Szkoła najdalej" },
      },
      {
        id: 4,
        type: "node",
        lat: 52.002,
        lon: 21,
        tags: { leisure: "playground", name: "Plac Radosny" },
      },
    ],
    52,
    21,
  );

  const schools = result.amenities.find((amenity) => amenity.key === "school");
  assert.equal(result.amenityAnalysis.status, "available");
  assert.equal(schools?.count, 3);
  assert.equal(schools?.within500m, 1);
  assert.equal(schools?.within1000m, 2);
  assert.equal(schools?.nearestPlaces?.[0]?.name, "Szkoła blisko");
  assert.equal(result.amenities.find((amenity) => amenity.key === "playground")?.within500m, 1);
});

test("separates proposed and construction facilities from existing counts", () => {
  const result = analyzeAmenityElements(
    [
      {
        id: 10,
        type: "way",
        center: { lat: 52.001, lon: 21 },
        tags: { proposed: "school", name: "Nowa szkoła" },
      },
      {
        id: 11,
        type: "way",
        center: { lat: 52.002, lon: 21 },
        tags: { "construction:amenity": "kindergarten" },
      },
      {
        id: 12,
        type: "node",
        lat: 52.003,
        lon: 21,
        tags: { amenity: "school", name: "Istniejąca szkoła" },
      },
    ],
    52,
    21,
  );

  assert.equal(result.amenities.find((amenity) => amenity.key === "school")?.count, 1);
  assert.deepEqual(
    result.amenityAnalysis.plannedFacilities.map((facility) => facility.stage),
    ["proposed", "construction"],
  );
  assert.equal(result.amenityAnalysis.plannedFacilities[0]?.name, "Nowa szkoła");
});

test("builds a bounded Overpass query for existing and planned facilities", () => {
  const query = buildOverpassQuery(52.2297, 21.0122);
  assert.match(query, /around:2000,52\.2297,21\.0122/);
  assert.match(query, /\["amenity"~"\^\(childcare\|creche\|kindergarten\|school/);
  assert.match(query, /\["proposed:amenity"~/);
  assert.match(query, /out center/);
});
