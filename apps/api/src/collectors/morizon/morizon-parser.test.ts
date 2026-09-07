import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMorizonSearchUrl,
  externalIdFromMorizonUrl,
  extractMorizonReferences,
  parseMorizonListing,
} from "./morizon-parser";

const offerUrl =
  "https://www.morizon.pl/oferta/sprzedaz-mieszkanie-warszawa-bialoleka-zeglugi-wislanej-67m2-mzn2047781128";

test("builds filtered Morizon result pages and discovers unique offer URLs", () => {
  const page = new URL(buildMorizonSearchUrl("Warszawa", 2));
  assert.equal(page.searchParams.get("ps[living_area_from]"), "56");
  assert.equal(page.searchParams.get("ps[market_type]"), "2");
  assert.equal(page.searchParams.get("ps[number_of_rooms_from]"), "3");
  assert.equal(page.searchParams.get("ps[price_from]"), "900000");
  assert.equal(page.searchParams.get("ps[price_to]"), "2000000");
  assert.equal(page.searchParams.get("page"), "2");
  assert.equal(externalIdFromMorizonUrl(offerUrl), "morizon-2047781128");
  assert.deepEqual(
    extractMorizonReferences(`<a href="/oferta/test-mzn2047781128"></a><a href="${offerUrl}"></a>`),
    [{ externalId: "morizon-2047781128", url: offerUrl }],
  );
});

test("parses Morizon schema data, information tables, dates, phone and ordered gallery", () => {
  const image = (id: string, number: number) => `
    <img alt="Mieszkanie Warszawa - zdjęcie ${number}"
      src="https://img1.staticmorizon.com.pl/thumb/${id}/3x2_xs:fill/image.jpg"
      srcset="https://img1.staticmorizon.com.pl/thumb/${id}/3x2_s:fit/image.jpg 450w, https://img1.staticmorizon.com.pl/thumb/${id}/3x2_xl:fit/image.jpg 1350w">`;
  const row = (label: string, value: string, cy = "itemValue") => `
    <div data-cy="informationTableRow"><span data-cy="informationTableLabel">${label}</span><div><div data-cy="${cy}">${value}</div></div></div>`;
  const html = `
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org/",
      "@type": "Offer",
      name: "Mieszkanie na sprzedaż",
      url: offerUrl,
      price: 929000,
      description: "<p>Przy ul. Żeglugi Wiślanej 1 na warszawskiej Białołęce. Balkon i garaż.</p>",
      image: "https://img1.staticmorizon.com.pl/thumb/photo-1/3x2_l:fit/image.jpg",
      seller: { "@type": "Organization", telephone: "222 668 143" },
    })}</script>
    <h1>Nowoczesne 4-pokojowe mieszkanie po remoncie</h1>
    ${row("Pow. całkowita", "67,90 m²")}
    ${row("Piętro", "1/3")}
    ${row("Liczba pięter", "3")}
    ${row("Liczba pokoi", "4")}
    ${row("Rynek", "Wtórny")}
    ${row("Rok budowy", "2012")}
    ${row("Data dodania", "15.07.2026")}
    ${row("Aktualizacja", "21.08.2026")}
    ${row("Numer ogłoszenia", "morizon-44125/3685/OMS", "propertyNumber")}
    ${image("photo-2", 2)}${image("photo-1", 1)}${image("photo-3", 3)}
    <swiper-slide aria-label="3 / 3"></swiper-slide>
    <script>({"latitude":12,"longitude":13},52.3606173,21.0389086)</script>`;
  const parsed = parseMorizonListing(offerUrl, html);
  assert.equal(parsed.externalId, "morizon-2047781128");
  assert.equal(parsed.title, "Nowoczesne 4-pokojowe mieszkanie po remoncie");
  assert.equal(parsed.priceAmount, 929000);
  assert.equal(parsed.areaSqm, 67.9);
  assert.equal(parsed.rooms, 4);
  assert.equal(parsed.floor, 1);
  assert.equal(parsed.totalFloors, 3);
  assert.equal(parsed.yearBuilt, 2012);
  assert.equal(parsed.district, "Białołęka");
  assert.equal(parsed.street, "Żeglugi Wiślanej 1");
  assert.equal(parsed.sourceContactPhone, "222668143");
  assert.equal(parsed.publishedAt, "2026-07-15T00:00:00.000Z");
  assert.equal(parsed.latitude, 52.3606173);
  assert.equal(parsed.longitude, 21.0389086);
  assert.equal(parsed.images.length, 3);
  assert.match(parsed.images[0].sourceUrl, /photo-1.*3x2_xl/);
  assert.equal(parsed.rawPayload.galleryExpectedCount, 3);
});

