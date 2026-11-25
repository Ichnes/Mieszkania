import assert from "node:assert/strict";
import test from "node:test";
import { extractAdditionalPurchaseCosts as parse } from "./purchase-costs";

const cases: Array<[string, ReturnType<typeof parse>]> = [
  [
    "Mieszkanie: 1 570 000\nmiejsce garażowe: 50 000\npiwnica 20 000\nKoszty utrzymania: około 1200 pln",
    { garage: 50000, storage: 20000 },
  ],
  [
    "Miejsce postojowe w garażu podziemnym: 35 000 PLN. Łączna cena nieruchomości wraz z miejscem postojowym wynosi 1 215 000 PLN.",
    { garage: 35000 },
  ],
  ["Duża piwnica 12 m² - mieszkanie gotowe do wprowadzenia Cena: 990 000 zł", {}],
  [
    "67,7 m², 3 pokoje, wysoki parter, balkon + piwnica 4,60 m² i schowek 2 m², 2 miejsca postojowe Cena: 969 000 zł",
    {},
  ],
  [
    "Opłaty za garaż i komórkę,\n- miejsca postojowe w garażu podziemnym dodatkowo płatne - cena 60 000 zł,\n- komórka lokatorska dodatkowo płatna - cena 40 000 zł",
    { garage: 60000, storage: 40000 },
  ],
  [
    "Miejsce postojowe w garażu podziemnym 60.000 zł Komórka lokatorska (4,3 m kw.) 45.000 zł",
    { garage: 60000, storage: 45000 },
  ],
  [
    "Miejsce postojowe w garażu podziemnym (na oddzielnej KW). Cena miejsca: 40 000 zł (dodatkowo płatne).",
    { garage: 40000 },
  ],
  [
    "Dwa miejsca parkingowe w garażu podziemnym: - miejsce szersze niż standardowe - 45 000 zł, - miejsce standardowe - 40 000 zł.",
    { garage: 85000 },
  ],
  [
    "Do mieszkania przynależy (dodatkowo płatne 160 000 zł) : -murowana komórka lokatorska, znajdująca się na poziomie 0, -dwa prywatne miejsca postojowe.",
    { garageAndStorage: 160000 },
  ],
  [
    "Miejsce postojowe w garażu podziemnym — dodatkowo 50 000 Lokalizacja przy parku.",
    { garage: 50000 },
  ],
  [
    "Miejsce garażowe i komórka w cenie | 1.250.000 zł",
    { garageIncluded: true, storageIncluded: true },
  ],
  [
    "CENA 1 100 000 zł – lokal wykończony pod klucz 30 000 zł – 2 miejsca postojowe ŁĄCZNIE: 1 130 000 zł",
    { garage: 30000 },
  ],
  [
    "Mieszkanie 60 m² z ogródkiem – 1 129 000 zł, • miejsce postojowe – 50 000 zł, • komórka lokatorska – 20 000 zł.",
    { garage: 50000, storage: 20000 },
  ],
  ["Garaż: 50 000 zł Cena łączna z miejscem parkingowym: 1 234 000 zł", { garage: 50000 }],
  [
    "Dwa miejsca postojowe (każde w cenie 60 000 zł). Łączna kwota za mieszkanie + 2 miejsca postojowe + dodatkowe miejsce postojowe z komórką wynosi 1.660.000 PLN",
    { garage: 120000, parkingCount: 2, parkingUnitPrice: 60000 },
  ],
  ["Garaż i komórka płatne dodatkowo\nLOKALIZACJA – park\nCENA: 967 900 zł", {}],
  ["Piwnica: tak, - miejsce postojowe: tak, - stan prawny: własność, - cena: 1 185 500 zł", {}],
  [
    "Miejsce postojowe 60 000 PLN. Komórka: 30 000 PLN Cena łączna nieruchomości wraz z miejscem postojowym: 1 780 000 zł",
    { garage: 60000, storage: 30000 },
  ],
  [
    "Garaż (dodatkowo płatne 55.000); komórka (dodatkowo płatne 35.000).",
    { garage: 55000, storage: 35000 },
  ],
  [
    "Cena miejsca postojowego: 50 000 zł • Cena mieszkania: 1 320 000 zł • Łączna cena z miejscem postojowym: 1 370 000 zł",
    { garage: 50000 },
  ],
  [
    "Cena 1 875 000 zł plus obligatoryjnie 150tys zł za 3 miejsca postojowe wraz z komórką.",
    { garageAndStorage: 150000 },
  ],
  [
    "Dwa miejsca postojowe (jedno za drugim): 90 000 zł Komórka lokatorska (5,29 m², bezpośrednio przy miejscach postojowych): 45 000 zł",
    { garage: 90000, storage: 45000 },
  ],
  [
    "Dwa miejsca parkingowe przy domu – po 35 000 zł każde.",
    { garage: 70000, parkingCount: 2, parkingUnitPrice: 35000 },
  ],
  [
    "Zakup miejsc postojowych jest obligatoryjny. Cena jednego miejsca: 40 000 zł Łączny koszt dwóch miejsc: 80 000 zł",
    { garage: 80000 },
  ],
  [
    "Winda z poziomu garażu, CENA - 1 670 000 PLN + Miejsce parkingowe 60 000PLN. + Komórka lokatorska 40 000 PLN.",
    { garage: 60000, storage: 40000 },
  ],
  [
    "Do mieszkania przynależą dwa miejsca postojowe w garażu podziemnym. Cena za oba miejsca wynosi łącznie 50 000 zł. Ich zakup jest obligatoryjny.",
    { garage: 50000 },
  ],
  [
    "Komórka lokatorska na piętrze ~ 2m2 = 10 000 zł Miejsce postojowe = 50 000 zł",
    { storage: 10000, garage: 50000 },
  ],
  ["Miejsce garażowe: 50 000zł komórka lokatroska: 30 000zł", { garage: 50000, storage: 30000 }],
  [
    "Miejsce parkingowe i komórka płatne dodatkowo (odpowiednio 60 tys. i 30 tys. zł).",
    { garage: 60000, storage: 30000 },
  ],
  [
    "Cena mieszkania wraz z piwnicą: 1 670 000 zł • Obligatoryjny zakup 2 miejsc w garażu podziemnym: 60 000 zł / miejsce (łącznie 120 000 zł) • Obligatoryjny zakup 2 boksów rowerowych: 20 000 zł / boks (łącznie 40 000 zł) • Cena całkowita: 1 830 000 zł",
    { garage: 120000, storage: 40000, parkingCount: 2, parkingUnitPrice: 60000 },
  ],
  [
    "MIEJSCA POSTOJOWE I KOMÓRKA Do mieszkania przynależą dwa miejsca postojowe w garażu, każde w cenie 55 000 zł, oraz komórka lokatorska o powierzchni 4,26 m² w cenie 30 000 zł.",
    { garage: 110000, parkingCount: 2, parkingUnitPrice: 55000, storage: 30000 },
  ],
  [
    "Cena mieszkania: 1 619 000 zł. Dwa miejsca postojowe w garażu podziemnym, na platformie: 90 000 zł łącznie. Komórka lokatorska o powierzchni 3,57 m²: 20 000 zł.",
    { garage: 90000, storage: 20000 },
  ],
  [
    "Miejsce postojowe i komórka lokatorska – zakup obligatoryjny: 85 000 PLN.",
    { garageAndStorage: 85000 },
  ],
  ["Komórka lokatorska - 7500 zł/m2 (nieobowiązkowa).", {}],
  ["Miejsce parkingowe dodatkowo płatne 15 000 zlotych.", { garage: 15000 }],
  [
    "Miejsce postojowe w garażu podziemnym oraz miejsce parkingowe naziemne. Oba są dodatkowo płatne i obowiązkowe przy zakupie, 150 000 zł za całość.",
    { garage: 150000 },
  ],
  [
    "Miejsce w garażu podziemnym (dodatkowo płatne 45000 zł) oraz komórka lokatorska o pow. 2,8 m2 (dodatkowo płatna 15000 zł).",
    { garage: 45000, storage: 15000 },
  ],
  [
    "Miejsce w garażu podziemnym w cenie 45.000 zł. Możliwość zakupu drugiego miejsca w garażu w cenie 30.000 zł.",
    { garage: 45000 },
  ],
  [
    "Do mieszkania przynależą dwa miejsca postojowe na parkingu podziemnym płatne dodatkowo po 35.000,00 zł",
    { garage: 70000, parkingCount: 2, parkingUnitPrice: 35000 },
  ],
  [
    "Dodatkowo możliwość zakupu dwóch, odrębnych miejsc postojowych w cenie 50 000 za miejsce.",
    { garage: 100000, parkingCount: 2, parkingUnitPrice: 50000 },
  ],
  ["Dwa miejsca postojowe w cenie 70 000 zł łącznie.", { garage: 70000 }],
  [
    "2 miejsca postojowe dodatkowo po 35 tys. zł.",
    { garage: 70000, parkingCount: 2, parkingUnitPrice: 35000 },
  ],
  ["Dwa miejsca postojowe do wynajęcia po 350 zł za miesiąc.", {}],
  ["Mieszkanie z miejscem garażowym: 1 680 000 PLN", { garageIncluded: true }],
  [
    "Czynsz administracyjny: ok. 1400 zł. Dostępność: Q4 2026. CENA: Mieszkanie z miejscem garażowym: 1 680 000 PLN Zapraszam do kontaktu.",
    { garageIncluded: true },
  ],
  [
    "Apartament wraz z garażem i komórką: 1 680 000 PLN",
    { garageIncluded: true, storageIncluded: true },
  ],
  ["Mieszkanie z miejscem garażowym dodatkowo płatnym 60 000 PLN", { garage: 60000 }],
  [
    "Mieszkanie z miejscem garażowym: 1 680 000 PLN. Komórka dodatkowo płatna 20 000 PLN.",
    { garageIncluded: true, storage: 20000 },
  ],
  [
    "Dodatkowym kosztem jest : garaż 60 000,- miejsce postojowe przed budynkiem 20 000,- piwnica 20 000,- ogródek 50 000,-",
    { garage: 80000, storage: 20000, garden: 50000 },
  ],
  ["Miejsce postojowe: 30 000 zł", { garage: 30000 }],
  ["MIEJSCE POSTOJOWE W GARAŻU PODZIEMNYM W CENIE 60 000 ZŁ.", { garage: 60000 }],
  [
    "Na osiedlu są miejsca dla gości. Do mieszkania przynależą: 1 miejsce postojowe w garażu podziemnym w dodatkowej cenie 50,000 PLN Komórka lokatorska w cenie 25.000 PLN",
    { garage: 50000, storage: 25000 },
  ],
  ["Garaż: 50,000.50 PLN.", { garage: 50000.5 }],
  ["Garaż: 50,5 tys. zł.", { garage: 50500 }],
  ["Garaż: 60.000,-. Miejsce postojowe przed budynkiem: 20 000 zł.", { garage: 80000 }],
  [
    "Miejsce postojowe: 30 000 zł. Miejsce postojowe dodatkowo płatne 30 000 zł.",
    { garage: 30000 },
  ],
  ["garażu podziemnym (płatne dodatkowo 40 000 zł ).", { garage: 40000 }],
  [
    "Miejsce z komórką jest objęte odrębną księgą wieczystą, nie wchodzi w cenę mieszkania i kosztuje dodatkowo 75 000 zł.",
    { garageAndStorage: 75000 },
  ],
  [
    "Do mieszkania przynależy komórka lokatorska (4,7 m²) znajdująca się zaraz przy mieszkaniu – płatna dodatkowo 20 000 zł Możliwość dokupienia wygodnego miejsca postojowego w garażu podziemnym (usytuowanego bardzo blisko wejścia do klatki) w cenie 45 000 zł .",
    { storage: 20000, garage: 45000 },
  ],
  ["miejsce postojowe w hali garażowej — dodatkowo płatne 50 000 zł", { garage: 50000 }],
  [
    "Do mieszkania przynależą miejsce postojowe w garażu podziemnym oraz komórka lokatorska - dodatkowo 90 000 zł.",
    { garageAndStorage: 90000 },
  ],
  [
    "Jest 1 miejsce postojowe w hali garażowej na poziomie -1 (płatne dodatkowo 59 000 zł.)",
    { garage: 59000 },
  ],
  [
    "Do mieszkania przynależy miejsce postojowe w garażu podziemnym oraz komórka lokatorska , płatne dodatkowo 70 000 zł .",
    { garageAndStorage: 70000 },
  ],
  [
    "Do mieszkania przynależy miejsce postojowe w garażu podziemnym – dodatkowo płatne 100 000 zł.",
    { garage: 100000 },
  ],
  ["Miejsce postojowe w garażu podziemnym - w cenie", { garageIncluded: true }],
  [
    "Do mieszkania przynależy (w cenie) : -wygodne miejsce postojowe w garażu podziemnym, -komórka lokatorska.",
    { garageIncluded: true, storageIncluded: true },
  ],
  ["Miejsce postojowe: 55 000 PLN (obligatoryjny zakup).", { garage: 55000 }],
  [
    "Garaż dodatkowo płatny 45 tys. zł. Komórka dodatkowo 20.000 zł.",
    { garage: 45000, storage: 20000 },
  ],
  ["Garaż nie jest w cenie. Cena mieszkania 1 200 000 zł. Czynsz 1500 zł.", {}],
  ["Miejsce postojowe do wynajęcia w cenie 1500 zł miesięcznie.", {}],
];
for (const [description, expected] of cases) {
  test(description, () => assert.deepEqual(parse(description), expected));
}

