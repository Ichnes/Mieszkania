import assert from "node:assert/strict";
import test from "node:test";
import { extractGratkaBuildingYear } from "./gratka-parser";

test("Gratka reads the building field of the requested offer and skips recommended properties", () => {
  const nodes = [
    { "property-details-/ob/123-false": 1 },
    { data: 2 },
    { propertyData: 3, similarProperties: 7 },
    { buildingDetailedInformation: 4 },
    [5],
    { label: 6, value: 8 },
    "Rok budowy",
    { yearBuilt: 2000 },
    "1998",
  ];
  const html = '<script id="__NUXT_DATA__">' + JSON.stringify(nodes) + "</script>";
  assert.equal(extractGratkaBuildingYear(html, "https://gratka.pl/ob/123"), 1998);
  assert.equal(extractGratkaBuildingYear(html, "https://gratka.pl/ob/12"), undefined);
});
