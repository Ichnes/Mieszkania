import assert from "node:assert/strict";
import test from "node:test";
import { extractNieruchomosciOnlineConstructionYear, parseListing } from "./index";

test("Domiporta separates the apartment area from a balcony size in the headline", () => {
  const url = "https://www.domiporta.pl/nieruchomosci/123";
  const headline = "Mieszkanie z balkonem 10 m²";
  const description = "Mieszkanie o powierzchni 61,2m2 składa się z trzech pokoi.";
  const feature =
    '<p class="features-short__name">Powierzchnia</p><p class="features-short__value">61,25 m2</p>';
  assert.equal(parseListing(url, feature, "123", headline, description).areaSqm, 61.25);
  assert.equal(parseListing(url, "", "123", headline, description).areaSqm, 61.2);
  assert.equal(parseListing(url, "", "123", headline, "Trzy pokoje.").areaSqm, undefined);
});

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

test("Domiporta distinguishes a terrace from the apartment in archived offer metadata", () => {
  const url = "https://www.domiporta.pl/nieruchomosci/123";
  const html =
    '<script type="application/ld+json">{"@type":"Offer","itemOffered":{"@type":"Apartment","floorSize":{"value":77}}}</script>';
  const title = "Mieszkanie z tarasem 30 m²";
  const description =
    "Taras o powierzchni ok. 30 m². Powierzchnię mieszkania (77,50 m²) stanowią trzy pokoje.";
  assert.equal(parseListing(url, html, "123", title, description).areaSqm, 77.5);
  assert.equal(parseListing(url, html, "123", title, "Taras o powierzchni ok. 30 m².").areaSqm, 77);
  assert.equal(
    parseListing(url, "", "123", "Taras o powierzchni ok. 30 m²", "Taras.").areaSqm,
    undefined,
  );
});
