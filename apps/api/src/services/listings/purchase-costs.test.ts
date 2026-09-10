import assert from "node:assert/strict";
import test from "node:test";
import { extractAdditionalPurchaseCosts as parse } from "./purchase-costs";

const cases: Array<[string, ReturnType<typeof parse>]> = [
  [
    "Dodatkowym kosztem jest : garaż 60 000,- miejsce postojowe przed budynkiem 20 000,- piwnica 20 000,- ogródek 50 000,-",
    { garage: 80000, storage: 20000, garden: 50000 },
  ],
  ["Miejsce postojowe: 30 000 zł", { garage: 30000 }],
  ["MIEJSCE POSTOJOWE W GARAŻU PODZIEMNYM W CENIE 60 000 ZŁ.", { garage: 60000 }],
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
