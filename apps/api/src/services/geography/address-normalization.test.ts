import assert from "node:assert/strict";
import test from "node:test";

test("retains house numbers when normalizing declined street names and cuts location prose", () => {
  assert.equal(
    normalizeWarsawStreetCandidate("Gwiaździstej 13 na warszawskim Żoliborzu"),
    "Gwiaździsta 13",
  );
  assert.equal(
    sanitizeWarsawAddressText("Gwiaździstej 13 na warszawskim Żoliborzu, Żoliborz, Warszawa"),
    "Gwiaździsta 13, Żoliborz, Warszawa",
  );
  assert.equal(normalizeWarsawStreetCandidate("Gwiaździsta 13A/2"), "Gwiaździsta 13A/2");
  assert.equal(normalizeWarsawStreetCandidate("Złotej 44"), "Złota 44");
  assert.equal(normalizeWarsawStreetCandidate("Na Skraju 12"), "Na Skraju 12");
});
import { estimateWarsawNeighborhood } from "../insights/listing-neighborhood-estimator";
import {
  normalizeWarsawListingCity,
  normalizeWarsawStreetCandidate,
  sanitizeStreetCandidate,
  sanitizeWarsawAddressText,
} from "./address-normalization";
import {
  canonicalWarsawDistrict,
  canonicalWarsawNeighborhood,
  inferWarsawNeighborhood,
} from "./warsaw-neighborhoods";

test("cuts listing prose after a single-word street name", () => {
  assert.equal(
    sanitizeStreetCandidate("ul. Lubelska Przedmiotem sprzedaży jest ciche mieszkanie"),
    "Lubelska",
  );
});

test("cuts listing prose without damaging multi-word street names", () => {
  assert.equal(
    sanitizeStreetCandidate("al. Stanów Zjednoczonych Mieszkanie znajduje się na trzecim piętrze"),
    "Stanów Zjednoczonych",
  );
  assert.equal(normalizeWarsawStreetCandidate("Batalionów Chłopskich"), "Batalionów Chłopskich");
  assert.equal(
    normalizeWarsawStreetCandidate("Komisji Edukacji Narodowej"),
    "Komisji Edukacji Narodowej",
  );
});

test("cuts prose that starts directly after a street name", () => {
  assert.equal(sanitizeStreetCandidate("Umińskiego położone jest na Gocławiu"), "Umińskiego");
});

test("accepts only known Warsaw neighborhoods and understands inflected names", () => {
  assert.equal(canonicalWarsawNeighborhood("Gocław", "Praga-Południe"), "Gocław");
  assert.equal(canonicalWarsawNeighborhood("Fundamentowa", "Praga-Południe"), undefined);
  assert.equal(canonicalWarsawNeighborhood("Biskupia", "Praga-Południe"), undefined);
  assert.equal(
    inferWarsawNeighborhood("Mieszkanie położone jest na Gocławiu", "Praga-Południe"),
    "Gocław",
  );
  assert.equal(
    inferWarsawNeighborhood("Mieszkanie położone jest na Gocławiu", "Mokotów"),
    undefined,
  );
});

test("normalizes district fields that contain a neighborhood or a combined portal label", () => {
  assert.equal(canonicalWarsawDistrict("Goclaw"), "Praga-Południe");
  assert.equal(canonicalWarsawDistrict("Śródmieście Powiśle"), "Śródmieście");
  assert.equal(canonicalWarsawDistrict("MOKOTÓW"), "Mokotów");
  assert.equal(canonicalWarsawDistrict("Fundamentowa"), undefined);
});

test("estimates a neighborhood from the same street and the nearest confirmed point", () => {
  const references = [
    {
      id: "north",
      district: "Śródmieście",
      neighborhood: "Śródmieście Północne",
      addressText: "Nowogrodzka, Warszawa",
      latitude: 52.232,
      longitude: 21.012,
    },
    {
      id: "south",
      district: "Śródmieście",
      neighborhood: "Śródmieście Południowe",
      addressText: "Nowogrodzka, Warszawa",
      latitude: 52.225,
      longitude: 21.006,
    },
  ];
  assert.equal(
    estimateWarsawNeighborhood(
      { district: "Śródmieście", street: "Nowogrodzka", latitude: 52.2252, longitude: 21.0062 },
      references,
    ),
    "Śródmieście Południowe",
  );
});

test("prefers a confirmed street location over a neighborhood mentioned in marketing copy", () => {
  const references = [
    {
      id: "street",
      district: "Praga-Południe",
      neighborhood: "Grochów",
      addressText: "Grochowska, Warszawa",
      latitude: 52.244,
      longitude: 21.084,
    },
  ];
  assert.equal(
    estimateWarsawNeighborhood(
      {
        district: "Praga-Południe",
        street: "Grochowska",
        description: "Kilka minut samochodem od Gocławia",
        latitude: 52.244,
        longitude: 21.084,
      },
      references,
    ),
    "Grochów",
  );
});

test("sanitizes the street component while preserving the rest of an address", () => {
  assert.equal(
    sanitizeWarsawAddressText(
      "Lubelska Przedmiotem sprzedaży jest ciche, Praga-Południe, Warszawa",
      { district: "Praga-Południe", city: "Warszawa" },
    ),
    "Lubelska, Praga-Południe, Warszawa",
  );
});

test("does not mistake a district followed by prose for a street", () => {
  assert.equal(
    sanitizeWarsawAddressText(
      "Mokotów, wszystko w zasięgu ręki! Mieszkanie znajduje się blisko metra",
      { district: "Mokotów", city: "Warszawa" },
    ),
    "Mokotów, Warszawa",
  );
});

test("does not keep a decorated neighborhood label as a street", () => {
  assert.equal(
    sanitizeWarsawAddressText("74 m² Żerań, Żerań, Warszawa", {
      district: "Białołęka",
      neighborhood: "Żerań",
      city: "Warszawa",
    }),
    "Żerań, Warszawa",
  );
  assert.equal(
    sanitizeWarsawAddressText("metro Natolin, Natolin, Warszawa", {
      district: "Ursynów",
      neighborhood: "Natolin",
      city: "Warszawa",
    }),
    "Natolin, Warszawa",
  );
});

test("recovers Warsaw when a portal puts listing prose in the city field", () => {
  assert.equal(
    normalizeWarsawListingCity("Mieszkanie znajduje się przy ul. Cybernetyki", "Mokotów"),
    "Warszawa",
  );
});
