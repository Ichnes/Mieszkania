import assert from "node:assert/strict";
import test from "node:test";
import { OtodomParser } from "./otodom-parser";

test("Otodom recognizes the floor plan picture, prefers large image and preserves its gallery role", async () => {
  const url = "https://ireland.apollo.olxcdn.com/v1/files/plan/image";
  const parsed = await new OtodomParser().parse({
    url: "https://www.otodom.pl/pl/oferta/test-IDfloorplan",
    statusCode: 200,
    html: `<title>Mieszkanie</title><script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { ad: { title: "Mieszkanie", images: [{ large: "https://example.com/photo.jpg" }, { large: url + ";s=655x491;q=80" }] } } } })}</script>
      <label><input id="Rzut" type="radio">Rzut</label>
      <picture data-sentry-source-file="MosaicFloorPlanImage.tsx"><source media="(min-width: 768px)" srcset="${url};s=2048x1536;q=80"><img src="${url};s=655x491;q=80" alt="Rzut tego lokalu"></picture>`,
  });
  assert.equal(parsed.images.length, 2);
  assert.equal(parsed.images[0].isPrimary, true);
  assert.equal(parsed.images[1].caption, "Rzut");
  assert.equal(parsed.images[1].sourceUrl, url + ";s=2048x1536;q=80");
});

test("Otodom does not invent a floor plan from the chip or an unrelated picture", async () => {
  const parsed = await new OtodomParser().parse({
    url: "https://www.otodom.pl/pl/oferta/test-IDfloorplan",
    statusCode: 200,
    html: '<title>Mieszkanie</title><label><input id="Rzut">Rzut</label><picture><img src="https://example.com/photo.jpg" alt="Salon"></picture>',
  });
  assert.equal(parsed.images.filter((image) => image.caption === "Rzut").length, 0);
});
test("Otodom initial data has floorPlans separately, without rendered gallery markup", async () => {
  const parsed = await new OtodomParser().parse({
    url: "https://www.otodom.pl/pl/oferta/test-IDfloorplan",
    statusCode: 200,
    html: `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { ad: { title: "Mieszkanie", images: [{ large: "https://example.com/photo.jpg" }], floorPlans: ["https://example.com/plan.jpg"], plans: null } } } })}</script>`,
  });
  assert.deepEqual(
    parsed.images.map((image) => [image.sourceUrl, image.caption, image.isPrimary]),
    [
      ["https://example.com/photo.jpg", undefined, true],
      ["https://example.com/plan.jpg", "Rzut", false],
    ],
  );
});
