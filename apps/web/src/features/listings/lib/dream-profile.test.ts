import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDreamEvaluation,
  createDefaultFamilySettings,
  getPriceDropPoints,
  getListingAgePoints,
  type ListingSummary,
} from "@mieszkania/shared";
import { applyDreamProfile, computeDreamScore } from "./dream-profile";

const settings = createDefaultFamilySettings();
const now = new Date("2026-09-08T12:00:00Z");
const base = {
  title: "Mieszkanie",
  description: "",
  district: "Mokotów",
  areaLabel: "80 m²",
  priceLabel: "1 500 000 zł",
  pricePerSqmLabel: "18 750 zł",
  roomsCount: 3,
  finishQuality: "ready",
  hasGarage: true,
  hasLift: true,
  hasStorage: false,
  hasBalcony: true,
  hasAirConditioning: false,
  badges: [],
  priceChangePercent: 0,
} as unknown as ListingSummary;
const evaluate = (changes: Partial<ListingSummary> = {}, profile = settings.dreamProfile) =>
  computeDreamEvaluation({ ...base, ...changes }, profile, [], now);

test("two rented parking spaces incur an additional five-point penalty, not a purchase-price penalty", () => {
  for (const description of [
    "Od wspólnoty mieszkaniowej są również wynajmowane aż 2 miejsca postojowe pod samym wejściem do bloku to ogromny i rzadki atut, oznaczający całkowity koniec z szukaniem miejsca parkingowego po pracy!",
    "Dwa miejsca parkingowe wynajmowane od wspólnoty.",
    "Dzierżawione są trzy miejsca garażowe.",
    "2 miejsca postojowe za 300 zł miesięcznie.",
    "Dwa miejsca parkingowe z opłatą co miesiąc.",
  ]) {
    const evaluation = evaluate({ description });
    assert.equal(
      evaluation.rows.find((row) => row.label === "Wynajem miejsc parkingowych")!.points,
      -5,
      description,
    );
    assert.equal(
      evaluation.rows.find((row) => row.label === "Co najmniej 2 miejsca parkingowe")!.points,
      5,
      description,
    );
    assert.equal(
      evaluation.rows.reduce((sum, row) => sum + row.points, 0),
      evaluation.points,
    );
  }
  for (const description of [
    "Dwa miejsca parkingowe dodatkowo płatne 50000 zł.",
    "Dwa miejsca parkingowe nie są wynajmowane.",
    "Dwa miejsca postojowe bez opłat miesięcznych.",
    "Mieszkanie wynajmowane za 3000 zł miesięcznie. Dwa własne miejsca parkingowe.",
    "Jedno miejsce postojowe wynajmowane od wspólnoty.",
    "Czynsz 800 zł miesięcznie. Dwa miejsca garażowe w cenie.",
  ])
    assert.equal(
      evaluate({ description }).rows.find((row) => row.label === "Wynajem miejsc parkingowych")!
        .points,
      0,
      description,
    );
});

test("breakdown sums exactly and includes balcony, year, shower, fee and top-floor rules", () => {
  const row = (changes: Partial<ListingSummary>, label: string) =>
    evaluate(changes).rows.find((item) => item.label === label)!;
  assert.equal(row({ hasBalcony: false }, "Balkon").points, -8);
  assert.equal(
    evaluate({ hasBalcony: false }, { ...settings.dreamProfile, prefersBalcony: false }).rows.find(
      (item) => item.label === "Balkon",
    )!.points,
    0,
  );
  assert.equal(row({}, "Rok budowy").points, -3);
  for (const description of [
    "Prysznic",
    "Łazienka z prysznicem",
    "Kabina prysznicowa",
    "Dwa natryski",
  ])
    assert.equal(row({ description }, "Prysznic").points, 3);
  assert.equal(row({ description: "Bez prysznica" }, "Prysznic").points, 0);
  assert.equal(row({}, "Informacja o czynszu").points, -2);
  for (const description of [
    "Czynsz wynosi 950 zł",
    "Opłaty administracyjne: 1000 PLN",
    "Mieszkanie bezczynszowe",
  ])
    assert.equal(row({ description }, "Informacja o czynszu").points, 0);
  assert.equal(row({ maintenanceFeeLabel: "950 PLN" }, "Informacja o czynszu").points, 0);
  assert.equal(
    row({ description: "Na trzecim najwyższym i najcichszym piętrze." }, "Piętro").points,
    5,
  );
  assert.equal(
    row({ floor: 3, totalFloors: 3, description: "Na ostatnim piętrze" }, "Piętro").points,
    8,
  );
  assert.equal(row({ description: "Nie jest na ostatnim piętrze" }, "Piętro").points, 0);
  const evaluation = evaluate({
    description: "Blaty granitowe. Prysznic. Dwa miejsca parkingowe.",
  });
  assert.equal(
    evaluation.rows.reduce((sum, item) => sum + item.points, 0),
    evaluation.points,
  );
  assert.equal(
    evaluation.rows.reduce((sum, item) => sum + item.maxPoints, 0),
    evaluation.maxPoints,
  );
  assert.equal(new Set(evaluation.rows.map((item) => item.label)).size, evaluation.rows.length);
});

