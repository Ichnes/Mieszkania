import assert from "node:assert/strict";
import test from "node:test";
import { AdresowoCollector, parseListing as parseAdresowo } from "./adresowo";
import { MaxonCollector, parseListing as parseMaxon } from "./maxon";
import {
  archiveUnavailableListing,
  ListingUnavailableBeforeImportError,
} from "../services/listings/listing-archive";

const banners = [
  {
    sourceKey: "adresowo",
    Collector: AdresowoCollector,
    parse: parseAdresowo,
    html: '<div class="rounded-md border border-rose-300 bg-rose-50"><p class="text-sm font-semibold text-rose-800">Ogłoszenie usunięte</p></div>',
  },
  {
    sourceKey: "maxon",
    Collector: MaxonCollector,
    parse: parseMaxon,
    html: '<div class="modal-content"><div class="modal-header"><h1>OFERTA NIEAKTUALNA</h1></div><div class="modal-body"><h4>Poszukiwana oferta 64681/MS/MAX nie jest już aktualna. Zapraszamy do przejrzenia innych ofert w naszej bazie lub do kontaktu z Naszym agentem.</h4></div></div>',
  },
];
for (const { sourceKey, Collector, parse, html } of banners) {
  const url = `https://${sourceKey}.pl/oferta/test`;
  for (const recommendation of [
    "",
    '<div>Podobne oferty: 900 000 zł</div><script type="application/ld+json">{"@type":"Offer","price":900000}</script>',
  ]) {
    test(`${sourceKey} archives the banner with${recommendation ? "" : "out"} recommendation prices`, async (t) => {
      const page = html + recommendation;
      assert.equal(parse(url, page, page.replace(/<[^>]+>/g, " "), "stored-id").status, "removed");
      let archived = 0;
      t.mock.method(publicHttp, "fetch", async () => new Response(page));
      const collector = new Collector((input) =>
        archiveUnavailableListing(input, async (identity) => {
          archived++;
          assert.equal(identity.sourceKey, sourceKey);
          assert.equal(identity.canonicalUrl, url);
          return { listingId: "existing-id", action: "archived", reason: identity.reason };
        }),
      );
      const result = await collector.collectOne(url, { refreshMode: "price_only" });
      assert.equal(archived, 1);
      assert.equal(result.listingId, "existing-id");
      assert.equal(result.snapshotId, "");
      assert.deepEqual(result.mediaAssets, []);
    });
  }
  test(`${sourceKey} does not import an unavailable offer missing from the database`, async (t) => {
    t.mock.method(publicHttp, "fetch", async () => new Response(html));
    const collector = new Collector((input) => archiveUnavailableListing(input, async () => null));
    await assert.rejects(
      collector.collectOne(url, { refreshMode: "price_only" }),
      ListingUnavailableBeforeImportError,
    );
  });
  test(`${sourceKey} ignores banners stored only in scripts or comments`, () => {
    const page = `<h1>Mieszkanie Warszawa</h1><script>const template=${JSON.stringify(html)}</script><!-- ${html} -->`;
    assert.equal(parse(url, page, "Mieszkanie Warszawa", "stored-id").status, "active");
  });
}
import { publicHttp } from "../services/http/public-fetch";

test("Maxon archives the exact offer on HTTP 404 or 410 without parsing recommendations", async (t) => {
  const url = "https://www.maxon.pl/oferta/oferta-testowa-123456";
  let status = 410;
  t.mock.method(
    publicHttp,
    "fetch",
    async () =>
      new Response('<body data-gtm-page="listing">Podobne oferty: 910 000 zł</body>', { status }),
  );
  const collector = new MaxonCollector((input) =>
    archiveUnavailableListing(input, async (identity) => {
      assert.equal(identity.externalId, "maxon-123456");
      assert.equal(identity.canonicalUrl, url);
      return { listingId: "existing-id", action: "archived", reason: identity.reason };
    }),
  );
  for (status of [404, 410]) {
    const result = await collector.collectOne(url, { refreshMode: "price_only" });
    assert.equal(result.listingId, "existing-id");
    assert.equal(result.snapshotId, "");
  }
  const missing = new MaxonCollector((input) => archiveUnavailableListing(input, async () => null));
  await assert.rejects(
    missing.collectOne(url, { refreshMode: "price_only" }),
    ListingUnavailableBeforeImportError,
  );
});

test("Maxon keeps a redirected offer out of the archive and import even when the target returns 410", async (t) => {
  const response = new Response("", { status: 410 });
  Object.defineProperty(response, "url", {
    value: "https://www.maxon.pl/oferta/inna-oferta-999999",
  });
  t.mock.method(publicHttp, "fetch", async () => response);
  const collector = new MaxonCollector(async () => assert.fail("Redirect is not proof of removal"));
  await assert.rejects(
    collector.collectOne("https://www.maxon.pl/oferta/oferta-testowa-123456", {
      refreshMode: "price_only",
    }),
    /MAXON_LISTING_REDIRECT/,
  );
});
