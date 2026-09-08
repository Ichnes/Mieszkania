import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMarketLocation } from "./market-locations";
import { mapPriceSample } from "./market-sample";
test("district aliases and neighborhoods produce the same aggregation key", () => {
  for (const district of ["Praga-Południe", "PRAGA POLUDNIE", "Goclaw"])
    assert.equal(
      normalizeMarketLocation({ district, neighborhood: null }).district,
      "Praga-Południe",
    );
  assert.equal(
    normalizeMarketLocation({ district: "Goclaw", neighborhood: null }).neighborhood,
    "Gocław",
  );
  assert.equal(
    normalizeMarketLocation({ district: null, neighborhood: null }).district,
    "Bez dzielnicy",
  );
});
test("small samples withhold quartiles and median; ten priced observations suffice", () => {
  const sample = { priced: "9", median_price: "20000", q1: "18000", q3: "22000" };
  assert.equal(mapPriceSample(sample).medianPricePerSqm, null);
  assert.equal(mapPriceSample({ ...sample, priced: "10" }).lowerQuartilePricePerSqm, 18000);
  assert.equal(mapPriceSample({ ...sample, priced: "10" }).sufficientSample, true);
});
