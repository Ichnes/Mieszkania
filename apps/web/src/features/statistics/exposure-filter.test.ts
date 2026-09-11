import assert from "node:assert/strict";
import test from "node:test";
import { exposureDirections, matchesExposureFilter, getSunExposure } from "@mieszkania/shared";
test("selected bearings define the whole allowed exposure range", () => {
  assert.equal(matchesExposureFilter("Okna na południe.", ["S"]), true);
  assert.equal(matchesExposureFilter("Okna na południe i północ.", ["S"]), false);
  assert.equal(
    matchesExposureFilter("Ekspozycja południowo-wschodnia i południowo-zachodnia.", [
      "SE",
      "S",
      "SW",
    ]),
    true,
  );
  assert.equal(matchesExposureFilter("Ekspozycja południowo-wschodnia.", ["S"]), false);
  assert.equal(matchesExposureFilter("Mieszkanie narożne.", ["S"]), false);
  for (const directions of [[], exposureDirections]) {
    assert.equal(matchesExposureFilter("Brak danych.", directions), true);
    assert.equal(matchesExposureFilter("Okna na północ.", directions), true);
  }
});
test("corner apartments imply at least two sides without invented bearings", () => {
  assert.equal(getSunExposure("Mieszkanie narożne.").sideCount, 2);
  assert.deepEqual(getSunExposure("Mieszkanie narożne.").directions, []);
  assert.equal(getSunExposure("Mieszkanie narożne, trójstronne.").sideCount, 3);
  assert.equal(getSunExposure("W pokoju narożna kanapa.").sideCount, undefined);
});
