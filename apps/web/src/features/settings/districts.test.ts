import test from "node:test";
import assert from "node:assert/strict";
import { warsawDreamDistrictCatalog } from "./districts";
import { readFileSync } from "node:fs";

test("district selectors include all 18 Warsaw districts exactly once", () => {
  const expected = [
    "Bemowo",
    "Białołęka",
    "Bielany",
    "Mokotów",
    "Ochota",
    "Praga-Południe",
    "Praga-Północ",
    "Rembertów",
    "Śródmieście",
    "Targówek",
    "Ursus",
    "Ursynów",
    "Wawer",
    "Wesoła",
    "Wilanów",
    "Włochy",
    "Wola",
    "Żoliborz",
  ];
  assert.deepEqual(warsawDreamDistrictCatalog.map((item) => item.district).sort(), expected.sort());
});

test("every MSI area from the statistics map is selectable under its district", () => {
  const data = JSON.parse(
    readFileSync(new URL("../../../public/data/warsaw-msi.geojson", import.meta.url), "utf8"),
  );
  const expected = data.features
    .map(
      (feature: { properties: { district: string; name: string } }) =>
        `${feature.properties.district}:${feature.properties.name}`,
    )
    .sort();
  const actual = warsawDreamDistrictCatalog
    .flatMap((item) => item.subdistricts.map((name) => `${item.district}:${name}`))
    .sort();
  assert.deepEqual(actual, expected);
  assert.deepEqual(
    [...warsawDreamDistrictCatalog.find((item) => item.district === "Ursus")!.subdistricts].sort(),
    ["Czechowice", "Gołąbki", "Niedźwiadek", "Skorosze", "Szamoty"].sort(),
  );
});
