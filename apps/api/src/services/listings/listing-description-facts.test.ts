import assert from "node:assert/strict";
import test from "node:test";
import { inferBuildingDetails } from "./listing-description-facts";

test("explicit Warsaw district and multiline street override an incorrect portal address", () => {
  const description =
    "Komfortowe mieszkanie znajduje się w Warszawie-Wesołej przy ul.\n\nDługiej 80B na drugim piętrze w 2 kondygnacyjnym budynku z 2020r.";
  const listing = enrichListingFromDescription({
    title: "Mieszkanie",
    description,
    externalId: "test",
    canonicalUrl: "https://example.test",
    city: "Warszawa",
    district: "Śródmieście",
    neighborhood: "Śródmieście Północne",
    street: "Długa",
    addressText: "Długa, Śródmieście, Warszawa",
    images: [],
    rawPayload: {},
    marketType: "secondary",
    offerType: "sale",
    status: "active",
  });
  assert.equal(listing.street, "Długa 80B");
  assert.equal(listing.district, "Wesoła");
  assert.equal(listing.neighborhood, undefined);
  assert.equal(listing.addressText, "Długa 80B, Wesoła, Warszawa");
  assert.equal(listing.floor, 2);
  assert.equal(listing.totalFloors, 2);
  assert.equal(listing.yearBuilt, 2020);
  assert.equal(
    inferBuildingDetails("Lokal na drugim piętrze w 2-kondygnacyjnym budynku.").totalFloors,
    2,
  );
  assert.equal(inferBuildingDetails("Obok 2-kondygnacyjny budynek szkoły.").totalFloors, undefined);
});

test("last numbered or ordinal floor supplies the building height", () => {
  for (const phrase of [
    "Lokal mieści się na ostatnim, 4. piętrze w kameralnym budynku z ok. 2000 roku.",
    "Mieszkanie na ostatnim (4.) piętrze.",
    "Lokal na czwartym, ostatnim piętrze.",
    "Mieszkanie na 4. piętrze (ostatnim).",
    "Mieszkanie na ostatnim, czwartym piętrze.",
  ]) {
    const facts = inferBuildingDetails(phrase);
    assert.equal(facts.floor, 4, phrase);
    assert.equal(facts.totalFloors, 4, phrase);
  }
  assert.equal(inferBuildingDetails("Mieszkanie na ostatnim piętrze.").totalFloors, undefined);
  assert.equal(
    inferBuildingDetails("Lokal nie jest na ostatnim, 4. piętrze.").totalFloors,
    undefined,
  );
  assert.equal(
    inferBuildingDetails("Mieszkanie na 4. piętrze. Na ostatnim piętrze jest suszarnia.")
      .totalFloors,
    undefined,
  );
  assert.equal(
    inferBuildingDetails("Lokal na ostatnim, 4. piętrze w 5-piętrowym budynku.").totalFloors,
    5,
  );
});

test("approximate construction year requires building context and excludes renovation", () => {
  for (const approximate of ["ok.", "ok", "około", "circa"]) {
    assert.equal(
      inferConstructionYear(`Lokal w kameralnym budynku z ${approximate} 2000 roku.`),
      2000,
    );
  }
  assert.equal(inferConstructionYear("Blok po remoncie z ok. 2020 roku."), undefined);
  assert.equal(inferConstructionYear("Okna z około 2000 roku."), undefined);
  assert.equal(inferConstructionYear("Remont z ok. 2000 roku."), undefined);
  assert.equal(inferConstructionYear("Blok z ok. 2099 roku.", 2026), undefined);
});

test("shared import enrichment cleans street prose and fills floor and year for all portals", () => {
  const listing = enrichListingFromDescription({
    externalId: "example",
    canonicalUrl: "https://example.com",
    title: "Mieszkanie",
    description:
      "Mieszkanie przy ul. Szaserów na warszawskiej Pradze-Południe. Lokal mieści się na ostatnim, 4. piętrze w kameralnym budynku z ok. 2000 roku.",
    street: "Szaserów na warszawskiej Pradze-Południe",
    addressText: "Szaserów na warszawskiej Pradze-Południe, Warszawa",
    city: "Warszawa",
    district: "Praga-Południe",
    marketType: "secondary",
    offerType: "sale",
    status: "active",
    images: [],
    rawPayload: {},
  });
  assert.equal(listing.street, "Szaserów");
  assert.equal(listing.addressText, "Szaserów, Praga-Południe, Warszawa");
  assert.equal(listing.floor, 4);
  assert.equal(listing.totalFloors, 4);
  assert.equal(listing.yearBuilt, 2000);
  assert.equal(enrichListingFromDescription({ ...listing, street: undefined }).street, "Szaserów");
});

test("ground-floor commercial units do not make the apartment a ground-floor listing", () => {
  assert.equal(inferBuildingDetails("Na parterze lokale usługowe.").floor, undefined);
  assert.equal(
    inferBuildingDetails("Na parterze znajdują się lokale usługowe. Mieszkanie na trzecim piętrze.")
      .floor,
    3,
  );
  assert.equal(inferBuildingDetails("Mieszkanie na parterze.").floor, 0);
});
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
