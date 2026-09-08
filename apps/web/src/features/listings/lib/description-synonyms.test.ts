import assert from "node:assert/strict";
import test from "node:test";
import { getDreamDescriptionFacts } from "@mieszkania/shared";
test("custom built furniture is recognized without requiring the word carpenter", () => {
  for (const text of [
    "kuchnia wykonana na wymiar",
    "zabudowa kuchenna wykonana na wymiar",
    "szafy na wymiar",
    "meble na zamowienie",
  ])
    assert.equal(getDreamDescriptionFacts(text).customCarpentry, true, text);
  for (const text of [
    "mozliwosc wykonania szafy na wymiar",
    "brak zabudowy na wymiar",
    "okna na wymiar",
  ])
    assert.equal(getDreamDescriptionFacts(text).customCarpentry, false, text);
});
test("walk-in needs a shower cabin context and synthetic floors are not wood", () => {
  assert.equal(getDreamDescriptionFacts("kabina walk-in").shower, true);
  assert.equal(getDreamDescriptionFacts("garderoba walk-in").shower, false);
  assert.equal(getDreamDescriptionFacts("podloga drewnopodobna").woodenFloor, false);
  assert.equal(getDreamDescriptionFacts("podloga z drewna").woodenFloor, true);
});
