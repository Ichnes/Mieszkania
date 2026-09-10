import assert from "node:assert/strict";
import test from "node:test";
import { availableAmenities } from "./available-amenities";

test("partial vicinity data retains known metro distance but does not present placeholder zeros as absence", () => {
  const amenities = [
    {
      key: "metro",
      label: "Metro Bemowo",
      count: 0,
      within500m: 0,
      within1000m: 0,
      nearestDistanceMeters: 5371,
    },
    { key: "nursery", label: "Żłobki", count: 0 },
  ];
  const analysis = {
    status: "unavailable" as const,
    source: "OpenStreetMap" as const,
    radiusMeters: 2000,
    plannedFacilities: [],
  };
  assert.deepEqual(availableAmenities(amenities, analysis), [amenities[0]]);
  assert.deepEqual(availableAmenities(amenities, { ...analysis, status: "available" }), amenities);
  assert.deepEqual(availableAmenities([], analysis), []);
});
