import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFeatures,
  resolveListingAmenities,
  buildAmenityBadges,
  inferBuildingDetails,
} from "./listing-repository";
import { extractAdditionalPurchaseCosts as costs } from "./purchase-costs";

test("monthly fees do not consume unrelated, annual, rental or per-area costs", () => {
  for (const description of [
    "Opłata notarialna 2000 zł.",
    "Czynsz 1200 zł rocznie.",
    "Czynsz 12 zł/m².",
    "Czynsz najmu 3500 zł.",
    "Czynsz do uzgodnienia. Garaż 50000 zł.",
  ]) {
    assert.equal(
      extractFeatures({ description }).some((f) => f.key === "fees"),
      false,
      description,
    );
  }
  assert.equal(
    extractFeatures({ description: "Czynsz administracyjny wynosi około 950 zł." }).find(
      (f) => f.key === "fees",
    )?.value,
    "950 PLN",
  );
});

test("negations stop at contrasting clauses, but continue through an ani list", () => {
  const noGarage = buildAmenityBadges(extractFeatures({ description: "Mieszkanie bez garażu." }));
  assert.ok(noGarage.includes("Brak garażu"));
  assert.ok(!noGarage.includes("Brak miejsca postojowego"));
  const cases: Array<[string, string[], string[]]> = [
    ["Brak balkonu, ale jest taras.", ["terrace"], ["balcony"]],
    ["Bez garażu, za to z komórką lokatorską.", ["storage"], ["garage"]],
    ["Mieszkanie nie posiada balkonu ani tarasu.", [], ["balcony", "terrace"]],
    ["Balkon: brak. Komórka lokatorska: nie.", [], ["balcony", "storage"]],
    ["Mieszkanie bez prowizji z balkonem.", ["balcony"], []],
    ["Bez garażu, ale miejsce postojowe na parkingu naziemnym.", ["outdoor_parking"], ["garage"]],
    ["Brak balkonu. W mieszkaniu jest taras.", ["terrace"], ["balcony"]],
  ];
  for (const [description, present, absent] of cases) {
    const keys = extractFeatures({ description }).map((f) => f.key);
    for (const key of present) assert.ok(keys.includes(key), `${description}: missing ${key}`);
    for (const key of absent) assert.ok(!keys.includes(key), `${description}: false ${key}`);
  }
});

test("planned, absent and existing lifts remain distinct", () => {
  for (const [description, expected] of [
    ["W budynku planowana jest winda.", undefined],
    ["Winda: brak.", false],
    ["Budynek z windą.", true],
    ["Możliwość zakupu na kredyt, nowe windy w budynku.", true],
    ["Piętro: 1 z 2 (winda).", true],
    ["Miejsce z opcją najmu, winda w budynku.", true],
  ] as const) {
    assert.equal(
      resolveListingAmenities(extractFeatures({ description }), {}, description).lift,
      expected,
      description,
    );
  }
});

test("rental garages are available with rental tenure and unknown parking is not confirmed absence", () => {
  for (const description of [
    "Garaż podziemny wyłącznie do wynajęcia za 1500 zł miesięcznie.",
    "Miejsce postojowe w garażu do wynajęcia. Cena 1200 zł rocznie.",
  ]) {
    const f = extractFeatures({ description });
    assert.equal(resolveListingAmenities(f, {}, description).garage, true);
    assert.ok(buildAmenityBadges(f).includes("Garaż — najem"));
    assert.deepEqual(costs(description), {});
  }
  const f = extractFeatures({ description: "Jasne mieszkanie w centrum." });
  assert.equal(resolveListingAmenities(f).garage, undefined);
  assert.ok(buildAmenityBadges(f).includes("Brak danych o parkingu"));
  const description = "Do mieszkania przynależy garaż podziemny. Drugie miejsce można wynająć.";
  assert.equal(
    resolveListingAmenities(extractFeatures({ description }), {}, description).garage,
    true,
  );
  for (const description of [
    "Miejsce postojowe w garażu podziemnym dodatkowo płatne 80000 zł. Wspieramy klientów w sprzedaży, wynajmie i poszukiwaniu nieruchomości.",
    "Mieszkanie z garażem to inwestycja pod wynajem.",
  ]) {
    assert.equal(
      resolveListingAmenities(extractFeatures({ description }), {}, description).garage,
      true,
      description,
    );
  }
});

test("separate included amenities, purchase prices and recurring payments", () => {
  assert.deepEqual(costs("Komórka lokatorska w cenie, miejsce w garażu za 50000 zł."), {
    garage: 50000,
    storageIncluded: true,
  });
  assert.deepEqual(costs("Garaż w cenie, komórka za 20000 zł."), {
    storage: 20000,
    garageIncluded: true,
  });
  assert.deepEqual(costs("Miejsce postojowe za 50 tys. zł. Komórka za 20 tys. zł."), {
    garage: 50000,
    storage: 20000,
  });
  assert.deepEqual(costs("Miejsce postojowe: 1200 zł rocznie."), {});
  assert.deepEqual(costs("Garaż: 2000 zł/rok."), {});
  assert.deepEqual(costs("Garaż i komórka dodatkowo 70000 zł."), { garageAndStorage: 70000 });
});

test("floor written as 3 z 5 is a fraction, not missing data", () => {
  assert.deepEqual(inferBuildingDetails("Piętro: 3 z 5."), {
    floor: 3,
    totalFloors: 5,
    yearBuilt: undefined,
  });
});

test("premium tags do not promote absent or merely planned equipment", () => {
  for (const description of [
    "Brak ogrzewania podłogowego.",
    "Planowane ogrzewanie podłogowe.",
    "Wnętrze nie zostało zaprojektowane przez architekta.",
  ]) {
    assert.equal(
      extractFeatures({ description }).some((f) =>
        ["underfloor_heating", "architect_designed"].includes(f.key),
      ),
      false,
      description,
    );
  }
  assert.equal(
    resolveListingAmenities(
      extractFeatures({ description: "Możliwość przywołania windy z mieszkania." }),
    ).lift,
    true,
  );
});

test("redundant thousands are corrected according to the user-confirmed convention", () => {
  const result = costs("Komórka lokatorska za 25000 tys. zł.");
  assert.equal(result.storage, 25000);
  assert.equal(result.warnings, undefined);
  assert.deepEqual(costs("Komórka lokatorska za 25 tys. zł."), { storage: 25000 });
});

test("an owned garage is retained when a second space can be rented", () => {
  const description =
    "Miejsce parkingowe w garażu podziemnym dodatkowo płatne 50 000 zł - Istnieje możliwość wynajęcia drugiego miejsca postojowego w garażu podziemnym za 250 zł miesięcznie.";
  assert.equal(
    resolveListingAmenities(extractFeatures({ description }), {}, description).garage,
    true,
  );
  assert.equal(costs(description).garage, 50000);
  const separate =
    "Opcja drugiego auta: możliwość wynajęcia drugiego miejsca postojowego w hali garażowej za 200 zł/msc. Garaż podziemny - cena 40 000 zł. Komórka lokatorska: 20 000 zł.";
  assert.equal(
    resolveListingAmenities(extractFeatures({ description: separate }), {}, separate).garage,
    true,
  );
  assert.deepEqual(costs(separate), { garage: 40000, storage: 20000 });
});
