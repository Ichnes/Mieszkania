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
      t.mock.method(globalThis, "fetch", async () => new Response(page));
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
    t.mock.method(globalThis, "fetch", async () => new Response(html));
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
