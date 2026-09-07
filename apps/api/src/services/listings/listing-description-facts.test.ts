import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichListingFromDescription,
  inferConstructionYear,
  inferStructuredConstructionYear,
} from "./listing-description-facts";

test("infers construction years from common Polish listing phrases", () => {
  assert.equal(inferConstructionYear("Rok budowy: 2009", 2026), 2009);
  assert.equal(inferConstructionYear("Mieszkanie w kameralnym budynku z 1998 roku.", 2026), 1998);
  assert.equal(inferConstructionYear("Apartamentowiec premium z 2019 roku.", 2026), 2019);
  assert.equal(inferConstructionYear("Mieszkanie w budynku z 1991 r.", 2026), 1991);
  assert.equal(inferConstructionYear("Lokal w budynku z cegły z 2002 r.", 2026), 2002);
  assert.equal(
    inferConstructionYear("Apartament w inwestycji Central House z 2022 roku.", 2026),
    2022,
  );
  assert.equal(inferConstructionYear("Budynek 2007 roku budowy.", 2026), 2007);
  assert.equal(
    inferConstructionYear("Budynek został oddany do użytkowania w 2015 roku.", 2026),
    2015,
  );
  assert.equal(inferConstructionYear("Willa z 1928 roku, odbudowana w 2008 roku.", 2026), 1928);
  assert.equal(
    inferConstructionYear("Planowany termin zakończenia inwestycji to 30.03.2026 roku.", 2026),
    2026,
  );
});

test("does not mistake unrelated dates for a construction year", () => {
  assert.equal(
    inferConstructionYear("Mieszkanie po generalnym remoncie z 2020 roku.", 2026),
    undefined,
  );
  assert.equal(
    inferConstructionYear("Nowe okna z 2025 roku, budynek przedwojenny.", 2026),
    undefined,
  );
  assert.equal(inferConstructionYear("Oferta opublikowana w 2024 roku.", 2026), undefined);
  assert.equal(
    inferConstructionYear("Obok stacja metra oddana do użytku w 2026 roku.", 2026),
    undefined,
  );
  assert.equal(inferConstructionYear("Rok budowy: 2099", 2026), undefined);
});

test("enrichment persists an inferred year but preserves a portal value", () => {
  const base = {
    externalId: "1",
    canonicalUrl: "https://example.test/1",
    title: "Mieszkanie",
    description: "Lokal w budynku z 1996 roku.",
    city: "Warszawa",
    marketType: "secondary" as const,
    offerType: "sale" as const,
    status: "active" as const,
    images: [],
    rawPayload: {},
  };

  assert.equal(enrichListingFromDescription(base).yearBuilt, 1996);
  assert.equal(enrichListingFromDescription({ ...base, yearBuilt: 2010 }).yearBuilt, 2010);
});

test("reads a valid structured construction year and ignores portal zero placeholders", () => {
  assert.equal(
    inferStructuredConstructionYear({ yearBuilt: 0, nested: { construction_year: "2018" } }, 2026),
    2018,
  );
  assert.equal(inferStructuredConstructionYear({ buildingYear: 2099 }, 2026), undefined);
});

test("import uses the same ground-floor interpretation as existing listings", () => {
  const listing = enrichListingFromDescription({
    title: "Mieszkanie",
    description: "Garaż i komórka. Mieszkanie znajduje się na parterze w 3 piętrowym budynku.",
    city: "Warszawa",
    externalId: "example",
    canonicalUrl: "https://example.com",
    marketType: "secondary",
    offerType: "sale",
    status: "active",
    images: [],
    rawPayload: {},
  });
  assert.equal(listing.floor, 0);
  assert.equal(listing.totalFloors, 3);
});