test("mortgage points use saved down payment, acquisition extras and the 7500 threshold", () => {
  const paymentFactor = 5.8 / 1200 / (1 - (1 + 5.8 / 1200) ** -360);
  const evaluateMortgage = (total: number, downPayment: number) =>
    computeDreamEvaluation(
      { ...base, totalAcquisitionPrice: total },
      settings.dreamProfile,
      [],
      now,
      { downPayment },
    );
  assert.equal(evaluateMortgage(7500.01 / paymentFactor, 0).mortgage!.points, -10);
  assert.equal(evaluateMortgage(7499.99 / paymentFactor, 0).mortgage!.points, 0);
  assert.equal(evaluateMortgage(3750 / paymentFactor, 0).mortgage!.points, 5);
  assert.equal(evaluateMortgage(1500000, 1500000).mortgage!.points, 10);
  assert.ok(evaluateMortgage(1500000, 800000).score > evaluateMortgage(1500000, 0).score);
  assert.ok(
    evaluateMortgage(1600000, 430000).mortgage!.payment >
      evaluateMortgage(1500000, 430000).mortgage!.payment,
  );
  assert.equal(evaluate({ priceLabel: "Brak ceny" }).mortgage, null);
  assert.equal(evaluate({ areaLabel: "80.0 m2" }).score, evaluate({ areaLabel: "80,0 m2" }).score);
});

test("premium countertops, oak floors, carpentry and parking recognize Polish variants once", () => {
  for (const [description, bonus] of [
    ["Blaty kuchenne wykonane ze spieku kwarcowego", 7],
    ["Kuchnia z blatem z granitu.", 8],
    ["Granitowe blaty kuchenne.", 8],
    ["Blat wykonany z konglomeratu kwarcowego.", 7],
    ["Blaty ze spieku, blaty granitowe i blat z konglomeratu.", 8],
    ["Na podłogach wysokiej jakości deska dębow", 10],
    ["Na podłodze deski dębowe.", 6],
    ["Dębowa deska, parkiet oraz drewniana podłoga.", 6],
    ["Meble robione pod wymiar przez stolarza.", 5],
    ["Zabudowa wykonana na wymiar przez stolarzy.", 5],
    ["Szafy wykonane przez stolarza na wymiar.", 5],
    ["Robione pod wymiar przez stolarza, kuchnia na wymiar przez stolarza.", 5],
    ["Do mieszkania przynależą 2 miejsca parkingowe w garażu.", 5],
    ["Mieszkanie z dwoma miejscami postojowymi.", 5],
    ["Trzy niezależne miejsca garażowe.", 5],
    ["Dwa miejsca w garażu podziemnym.", 5],
    ["Miejsca parkingowe: 2.", 5],
    ["Garaż dwustanowiskowy.", 5],
    ["Dwa miejsca parkingowe i trzy miejsca postojowe.", 5],
  ] as const) {
    assert.equal(evaluate({ description }).points - evaluate().points, bonus, description);
  }
});

test("new description bonuses exclude unrelated counts, absent amenities and imitations", () => {
  for (const description of [
    "Blat laminowany imitujący granit.",
    "Brak blatów granitowych.",
    "Granit na schodach. Blaty z laminatu.",
    "Podłoga imitująca deskę dębową.",
    "Panele imitujące parkiet.",
    "Nie ma dwóch miejsc parkingowych.",
    "Jedno miejsce parkingowe i 2 pokoje.",
    "Mieszkanie 82 m², miejsce parkingowe.",
    "Możliwość dokupienia 2 miejsc parkingowych.",
    "Bez mebli robionych na wymiar przez stolarza.",
  ])
    assert.equal(evaluate({ description }).points, evaluate().points, description);
});

test("unfinished price tiers replace the old finish penalty and cover every boundary", () => {
  const profile = { ...settings.dreamProfile, maxPricePerSqm: 0 };
  const ready = evaluate({}, profile).points;
  for (const [price, expected] of [
    [16999, 5],
    [17000, 1],
    [18000, 1],
    [18001, -4],
    [19000, -4],
    [19001, -8],
    [20000, -8],
    [20001, -12],
    [21000, -12],
    [21001, -18],
  ]) {
    for (const description of ["Mieszkanie w stanie deweloperskim", "Mieszkanie do wykończenia"]) {
      assert.equal(
        evaluate({ description, pricePerSqmLabel: String(price) }, profile).points - ready,
        expected - 16,
      );
    }
    assert.equal(
      evaluate({ finishQuality: "to_finish", pricePerSqmLabel: String(price) }, profile).points -
        ready,
      expected - 16,
    );
    assert.equal(evaluate({ pricePerSqmLabel: String(price) }, profile).points, ready);
  }
  assert.equal(
    evaluate({ finishQuality: "to_finish", pricePerSqmLabel: undefined }, profile).points - ready,
    -26,
  );
  assert.equal(
    evaluate(
      { description: "Nie jest w stanie deweloperskim.", pricePerSqmLabel: "16999" },
      profile,
    ).points,
    ready,
  );
});

