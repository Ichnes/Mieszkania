import assert from "node:assert/strict";
import test from "node:test";
import {
  buyerExposure,
  buyerTrend,
  compareListings,
  type BuyerObservation,
} from "@mieszkania/shared";
function offer(i: number): BuyerObservation {
  return {
    id: String(i),
    district: "Ursus",
    neighborhood: "Szamoty",
    rooms: 4,
    area: 80,
    year: 2019,
    market: "secondary",
    price: 1000000,
    start: 0,
    end: null,
    relisted: false,
    history: [[0, 1000000]],
  };
}
test("matches exclude the target and broaden only after testing the local cohort", () => {
  const rows = Array.from({ length: 11 }, (_, i) => offer(i));
  rows[0].price = 800000;
  const result = compareListings(rows, 90, rows[0])[0];
  assert.equal(result.count, 10);
  assert.equal(Math.round(result.delta!), -20);
  assert.equal(result.percentile, 0);
  rows[1].district = "Wola";
  assert.equal(compareListings(rows, 90, rows[0])[0].reference, null);
});
test("matched index keeps unchanged pairs and never backfills a missing week", () => {
  const rows = Array.from({ length: 10 }, (_, i) => offer(i));
  for (const r of rows) r.history.push([21, 900000]);
  const chart = buyerTrend(rows, 21, 22);
  assert.equal(chart[0].index, null);
  assert.equal(chart[1].index, 100);
  assert.equal(Math.round(chart[3].index!), 90);
  rows[0].history = [];
  assert.equal(buyerTrend(rows, 21, 22)[3].index, null);
});
test("withdrawal before a cut competes with first discount; active offers stay under observation", () => {
  const rows = Array.from({ length: 20 }, (_, i) => offer(i));
  for (const r of rows.slice(0, 5)) r.end = 2;
  for (const r of rows.slice(5, 10)) r.history.push([3, 950000]);
  const series = buyerExposure(rows, 10, 30);
  assert.equal(series[3].active, 75);
  assert.equal(series[3].cut, 25);
  assert.equal(series[3].risk, 15);
});
