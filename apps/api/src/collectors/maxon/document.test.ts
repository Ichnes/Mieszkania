import assert from "node:assert/strict";
import test from "node:test";
import { parseListing } from "./index";
import { assertMaxonDetailPage, maxonCurrentReferences, resolveMaxonLegacyUrl } from "./document";
import { publicHttp } from "../../services/http/public-fetch";

const current =
  "https://www.maxon.pl/oferta/mieszkanie-sprzedaz-warszawa-srodmiescie-mazowieckie-ul-zgoda-163271";
test("current Maxon structured offer provides price, dimensions and gallery", () => {
  const data = {
    "@type": "RealEstateListing",
    image: ["https://files.maxon.pl/offers/main/photo.webp"],
    offers: { price: 1245000 },
    about: {
      floorSize: { value: 65.08 },
      numberOfRooms: 3,
      floorLevel: "0",
      yearBuilt: 1960,
      address: { streetAddress: "mazowieckie, ul. Zgoda", addressLocality: "Warszawa" },
    },
  };
  const parsed = parseListing(
    current,
    `<script type="application/ld&#x2B;json">${JSON.stringify(data)}</script><h1>Mieszkanie</h1>`,
    "",
    "maxon-163271",
  );
  assert.equal(parsed.priceAmount, 1245000);
  assert.equal(parsed.areaSqm, 65.08);
  assert.equal(parsed.rooms, 3);
  assert.equal(parsed.floor, 0);
  assert.equal(parsed.street, "Zgoda");
  assert.equal(parsed.addressText, "ul. Zgoda");
  assert.equal(parsed.images.length, 1);
});

test("current discovery and sitemap deduplicate stable numeric identities", () => {
  assert.deepEqual(
    maxonCurrentReferences(
      `<a href="${current}">Offer</a><loc>${current}</loc><a href="https://evil.example/oferta/test-163271">other</a>`,
    ),
    [{ externalId: "maxon-163271", url: current }],
  );
});

test("legacy URLs resolve only by matching stable identity; missing offers remain explicit", async (t) => {
  const fetch = t.mock.method(
    publicHttp,
    "fetch",
    async () => new Response(`<loc>${current}</loc>`),
  );
  assert.equal(
    await resolveMaxonLegacyUrl(
      "https://www.maxon.pl/mieszkania/oferta/old-123-ms-max",
      "maxon-163271",
    ),
    current,
  );
  await assert.rejects(
    resolveMaxonLegacyUrl(
      "https://www.maxon.pl/mieszkania/oferta/other-456-ms-max",
      "maxon-164972",
    ),
    /MAXON_LEGACY_URL/,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test("a listing redirect is not a missing price or proof that an offer was sold", () => {
  assert.throws(
    () => assertMaxonDetailPage('<body data-gtm-page="listing"><span>900 000 zł</span></body>'),
    /MAXON_LISTING_REDIRECT/,
  );
  assert.doesNotThrow(() => assertMaxonDetailPage('<body data-gtm-page="offer"></body>'));
});
