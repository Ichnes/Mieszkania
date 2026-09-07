import assert from "node:assert/strict";
import test from "node:test";
import { GratkaParser } from "./gratka-parser";

test("keeps every Gratka gallery image and selects the 1350 px fit variant", async () => {
  const externalId = "48672139";
  const first = buildImageVariants(externalId, "1557247745");
  const second = buildImageVariants(externalId, "1557247759");
  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({
        "@type": "Product",
        name: "Mieszkanie Warszawa Nubijska",
        offers: { price: 1_200_000 },
        floorSize: 64,
        numberOfRooms: 3,
        address: { addressLocality: "Warszawa", streetAddress: "Nubijska" },
      })}
    </script>
    <swiper-container>
      <swiper-slide aria-label="1 / 2"><img data-cy="thumbnail" src="${first.small}" srcset="${first.srcset}"></swiper-slide>
      <swiper-slide aria-label="2 / 2"><img data-cy="thumbnail" src="${second.small}" srcset="${second.srcset}"></swiper-slide>
    </swiper-container>
  `;

  const parsed = await new GratkaParser().parse({
    url: `https://gratka.pl/nieruchomosci/mieszkanie/ob/${externalId}`,
    finalUrl: `https://gratka.pl/nieruchomosci/mieszkanie/ob/${externalId}`,
    statusCode: 200,
    html,
  });

  assert.equal(parsed.images.length, 2);
  assert.ok(parsed.images.every((image) => image.sourceUrl.includes("/3x2_xl:fit/")));
  assert.equal(new Set(parsed.images.map((image) => image.sourceUrl)).size, 2);
});

test("treats an offer redirected to the Gratka results page as removed", async () => {
  const originalUrl = "https://gratka.pl/nieruchomosci/mieszkanie-warszawa-bemowo/ob/48135325";
  const parsed = await new GratkaParser().parse({
    url: originalUrl,
    finalUrl: "https://gratka.pl/nieruchomosci/mieszkania/warszawa",
    statusCode: 200,
    html: `
      <html>
        <head><title>Mieszkania Warszawa - Gratka.pl</title></head>
        <body><h1>Mieszkania na sprzedaż Warszawa</h1></body>
      </html>
    `,
  });

  assert.equal(parsed.status, "removed");
  assert.equal(parsed.externalId, "gratka-48135325");
  assert.equal(parsed.canonicalUrl, originalUrl);
  assert.equal(parsed.priceAmount, undefined);
});

test("treats the Gratka archived notification as removed", async () => {
  const url = "https://gratka.pl/nieruchomosci/mieszkanie-warszawa/ob/48135326";
  const parsed = await new GratkaParser().parse({
    url,
    finalUrl: url,
    statusCode: 200,
    html: `
      <div class="notification archived__notification">
        <div class="notification__content">
          <h2 class="notification__title">To ogłoszenie nie jest już dostępne.</h2>
          <p>Na szczęście mamy coś podobnego.</p>
        </div>
      </div>`,
  });

  assert.equal(parsed.status, "removed");
});

test("distinguishes a Gratka street breadcrumb from a real Warsaw neighborhood", async () => {
  const parse = async (tail: string[], description: string) =>
    new GratkaParser().parse({
      url: "https://gratka.pl/nieruchomosci/mieszkanie-warszawa-praga-poludnie/ob/48799269",
      statusCode: 200,
      html: `
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        name: "Mieszkanie na sprzedaż",
        description,
        offers: { price: 1_200_000 },
        address: { addressLocality: "Warszawa" },
      })}</script>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "BreadcrumbList",
        itemListElement: ["Warszawa", "Praga-Południe", ...tail].map((name) => ({
          "@type": "ListItem",
          name,
        })),
      })}</script>`,
    });

  const streetOnly = await parse(["Fundamentowa"], "Mieszkanie przy ul. Fundamentowej.");
  assert.equal(streetOnly.neighborhood, undefined);
  assert.equal(streetOnly.street, "Fundamentowa");

  const withNeighborhood = await parse(
    ["Gocław", "Władysława Umińskiego"],
    "Na Pradze-Południe przy ul. Umińskiego BUDYNEK/OSIEDLE. Mieszkanie położone jest na Gocławiu.",
  );
  assert.equal(withNeighborhood.neighborhood, "Gocław");
  assert.equal(withNeighborhood.street, "Władysława Umińskiego");
});

function buildImageVariants(externalId: string, imageId: string) {
  const source = `https://d-gr.cdngr.pl/kadry/gr-og/${externalId}_${imageId}_mieszkanie-warszawa.jpg`;
  const payload = Buffer.from(source).toString("base64");
  const root = `https://thumbs.cdngr.pl/thumb/${payload}`;
  return {
    small: `${root}/3x2_xs:fill_and_crop/mieszkanie.jpg`,
    srcset: [
      `${root}/3x2_xs:fit/mieszkanie.jpg 300w`,
      `${root}/3x2_l:fit/mieszkanie.jpg 900w`,
      `${root}/3x2_xl:fit/mieszkanie.jpg 1350w`,
    ].join(", "),
  };
}
