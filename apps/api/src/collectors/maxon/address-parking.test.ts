import assert from "node:assert/strict";
import test from "node:test";
import { getDreamDescriptionFacts } from "@mieszkania/shared";
import { parseListing } from "./index";
import { enrichListingFromDescription } from "../../services/listings/listing-description-facts";
import { extractFeatures } from "../../services/listings/listing-repository";
import { normalizePolish } from "../../services/geography/address-normalization";
import { extractStreetFromLocationTitle } from "../../services/listings/listing-title-location";

test("Maxon uses the address heading instead of promotional title words", () => {
  const listing = enrichListingFromDescription(
    parseListing(
      "https://www.maxon.pl/oferta",
      `<div class="shadow_box"><h1>Apart. 77mkw. Cybernetyki, Mokotów, zieleń, cisza</h1><h2>Warszawa, Mokotów, ul. Cybernetyki</h2></div>`,
      "",
      "test",
    ),
  );
  assert.equal(listing.street, "Cybernetyki");
  assert.match(listing.addressText!, /Cybernetyki/);
  assert.equal(extractStreetFromLocationTitle(listing.title, "Mokotów", "Warszawa"), undefined);
});

test("guest parking before or after the count does not count as apartment parking", () => {
  for (const guests of [
    "Dla gości przewidziano dodatkowo 7 miejsc postojowych na terenie posesji.",
    "7 miejsc postojowych na terenie posesji dla gości.",
  ]) {
    const features = extractFeatures({ description: guests });
    assert.equal(
      features.some((f) =>
        ["garage", "estate_parking", "outdoor_parking", "owned_parking"].includes(f.key),
      ),
      false,
    );
    assert.equal(getDreamDescriptionFacts(normalizePolish(guests)).multipleParking, false);
    const mixed = `Do mieszkania przynależy 1 miejsce w garażu podziemnym. ${guests}`;
    assert.equal(
      extractFeatures({ description: mixed }).find((f) => f.key === "garage")?.value,
      "1",
    );
    assert.equal(getDreamDescriptionFacts(normalizePolish(mixed)).multipleParking, false);
    assert.equal(
      getDreamDescriptionFacts(
        normalizePolish(`${guests} Do mieszkania przynależą dwa miejsca garażowe.`),
      ).multipleParking,
      true,
    );
  }
});
