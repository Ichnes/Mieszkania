import assert from "node:assert/strict";
import test from "node:test";
import { extractNieruchomosciOnlineConstructionYear, parseListing } from "./index";

test("Domiporta floor fractions are not concatenated into floor 713", () => {
  for (const [value, expected] of [
    ["7/13", 7],
    ["7 / 13", 7],
    ["parter", 0],
    ["7", 7],
  ] as const) {
    const html = `<h1>Mieszkanie</h1><p class="features-short__name">Piętro</p><p class="features-short__value">${value}</p><p class="features-short__name">Liczba pięter w budynku</p><p class="features-short__value">13</p>`;
    const result = parseListing("https://www.domiporta.pl/nieruchomosci/123", html, "123");
    assert.equal(result.floor, expected);
    assert.equal(result.totalFloors, 13);
  }
});

test("reads the year from the current Nieruchomości-online attributes markup", () => {
  const html = `<div class="box__attributes--content"><span class="fheader body-sm">Rok budowy:</span><br><span class="fsize-a">2018</span></div>`;
  assert.equal(extractNieruchomosciOnlineConstructionYear(html), 2018);
});

test("keeps support for the legacy strong/span markup", () => {
  assert.equal(
    extractNieruchomosciOnlineConstructionYear(`<strong>Rok budowy:</strong><span>2007</span>`),
    2007,
  );
});
