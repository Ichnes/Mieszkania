import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { GratkaParser } from "./gratka/gratka-parser";
import { OlxParser } from "./olx/olx-parser";
import { parseListing } from "./nieruchomosci-online";
import { extractPortalCoordinates, parseCoordinatePair } from "./portal-coordinates";
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");

test("Gratka archived highlighted parameters supply parter z 4", async () => {
  const result = await new GratkaParser().parse({
    url: "https://gratka.pl/nieruchomosci/ob/46264133",
    html: fixture("gratka-highlighted-floor"),
    statusCode: 200,
  });
  assert.equal(result.floor, 0);
  assert.equal(result.totalFloors, 4);
});

test("Gratka archived ground floor omits the word piętro in the gallery", async () => {
  const result = await new GratkaParser().parse({
    url: "https://gratka.pl/nieruchomosci/ob/48607555",
    html: fixture("gratka-ground-floor"),
    statusCode: 200,
  });
  assert.equal(result.floor, 0);
  assert.equal(result.totalFloors, 5);
});

test("Gratka archived gallery header supplies floor, not recommendation text", async () => {
  const parsed = await new GratkaParser().parse({
    url: "https://gratka.pl/nieruchomosci/ob/48216311",
    statusCode: 200,
    html: fixture("gratka-floor"),
  });
  assert.equal(parsed.floor, 3);
  assert.equal(parsed.totalFloors, 7);
  const missing = await new GratkaParser().parse({
    url: "https://gratka.pl/nieruchomosci/ob/48216311",
    statusCode: 200,
    html: '<div class="recommendation">piętro 9/10</div>',
  });
  assert.equal(missing.floor, undefined);
});
test("Gratka archived table survives recommendation CSS before the main content", async () => {
  const parsed = await new GratkaParser().parse({
    url: "https://gratka.pl/nieruchomosci/ob/48849309",
    statusCode: 200,
    html:
      fixture("gratka-floor-table") +
      '<div class="properties-in-slider-wrapper">' +
      fixture("gratka-floor") +
      "</div>",
  });
  assert.equal(parsed.floor, 4);
  assert.equal(parsed.totalFloors, 6);
});
test("Domiporta archived microdata parses decimal commas as a coordinate pair", () => {
  const result = parseListing(
    "https://www.domiporta.pl/nieruchomosci/156412478",
    fixture("domiporta-geo"),
    "domiporta-156412478",
  );
  assert.equal(result.latitude, 52.2780735);
  assert.equal(result.longitude, 21.0874127);
});
test("Nieruchomosci-online archived map and JSON-LD supply coordinates", () => {
  const result = parseListing(
    "https://warszawa.nieruchomosci-online.pl/26749397.html",
    fixture("nieruchomosci-online-geo"),
    "test",
  );
  assert.equal(result.latitude, 52.2132411);
  assert.equal(result.longitude, 21.0211083);
  assert.deepEqual(
    extractPortalCoordinates({ geo: { latitude: "52.2132411", longitude: "21.0211083" } }, ""),
    { latitude: 52.2132411, longitude: 21.0211083 },
  );
  assert.equal(parseCoordinatePair(null, 21), undefined);
  assert.equal(parseCoordinatePair(120, 21), undefined);
  assert.equal(
    extractPortalCoordinates({ geo: { latitude: 52 } }, '<meta itemprop="longitude" content="21">'),
    undefined,
  );
});
test("OLX archived structured price does not become the price per metre", async () => {
  const result = await new OlxParser().parse({
    url: "https://www.olx.pl/d/oferta/test-ID1bx9K1.html",
    statusCode: 200,
    html: fixture("olx-structured"),
  });
  assert.equal(result.priceAmount, 1250000);
  assert.equal(result.areaSqm, 65);
  assert.equal(result.rooms, 3);
  assert.equal(result.district, "Praga-Południe");
  assert.equal(result.latitude, 52.232098);
  assert.equal(result.floor, undefined);
});
test("OLX archived params isolate floor and decimal area from unrelated digits", async () => {
  const document = {
    url: "https://www.olx.pl/d/oferta/test-ID1bziob.html",
    statusCode: 200,
    html: fixture("olx-floor"),
  };
  const result = await new OlxParser().parse(document);
  assert.equal(result.floor, 3);
  assert.equal(result.areaSqm, 63.8);
  assert.equal(result.priceAmount, 1030000);
  assert.equal((await new OlxParser().parse({ ...document, statusCode: 404 })).status, "removed");
});
