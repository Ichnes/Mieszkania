import assert from "node:assert/strict";
import test from "node:test";
import { extractAdditionalPurchaseCosts as costs } from "./purchase-costs";
import { readMonthlyFee } from "./maintenance-fee";
import { extractFeatures, resolveListingAmenities, buildAmenityBadges } from "./listing-repository";
import { readAmenityAccess } from "./parking-availability";

test("public street parking is neither a garage nor an estate parking space (1e060402)", () => {
  const description = "Parkowanie możliwe jest na ogólnodostępnych miejscach w pobliżu budynku.";
  const features = extractFeatures({ description });
  assert.equal(resolveListingAmenities(features, {}, description).garage, false);
  assert.ok(features.some((f) => f.key === "street_parking"));
  assert.ok(!features.some((f) => ["garage", "outdoor_parking", "estate_parking"].includes(f.key)));
  assert.ok(buildAmenityBadges(features).includes("Parking miejski / przy ulicy"));
});

test("redundant thousands retain the full zł amount and attach it to the correct amenity", () => {
  const cases = [
    [
      "Miejsce postojowe w garażu podziemnym, bezpośrednio przy wejściu do windy - osobno płatne 55 000 tysięcy złotych.",
      { garage: 55000 },
    ],
    [
      "Cena mieszkania: 970 000 tysięcy Cena komórki: 25 000 tysięcy Cena miejsca postojowego w garażu 30 tysięcy Cena mieszkania z miejscami przynależnymi 1 025 000 mln",
      { storage: 25000, garage: 30000 },
    ],
    [
      "Dodatkowo do mieszkania przynależą: miejsce parkingowe w garażu podziemnym (samodzielne) i 2 komórki lokatorskie zlokalizowane bezpośrednio przy miejscu postojowym (dodatkowo płatne 70 000tys).",
      { garage: 70000 },
    ],
    [
      "Do mieszkania przynależy miejsce postojowe w garażu + 40000 tys. oraz komórka lokatorska w piwnicy o powierzchni 6,2 m² za 25000 tys.",
      { garage: 40000, storage: 25000 },
    ],
    [
      "W budynku sąsiadującym jest miejsce postojowe w garażu podziemnym dodatkowo płatne (50 000 tys.złotych). Również możliwość uzyskania darmowego miejsca w parkingu naziemnym.",
      { garage: 50000 },
    ],
    [
      "Do mieszkania przynależy duże miejsce parkingowe w garażu podziemnym oraz komórka lokatorska o powierzchni ok. 9 m. dodatkowo płatne w kwocie 75 000 zł. Wysokość czynszu administracyjnego 994 zł",
      { garageAndStorage: 75000 },
    ],
  ] as const;
  for (const [description, expected] of cases)
    assert.deepEqual(costs(description), expected, description);
  assert.deepEqual(costs("Garaż dodatkowo płatny 150 tys. zł."), { garage: 150000 });
  assert.deepEqual(costs("Garaż dodatkowo płatny 1250 zł miesięcznie."), {});
});

test("user-confirmed monthly fee phrasings work without absorbing parking purchase prices", () => {
  for (const [description, expected] of [
    ["Opłaty czynszowe: 1065 zł", 1065],
    ["Wysokość czynszu administracyjnego 994 zł", 994],
    [
      "Jest bardzo tanie w utrzymaniu, czynsz do Wspólnoty łącznie z miejscem postojowym około 800 zł",
      800,
    ],
    [
      "księgą wieczystąmożliwość zakupu na kredytczynsz administracyjny 1289 PLN To idealna propozycja",
      1289,
    ],
    ["Czynsz administracyjny nieruchomości wynosi - 1000 PLN", 1000],
  ] as const)
    assert.equal(readMonthlyFee(undefined, description), expected, description);
  assert.equal(readMonthlyFee(undefined, "Mieszkanie bezczynszowe, cena 900000 zł."), null);
});

test("concrete purchase options differ from vague building parking adverts", () => {
  const vague =
    "W budynku znajduje się garaż podziemny z dostępnymi miejscami parkingowymi - opcja wynajmu lub zakupu.";
  assert.equal(
    resolveListingAmenities(extractFeatures({ description: vague }), {}, vague).garage,
    false,
  );
  for (const [description, nearby] of [
    [
      "Istnieje także możliwość wynajęcia lub odkupienia dedykowanego miejsca w pobliskim garażu (zarządzanym przez zewnętrzną firmę).",
      true,
    ],
    [
      "Parking: Możliwość dokupienia lub wynajęcia miejsca postojowego w garażu podziemnym. Istnieje możliwość parkowania auta obok budynku w Strefie Płatnego Parkowania za opłatą 30 zł rocznie.",
      false,
    ],
  ] as const) {
    const features = extractFeatures({ description });
    assert.equal(resolveListingAmenities(features, {}, description).garage, true, description);
    assert.equal(readAmenityAccess(description).garageTenure, "purchase_option");
    assert.equal(readAmenityAccess(description).garageNearby, nearby);
    assert.ok(buildAmenityBadges(features).includes("Garaż — możliwość zakupu"));
    assert.deepEqual(costs(description), {});
  }
});

test("continuable parking and storage leases are available amenities with rental tenure", () => {
  for (const text of [
    "Mieszkanie jest wynajmowane, do lokalu przynależy komórka.",
    "Komórka własna, a miejsce postojowe wynajmowane.",
    "Piwnica, miejsce postojowe jest wynajmowane.",
  ])
    assert.equal(readAmenityAccess(text).storageTenure, undefined, text);
  const description =
    "Dodatkowo wynajmowane są na stałe, na czas nieokreślony, miejsce postojowe w garażu podziemnym na poziomie -1 oraz komórka lokatorska. Istnieje możliwość kontynuacji najmu, dzięki czemu można nadal korzystać z miejsca postojowego w garażu podziemnym, jak i z komórki lokatorskiej.";
  const features = extractFeatures({ description });
  assert.equal(resolveListingAmenities(features, {}, description).garage, true);
  assert.equal(readAmenityAccess(description).garageTenure, "rental");
  assert.equal(readAmenityAccess(description).storageTenure, "rental");
  assert.ok(buildAmenityBadges(features).includes("Garaż — najem"));
  assert.ok(buildAmenityBadges(features).includes("Komórka — najem"));
  const nextBuilding =
    "Właściciel lokalu aktualnie wynajmuje miejsce parkingowe w garażu podziemnym w budynku obok. Na życzenie kupującego istnieje możliwość przejęcia najmu miejsca garażowego na preferencyjnych warunkach.";
  assert.equal(readAmenityAccess(nextBuilding).garageTenure, "rental");
  assert.equal(readAmenityAccess(nextBuilding).garageNearby, true);
});
