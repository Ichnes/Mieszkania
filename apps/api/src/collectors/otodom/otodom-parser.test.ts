import assert from "node:assert/strict";
import test from "node:test";
import { extractOfferLinks } from "./otodom-discovery";
import { OtodomParser } from "./otodom-parser";
import { extractOtodomExternalId } from "./otodom-url";
import { extractFeatures } from "../../services/listings/listing-repository";
import { getSavedPortalBuildingFacts } from "../../services/listings/portal-building-facts";

test("Otodom ground_floor is zero in new imports and saved snapshots", async () => {
  for (const [value, expected] of [
    ["ground_floor", 0],
    ["floor_3", 3],
    ["basement", -1],
    ["unknown", undefined],
  ] as const) {
    const nextData = {
      props: {
        pageProps: {
          ad: { title: "Mieszkanie", attributes: { floor_no: value, building_floors_num: "3" } },
        },
      },
    };
    const parsed = await new OtodomParser().parse({
      url: "https://www.otodom.pl/pl/oferta/test-ID4floor",
      statusCode: 200,
      html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`,
    });
    assert.equal(parsed.floor, expected);
    assert.equal(getSavedPortalBuildingFacts({ nextData }).floor, expected);
    assert.equal(getSavedPortalBuildingFacts({ nextData }).totalFloors, 3);
  }
});

test("Otodom finish and maintenance fields are retained independently of the description", async () => {
  const parsed = await new OtodomParser().parse({
    url: "https://www.otodom.pl/pl/oferta/test-ID4finish",
    finalUrl: "https://www.otodom.pl/pl/oferta/test-ID4finish",
    statusCode: 200,
    html: '<title>Mieszkanie</title><div data-sentry-element="ItemGridContainer"><div>Stan wykończenia<!-- -->:</div><div>do wykończenia</div></div><div><div>Czynsz<!-- -->:</div><div>850 zł</div></div>',
  });
  assert.deepEqual(parsed.rawPayload.portalFeatures, {
    finishQuality: "do wykończenia",
    fees: "850 zł",
  });
  const features = extractFeatures({
    description: "Jasne mieszkanie",
    snapshotPayload: parsed.rawPayload,
  });
  assert.ok(
    features.some(
      (feature) => feature.key === "finish_quality" && feature.value === "do wykończenia",
    ),
  );
  assert.ok(features.some((feature) => feature.key === "fees" && feature.value === "850 zł"));
});

test("reads an explicit Otodom lift value from the detail grid", async () => {
  const parser = new OtodomParser();
  const parsed = await parser.parse({
    url: "https://www.otodom.pl/pl/oferta/test-ID4lift",
    finalUrl: "https://www.otodom.pl/pl/oferta/test-ID4lift",
    statusCode: 200,
    html: `
      <title>Mieszkanie w Warszawie</title>
      <div class="css-1xw0jqp efdvw050">
        <div class="css-1okys8k e178zspo0">Winda<!-- -->:</div>
        <div class="css-1okys8k e178zspo0">nie</div>
      </div>`,
  });

  assert.deepEqual(parsed.rawPayload.portalFeatures, { lift: "nie" });
});

test("treats an Otodom unavailable notification as removed", async () => {
  const parser = new OtodomParser();
  const parsed = await parser.parse({
    url: "https://www.otodom.pl/pl/oferta/test-ID4gone",
    finalUrl: "https://www.otodom.pl/pl/oferta/test-ID4gone",
    statusCode: 200,
    html: `<div class="notification"><h2>To ogłoszenie nie jest już dostępne.</h2></div>`,
  });

  assert.equal(parsed.status, "removed");
});

test("does not append listing prose to a street extracted from the description", async () => {
  const parser = new OtodomParser();
  const parsed = await parser.parse({
    url: "https://www.otodom.pl/pl/oferta/test-ID4street",
    finalUrl: "https://www.otodom.pl/pl/oferta/test-ID4street",
    statusCode: 200,
    html: `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "4 pokoje, Warszawa",
          "description": "ul. Lubelska Przedmiotem sprzedaży jest ciche, przestronne mieszkanie.",
          "address": { "addressLocality": "Warszawa" },
          "offers": { "price": 1310000 }
        }
      </script>`,
  });

  assert.equal(parsed.street, "Lubelska");
  assert.equal(parsed.addressText, "Lubelska, Warszawa");
});

test("terminal Otodom ID wins over idealny, widok and tracking parameters", async () => {
  const url = "https://www.otodom.pl/pl/oferta/sluzew-idealny-dla-rodziny-ID4BSBL";
  assert.equal(extractOtodomExternalId(url + "?tracking=IDwrong#IDother"), "otodom-4BSBL");
  assert.equal(
    extractOtodomExternalId("https://www.otodom.pl/pl/oferta/widok-ID4AbCd/"),
    "otodom-4AbCd",
  );
  assert.equal(extractOtodomExternalId("https://www.otodom.pl/pl/oferta/idealny?ID4BSBL"), null);
  assert.equal(extractOtodomExternalId("https://example.com/pl/oferta/idealny-ID4BSBL"), null);
  const parsed = await new OtodomParser().parse({ url, statusCode: 200, html: "<h1>Test</h1>" });
  assert.equal(parsed.externalId, "otodom-4BSBL");
  await assert.rejects(
    new OtodomParser().parse({
      url: "https://www.otodom.pl/pl/oferta/idealny",
      statusCode: 200,
      html: "",
    }),
    /INVALID_OTODOM_LISTING_URL/,
  );
});

test("discovery keeps separate offers with the same idealny title fragment", () => {
  const links = extractOfferLinks(
    `<a href="/pl/oferta/idealny-dla-rodziny-ID4BSBL">A</a><a href="/pl/oferta/stan-idealny-ID4BmyQ">B</a>`,
  );
  assert.deepEqual(
    links.map((link) => link.externalId).sort(),
    ["otodom-4BSBL", "otodom-4BmyQ"].sort(),
  );
});
