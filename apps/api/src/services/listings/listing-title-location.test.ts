import assert from "node:assert/strict";
import test from "node:test";
import {
  extractStreetFromLocationTitle,
  inferWarsawDistrictFromLocationTitle,
  inferWarsawDistrictFromAddressDescription,
} from "./listing-title-location";

test("explicit city-district address is distinct from nearby transport", () => {
  assert.equal(
    inferWarsawDistrictFromAddressDescription(
      "Lokal znajduje się w Warszawie-Wesołej przy ul. Długiej 80B.",
    ),
    "Wesoła",
  );
  assert.equal(
    inferWarsawDistrictFromAddressDescription(
      "Mieszkanie zlokalizowane w Warszawie-Mokotowie przy ul. Testowej.",
    ),
    "Mokotów",
  );
  assert.equal(
    inferWarsawDistrictFromAddressDescription("Stacja PKP Wesoła oddalona 1,5 km."),
    undefined,
  );
  assert.equal(
    inferWarsawDistrictFromAddressDescription(
      "Szybki dojazd do Warszawy-Wesołej przy ul. Testowej.",
    ),
    undefined,
  );
});

test("extracts a Warsaw district and street from a portal location suffix", () => {
  const title = "Zapraszam do 83 m² dwupoziomowego mieszkania: Warszawa Targówek Zacisze: Uznamska";

  const district = inferWarsawDistrictFromLocationTitle(title);

  assert.equal(district, "Targówek");
  assert.equal(extractStreetFromLocationTitle(title, district, "Warszawa"), "Uznamska");
});

test("uses the location suffix instead of a district mentioned in marketing copy", () => {
  const title = "15 minut od Mokotowa: Warszawa Wola: Towarowa";

  assert.equal(inferWarsawDistrictFromLocationTitle(title), "Wola");
});

test("does not treat a city or district suffix as a street", () => {
  assert.equal(
    extractStreetFromLocationTitle("Mieszkanie, Warszawa", "Targówek", "Warszawa"),
    undefined,
  );
  assert.equal(
    extractStreetFromLocationTitle("Mieszkanie: Targówek", "Targówek", "Warszawa"),
    undefined,
  );
});

test("tax and commission marketing in a title is not a street", () => {
  for (const suffix of ["bez Pcc", "bez prowizji", "VAT 8%"])
    assert.equal(
      extractStreetFromLocationTitle(
        `4 pokoje, Miasteczko Wilanów, ${suffix}`,
        "Wilanów",
        "Warszawa",
      ),
      undefined,
    );
});
