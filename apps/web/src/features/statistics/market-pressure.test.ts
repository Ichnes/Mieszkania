import test from "node:test";
import assert from "node:assert/strict";
import {
  calibratedPressure,
  pressureKey,
  measurePressure,
  compareListings,
  type BuyerObservation,
  type PressureFrame,
} from "@mieszkania/shared";
const key = pressureKey();
const frames: PressureFrame[] = Array.from({ length: 8 }, (_, i) => ({
  day: i * 30,
  groups: {
    [key]: {
      active: 100,
      values: {
        cutFrequency: 0.2,
        cutSize: 4,
        persistence: 0.7,
        supply: 0,
        aged: 0.1,
        balance: 0.5,
        returns: 0.05,
      },
    },
  },
}));
test("historical midpoint is 50; future data cannot calibrate an earlier date", () => {
  assert.equal(calibratedPressure(frames, key, 150).score, null);
  assert.equal(calibratedPressure(frames, key, 180).score, 50);
  const changed = structuredClone(frames);
  changed[7].groups[key].values.supply = 1;
  assert.equal(calibratedPressure(changed, key, 180).score, 50);
  assert.equal(calibratedPressure(changed, key, 210).score, 60);
});
test("missing components are explicit; weights rescale only with sufficient coverage", () => {
  const data = structuredClone(frames),
    values = data[7].groups[key].values;
  values.cutSize = null;
  values.supply = 1;
  const index = calibratedPressure(data, key, 210);
  assert.equal(index.coverage, 85);
  assert.equal(index.components.find((c) => c.key === "cutSize")?.points, null);
  assert.ok(Math.abs(index.score! - (50 + 1000 / 85)) < 1e-8);
  values.supply = null;
  assert.equal(calibratedPressure(data, key, 210).score, null);
});
test("no cuts has no median and missing starting inventory has no supply change", () => {
  const s = measurePressure([], 180);
  assert.equal(s.values.cutSize, null);
  assert.equal(s.values.supply, null);
  assert.equal(s.values.balance, null);
});
test("two prior snapshot windows support an explicitly preliminary reading, without mixing capture methods", () => {
  const replay = frames.slice(0, 3).map((f) => ({ ...f, replayed: true }));
  const reading = calibratedPressure([...replay, frames[2]], key, 60);
  assert.equal(reading.score, 50);
  assert.equal(reading.preliminary, true);
  assert.equal(calibratedPressure(replay, key, 30).score, null);
});
test("changing only the asking price changes value and leaves negotiation independent", () => {
  const peers: BuyerObservation[] = Array.from({ length: 11 }, (_, i) => ({
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
  }));
  const cheap = compareListings(peers, 91, { ...peers[0], price: 800000 })[0];
  const expensive = compareListings(peers, 91, { ...peers[0], price: 1200000 })[0];
  assert.equal(cheap.valueScore, 100);
  assert.equal(expensive.valueScore, 0);
  assert.equal(cheap.negotiationScore, expensive.negotiationScore);
  const fresh = compareListings(peers, 1, peers[0])[0];
  assert.equal(fresh.negotiationScore, null);
  assert.equal(fresh.negotiationReason, "Krótka obserwacja");
});