test("prefers Morizon detail rows, highlighted floor and revealed phone", () => {
  const html = `
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Offer",
      name: "Mieszkanie na sprzedaż, 68 m²",
      price: 1_971_000,
      seller: { telephone: "222668143" },
    })}</script>
    <h1>Mieszkanie na sprzedaż, 68 m²</h1>
    <div data-cy="informationTableRow">
      <div><span data-cy="informationTableLabel">Pow. całkowita</span></div>
      <div><div data-cy="itemValue">66 m²</div></div>
    </div>
    <div data-cy="informationTableRow">
      <div><span data-cy="informationTableLabel">Liczba pokoi</span></div>
      <div><a href="/mieszkania/3-pokojowe/warszawa/mokotow/"><span data-cy="itemValue">3</span></a></div>
    </div>
    <div class="details-highlighted-parameters__item-content">
      <div data-cy="detailsHighlightedParametersLabel">Piętro</div>
      <div data-cy="detailsHighlightedParametersValue"><strong>parter z 7</strong></div>
    </div>
    <span class="phone-contact__number">60664...</span>
    <div class="phone-contact__number" data-cy="phoneContactNumber">606644332</div>`;

  const parsed = parseMorizonListing(offerUrl, html);
  assert.equal(parsed.areaSqm, 66);
  assert.equal(parsed.rooms, 3);
  assert.equal(parsed.floor, 0);
  assert.equal(parsed.totalFloors, 7);
  assert.equal(parsed.sourceContactPhone, "606644332");
});

test("keeps serialized gallery images from the current offer and excludes similar offers", () => {
  const token = (group: string, image: number) =>
    Buffer.from(
      `https://d-gr.cdngr.pl/kadry/k/r/gr-ogl/22/74/${group}_${image}_mieszkanie.jpg`,
    ).toString("base64url");
  const current = [token("48257521", 101), token("48257521", 102), token("48257521", 103)];
  const similar = token("99999999", 201);
  const imageUrl = (value: string, variant = "3x2_s:fill_and_crop") =>
    `https://img1.staticmorizon.com.pl/thumb/${value}/${variant}/mieszkanie.jpg`;
  const html = `
    <script type="application/ld+json">${JSON.stringify({ "@type": "Offer", image: imageUrl(current[0]), price: 950000 })}</script>
    <h1>Mieszkanie Warszawa Białołęka</h1>
    <script>${JSON.stringify([
      imageUrl(current[0]),
      imageUrl(current[1], "3x2_l:fit"),
      imageUrl(current[2]),
      imageUrl(similar, "3x2_xl:fit"),
    ])}</script>`;
  const parsed = parseMorizonListing(offerUrl, html);
  assert.equal(parsed.images.length, 3);
  assert.ok(parsed.images.every((image) => image.sourceUrl.includes("/3x2_xl:fit/")));
  assert.ok(parsed.images.every((image) => !image.sourceUrl.includes(similar)));
});

test("marks Morizon archived notification as removed", () => {
  const parsed = parseMorizonListing(
    offerUrl,
    `<h1>Archiwalne mieszkanie</h1><div class="notification archived__notification"><h2>To ogłoszenie nie jest już dostępne.</h2></div>`,
  );
  assert.equal(parsed.status, "removed");
});

test("uses the dedicated Morizon location row instead of an unrelated h2 heading", () => {
  const html = `
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Offer",
      description:
        "Praktycznie jak pierwsze piÄ™tro - od ulicy pierwsze piÄ™tro - od dziedziĹ„ca murek na podwyĹĽszeniu.",
    })}</script>
    <h1>Mieszkanie na sprzedaĹĽ</h1>
    <h2>pierwsze piÄ™tro - od dziedziĹ„ca murek na podwyĹĽszeniu</h2>
    <div class="location-row" data-cy="locationRowButton">
      <div>
        <h2 class="location-row__heading" data-cy="locationRowTitle">
          <span>Przy Agorze</span>
          <div class="location-row__main-location">
            <span>mazowieckie,&nbsp;</span>
            <span>Warszawa,&nbsp;</span>
            <span>Bielany</span>
          </div>
        </h2>
      </div>
    </div>`;

  const parsed = parseMorizonListing(offerUrl, html);
  assert.equal(parsed.street, "Przy Agorze");
  assert.equal(parsed.district, "Bielany");
  assert.equal(parsed.addressText, "Przy Agorze, Bielany, Warszawa");
});

test("prefers an explicitly named street in the description over the Morizon location row", () => {
  const html = `
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Offer",
      description: "Mieszkanie znajduje siÄ™ przy ulicy Marymonckiej 12, blisko metra.",
    })}</script>
    <h1>Mieszkanie na sprzedaĹĽ</h1>
    <h2 data-cy="locationRowTitle">
      <span>Przy Agorze</span>
      <div class="location-row__main-location"><span>mazowieckie</span><span>Warszawa</span><span>Bielany</span></div>
    </h2>`;

  const parsed = parseMorizonListing(offerUrl, html);
  assert.equal(parsed.street, "Marymonckiej 12");
  assert.equal(parsed.district, "Bielany");
});
