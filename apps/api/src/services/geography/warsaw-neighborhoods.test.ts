import assert from "node:assert/strict";
import test from "node:test";
import { canonicalWarsawDistrict, inferWarsawNeighborhood } from "./warsaw-neighborhoods";

test("neighborhood matching keeps longest names, district restrictions and repeatable results", () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(inferWarsawNeighborhood("Mieszkanie: Stary Imielin", "Ursynów"), "Stary Imielin");
    assert.equal(inferWarsawNeighborhood("Mieszkanie: Stary Imielin", "Mokotów"), undefined);
    assert.equal(inferWarsawNeighborhood("Wola Grzybowska", "Bez dzielnicy"), "Wola Grzybowska");
    assert.equal(inferWarsawNeighborhood("Wola Grzybowska"), "Wola Grzybowska");
    assert.equal(inferWarsawNeighborhood("Nieznana okolica", "Ursynów"), undefined);
    assert.equal(inferWarsawNeighborhood("", "Ursynów"), undefined);
  }
});
test("Wola Grzybowska is Wesoła, including full location strings", () => {
  for (const label of [
    "Wola Grzybowska",
    "Warszawa, Wola Grzybowska",
    "Warszawa / Wesoła / Wola Grzybowska",
  ]) {
    assert.equal(canonicalWarsawDistrict(label), "Wesoła", label);
  }
  assert.equal(canonicalWarsawDistrict("Warszawa, Wola"), "Wola");
  assert.equal(canonicalWarsawDistrict("Wola, Odolany"), "Wola");
  assert.equal(canonicalWarsawDistrict("Stary Rembertów"), "Rembertów");
});