const surcharge =
  "Do mieszkania można dokupić: miejsce postojowe w garażu podziemnym + komórka lokatorska - 80.000 zł";
const apartmentPrice = "CENA MIESZKANIA: 1 240 000 zł Cena za m²: 18023 zł";
for (const total of [
  "Mieszkanie + garaż + komórka: 1 320 000 zł",
  "Mieszkanie z garażem i komórką: 1 320 000 zł",
  "Apartament wraz z garażem oraz komórką: 1.320.000 PLN",
  "Lokal i garaż i komórka = 1320000 zł",
  "Cena łączna mieszkania, garażu i komórki: 1 320 000 zł",
  "Mieszkanie, garaż i komórka — cena całkowita: 1320 tys. zł",
]) {
  for (const description of [
    `${surcharge}, ${apartmentPrice} ${total}`,
    `${total}. ${apartmentPrice}. ${surcharge}`,
    `<p>${surcharge}</p><p>${apartmentPrice}</p><p>${total}</p>`,
  ]) {
    test(`package total never replaces the surcharge: ${description}`, () => {
      const costs = parse(description);
      assert.deepEqual(costs, { garageAndStorage: 80000 });
      assert.equal(1240000 + costs.garageAndStorage!, 1320000);
    });
  }
}
test("a package total preserves separate garage and storage surcharges", () => {
  assert.deepEqual(
    parse("Garaż: 60 000 zł. Komórka: 20 000 zł. Mieszkanie + garaż + komórka: 1 320 000 zł"),
    { garage: 60000, storage: 20000 },
  );
});
test("the total price of amenities alone is still a surcharge", () => {
  assert.deepEqual(parse("Garaż + komórka, cena łączna: 80 000 zł"), { garageAndStorage: 80000 });
});
test("an apartment package without explicit surcharges is not added again", () => {
  assert.deepEqual(parse("Mieszkanie + garaż + komórka: 1 320 000 zł"), {
    garageIncluded: true,
    storageIncluded: true,
  });
});
test("apartment and unit prices after unpriced amenities are not surcharges", () => {
  assert.deepEqual(
    parse("Można dokupić garaż i komórkę; CENA MIESZKANIA: 1 240 000 zł Cena za m²: 18023 zł"),
    {},
  );
});
test("included amenities before a summary apartment price do not double the price (3b458ce0)", () => {
  assert.deepEqual(parse("Garaż cena: 50 000 zł"), { garage: 50000 });
  assert.deepEqual(
    parse(
      "Miejsce w garażu podziemnym: w cenie Komórka lokatorska: w cenie Forma własności: pełna własność z KW Cena: 1 970 000 zł",
    ),
    {
      garageIncluded: true,
      storageIncluded: true,
    },
  );
});
