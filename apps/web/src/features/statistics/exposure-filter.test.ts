import assert from "node:assert/strict";
import test from "node:test";
import { exposureDirections, matchesExposureFilter, getSunExposure } from "@mieszkania/shared";
test("any selected bearing matches, including apartments with other exposures", () => {
  assert.equal(matchesExposureFilter("Okna na południe.", ["S"]), true);
  assert.equal(matchesExposureFilter("Okna na południe i północ.", ["S"]), true);
  assert.equal(matchesExposureFilter("Okna na północ i południe.", ["N"]), true);
  assert.equal(matchesExposureFilter("Okna na wschód i zachód.", ["N", "S"]), false);
  assert.equal(matchesExposureFilter("Okna na północ i wschód.", ["S", "E"]), true);
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

test("explicit two-sided compound exposure means two cardinal directions", () => {
  for (const [bearing, expected] of [
    ["południowo-zachodnia", ["S", "W"]],
    ["południowo–wschodnia", ["S", "E"]],
    ["północno-zachodnia", ["N", "W"]],
    ["północno—wschodnia", ["N", "E"]],
    ["SW", ["S", "W"]],
  ] as const) {
    for (const phrase of [
      `Dwustronna ekspozycja ${bearing}.`,
      `Ekspozycja ${bearing}, mieszkanie dwustronne.`,
      `Okna na dwie strony świata: ${bearing}.`,
    ]) {
      const actual = getSunExposure(phrase);
      assert.deepEqual(actual.directions, expected, phrase);
      assert.equal(actual.sideCount, 2);
      assert.equal(actual.isDoubleSided, true);
    }
  }
  const description = "Dwustronna ekspozycja południowo-zachodnia";
  assert.equal(matchesExposureFilter(description, ["S"]), true);
  assert.equal(matchesExposureFilter(description, ["W"]), true);
  assert.equal(matchesExposureFilter(description, ["SW"]), false);
});

test("keeps a single diagonal, two named diagonals and manual corrections intact", () => {
  for (const description of [
    "Ekspozycja południowo-zachodnia.",
    "Jednostronna ekspozycja południowo-zachodnia.",
    "Mieszkanie narożne, ekspozycja południowo-zachodnia.",
  ])
    assert.deepEqual(getSunExposure(description).directions, ["SW"]);
  assert.deepEqual(
    getSunExposure("Dwustronne mieszkanie: ekspozycja północno-wschodnia i południowo-zachodnia.")
      .directions,
    ["NE", "SW"],
  );
  assert.deepEqual(
    getSunExposure("Dwustronna ekspozycja południowo-zachodnia.", ["SW"]).directions,
    ["SW"],
  );
});