test("price drop intervals include their upper boundary and exclude zero", () => {
  for (const [drop, points] of [
    [-1, 0],
    [0, 0],
    [0.01, 2],
    [1, 2],
    [1.01, 4],
    [2, 4],
    [2.01, 5],
    [3, 5],
    [3.01, 6],
    [4, 6],
    [4.01, 7],
    [20, 7],
  ]) {
    assert.equal(getPriceDropPoints(-drop), points, String(drop));
  }
  assert.equal(getPriceDropPoints(NaN), 0);
});

test("listing age rewards only the first 20 days, then penalizes age", () => {
  for (const [days, points] of [
    [0, 2],
    [20, 2],
    [20.01, -1],
    [40, -1],
    [40.01, -2],
    [100, -2],
  ]) {
    assert.equal(
      getListingAgePoints(new Date(now.getTime() - days * 86400000).toISOString(), now),
      points,
    );
  }
  for (const date of [undefined, "invalid", "2027-01-01"])
    assert.equal(getListingAgePoints(date, now), 0);
});

test("requested amenity and commercial bonuses use exact point values", () => {
  const initial = evaluate().points;
  for (const [changes, points] of [
    [{ hasStorage: true }, 9],
    [{ hasAirConditioning: true }, 5],
    [{ description: "Drewniana podłoga, parkiet." }, 6],
    [{ description: "Garderoba" }, 5],
    [{ badges: ["Oferta prywatna"] }, 10],
    [{ badges: ["Oferta bezpośrednia"] }, 10],
    [{ badges: ["Z prowizją"] }, -15],
  ] as Array<[Partial<ListingSummary>, number]>) {
    assert.equal(evaluate(changes).points - initial, points);
  }
});

test("three rooms earn a large-area bonus at 75 m² and four rooms remain ideal", () => {
  const below = evaluate({ areaLabel: "74,9 m²" });
  const large = evaluate({ areaLabel: "75 m²" });
  assert.equal(large.points - below.points, 4);
  assert.equal(large.maxPoints, below.maxPoints);
  assert.ok(evaluate({ roomsCount: 4 }).score > large.score);
  assert.ok(large.score > evaluate({ roomsCount: 2 }).score);
  const strict = { ...settings.dreamProfile, minRooms: 5 };
  assert.equal(
    evaluate({ roomsCount: 4 }, strict).points,
    evaluate({ roomsCount: 2 }, strict).points,
  );
});

test("area tolerance checks both bounds and does not reward distant misses", () => {
  const profile = { ...settings.dreamProfile, minArea: 70, maxArea: 110 };
  const score = (area: number) =>
    evaluate({ areaLabel: String(area), roomsCount: 4 }, profile).points;
  assert.equal(score(70) - score(65), 10);
  assert.equal(score(65) - score(64), 10);
  assert.equal(score(110) - score(115), 10);
  assert.equal(score(115) - score(116), 10);
  assert.equal(score(30), score(200));
});

test("synonyms cannot multiply a single descriptive amenity bonus", () => {
  assert.equal(evaluate({ description: "projekt architekta" }).points - evaluate().points, 8);
  assert.equal(
    evaluate({ description: "dwie łazienki, 2 łazienki" }).points - evaluate().points,
    4,
  );
  assert.equal(
    evaluate({ description: "wysoki standard, wysokiej jakości" }).points - evaluate().points,
    4,
  );
  assert.equal(
    evaluate({ description: "po remoncie, świeżo wyremontowane, odświeżone" }).points -
      evaluate().points,
    4,
  );
});

test("scores stay within 0–100 and the frontend recomputes stale scores using shared rules", () => {
  const ideal = {
    ...base,
    yearBuilt: 2026,
    description: "Czynsz: 0 zł.",
    roomsCount: 4,
    hasStorage: true,
    pricePerSqmLabel: "10 000 zł",
    badges: ["Oferta prywatna"],
    priceChangePercent: -5,
    firstSeenAt: now.toISOString(),
  };
  assert.equal(
    computeDreamScore(ideal, settings.dreamProfile, [], now, { downPayment: 2000000 }),
    100,
  );
  assert.equal(
    evaluate({
      hasGarage: false,
      hasLift: false,
      areaLabel: "20",
      roomsCount: 1,
      priceLabel: "9 000 000",
      pricePerSqmLabel: "100 000",
      district: "",
      finishQuality: "to_finish",
      badges: ["Z prowizją"],
    } as Partial<ListingSummary>).score,
    0,
  );
  assert.equal(
    applyDreamProfile([{ ...base, dreamScore: -1 }], settings)[0].dreamScore,
    computeDreamScore(base, settings.dreamProfile, []),
  );
});
