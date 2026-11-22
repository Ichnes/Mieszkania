import assert from "node:assert/strict";
import test from "node:test";
import { AdresowoCollector, extractAdresowoConstructionYear, parseListing } from "./index";
import { publicHttp } from "../../services/http/public-fetch";
import { archiveUnavailableListing } from "../../services/listings/listing-archive";

test("reads the construction year from the current Adresowo summary", () => {
  const html = `<span class="block text-sm text-neutral-500 lg:text-neutral-600">z windą, rok budowy&nbsp;2006</span>`;
  assert.equal(extractAdresowoConstructionYear(html), 2006);
});

test("reads the construction year from visible text without a colon", () => {
  assert.equal(extractAdresowoConstructionYear("", "z windą, rok budowy 2006"), 2006);
});

test("does not confuse an arbitrary four-digit number with the construction year", () => {
  assert.equal(extractAdresowoConstructionYear("<p>Telefon 2018</p>"), undefined);
});

const listingUrl = "https://adresowo.pl/o/oferta-testowa-a1b2c3";
const searchText = "Średnia 21 583 zł/m² 67 ofert";

test("Adresowo takes the total price from the offer rather than the average search price", () => {
  assert.equal(parseListing(listingUrl, "", searchText, "adresowo-a1b2c3").priceAmount, undefined);
  const html = '<script type="application/ld+json">{"@type":"Offer","price":1790000}</script>';
  assert.equal(parseListing(listingUrl, html, searchText, "adresowo-a1b2c3").priceAmount, 1790000);
});

test("Adresowo archives an offer redirected to the search page without saving its prices", async (t) => {
  const page = new Response(`<h1>Oferty w Wilanowie</h1><p>${searchText}</p>`);
  Object.defineProperty(page, "url", {
    value: "https://adresowo.pl/mieszkania/warszawa/wilanow-K/",
  });
  t.mock.method(publicHttp, "fetch", async () => page);
  const collector = new AdresowoCollector((input) =>
    archiveUnavailableListing(input, async (identity) => {
      assert.equal(identity.externalId, "adresowo-a1b2c3");
      assert.match(identity.reason ?? "", /przekierowuje/);
      return { listingId: "existing", action: "archived", reason: identity.reason };
    }),
  );
  assert.deepEqual(await collector.collectOne(listingUrl, { refreshMode: "price_only" }), {
    listingId: "existing",
    snapshotId: "",
    action: "updated",
    mediaAssets: [],
  });
});

test("Adresowo rejects a redirect to a different offer", async (t) => {
  const page = new Response(
    '<script type="application/ld+json">{"@type":"Offer","price":1790000}</script>',
  );
  Object.defineProperty(page, "url", { value: "https://adresowo.pl/o/inne-ogloszenie-x9y8z7" });
  t.mock.method(publicHttp, "fetch", async () => page);
  await assert.rejects(
    new AdresowoCollector().collectOne(listingUrl, { refreshMode: "price_only" }),
    /UNEXPECTED_ADRESOWO_LISTING_DOCUMENT/,
  );
});
