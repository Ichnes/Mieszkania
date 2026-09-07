import assert from "node:assert/strict";
import test from "node:test";
import { canonicalWarsawDistrict } from "./warsaw-neighborhoods";
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
