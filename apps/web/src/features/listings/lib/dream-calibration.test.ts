import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDreamEvaluation,
  createDefaultFamilySettings,
  type ListingSummary,
} from "@mieszkania/shared";
const settings = createDefaultFamilySettings();
const base = {
  title: "Mieszkanie",
  district: "",
  areaLabel: "80",
  priceLabel: "1000000",
  pricePerSqmLabel: "20000",
  roomsCount: 3,
  badges: [],
  priceChangePercent: 0,
} as unknown as ListingSummary;
const profile = { ...settings.dreamProfile, maxPrice: 1000000, maxPricePerSqm: 20000 };
const evaluate = (
  patch: Partial<ListingSummary>,
  workplaces = settings.workplaces,
  financing = settings.financing,
) =>
  computeDreamEvaluation(
    { ...base, ...patch },
    profile,
    workplaces,
    new Date("2026-10-13"),
    financing,
  );
const row = (patch: Partial<ListingSummary>, label: string) =>
  evaluate(patch).rows.find((r) => r.label === label)!;

test("the configured mortgage limit has no one-zloty cliff and reaches the full penalty at twenty percent", () => {
  const factor = 5.8 / 1200 / (1 - (1 + 5.8 / 1200) ** -360);
  for (const [payment, points] of [
    [2500, 5],
    [4999, 0],
    [5001, 0],
    [5500, -5],
    [6000, -10],
  ])
    assert.equal(
      evaluate({ totalAcquisitionPrice: payment / factor }, [], {
        downPayment: 0,
        maxMonthlyPayment: 5000,
      }).mortgage!.points,
      points,
    );
});

test("one internally consistent ideal can attain the full denominator without mutually exclusive parking bonuses", () => {
  const ideal = evaluate({
    district: "Mokotów",
    priceLabel: "400000",
    pricePerSqmLabel: "5000",
    roomsCount: 4,
    floor: 5,
    totalFloors: 5,
    yearBuilt: 2026,
    latitude: 52.2307,
    longitude: 21.0107,
    hasGarage: true,
    hasOutdoorParking: false,
    hasStorage: true,
    hasLift: true,
    hasBalcony: true,
    hasAirConditioning: true,
    finishQuality: "ready",
    exposureDirectionsOverride: ["S", "W"],
    badges: ["Oferta prywatna"],
    firstSeenAt: "2026-10-13",
    priceChangePercent: -5,
    description:
      "Mieszkanie zaprojektowane przez architekta wnętrz. Granitowy blat. Drewniana podłoga. Kuchnia na wymiar. Dwa miejsca parkingowe. Ogrzewanie podłogowe. Mieszkanie po remoncie. Garderoba. Dwie łazienki. Wysoki standard. Zamknięte osiedle. Monitoring. Jasne mieszkanie. Łazienka z armaturą Grohe i prysznicem. Czynsz 800 zł.",
  });
  assert.equal(
    ideal.points,
    ideal.maxPoints,
    JSON.stringify(ideal.rows.filter((r) => r.points !== r.maxPoints)),
  );
  assert.equal(ideal.score, 100);
});

test("three rooms remain a compromise; only a measured bedroom over twelve square metres closes the gap", () => {
  assert.equal(row({}, "Liczba pokoi").points, 18);
  assert.equal(row({ description: "Salon 30 m². Sypialnia 12 m²." }, "Liczba pokoi").points, 18);
  assert.equal(row({ description: "Salon 30 m². Sypialnia 12,5 m²." }, "Liczba pokoi").points, 23);
  assert.equal(row({ description: "Pokój dziecięcy: 14 m2." }, "Liczba pokoi").points, 23);
  assert.equal(
    row({ description: "Sypialnia z balkonem. Salon 30 m²." }, "Liczba pokoi").points,
    18,
  );
  assert.equal(row({ roomsCount: 4 }, "Liczba pokoi").points, 25);
  assert.ok(!evaluate({}).rows.some((r) => r.label === "Układ mieszkania"));
});
test("relative floors reward low-rise top floors equally and do not invent building height", () => {
  for (const [floor, totalFloors, points] of [
    [2, 5, 4],
    [4, 5, 7],
    [5, 5, 12],
    [5, 6, 8],
    [13, 13, 12],
    [0, 5, -4],
    [7, 5, 0],
  ])
    assert.equal(row({ floor, totalFloors }, "Piętro").points, points);
  assert.equal(row({ floor: 13 }, "Piętro").points, 0);
});
test("silence is a partial penalty, explicit absence a full penalty, and outdoor parking substitutes for the garage", () => {
  assert.equal(row({}, "Garaż").points, -18);
  assert.equal(row({ amenityEvidence: { garage: false } }, "Garaż").points, -18);
  assert.equal(
    row({ amenityEvidence: { garage: false, outdoorParking: false } }, "Garaż").points,
    -36,
  );
  assert.equal(row({ hasOutdoorParking: true }, "Garaż").points, 8);
  assert.equal(row({ hasGarage: true, hasOutdoorParking: true }, "Garaż").points, 15);
  assert.equal(row({}, "Winda").points, -10);
  assert.equal(row({ amenityEvidence: { lift: false } }, "Winda").points, -20);
  assert.equal(row({}, "Balkon").points, -4);
  assert.equal(row({ amenityEvidence: { balcony: false } }, "Balkon").points, -8);
});
test("price boundaries are smooth and parking supplements do not consume the apartment budget", () => {
  for (const [price, points] of [
    [1000000, 15],
    [1000001, 15],
    [1010000, 12],
    [1020000, 9],
    [1050000, 0],
    [1070000, -6],
    [1100000, -15],
  ])
    assert.equal(
      row({ priceLabel: String(price), totalAcquisitionPrice: 1200000 }, "Cena zakupu").points,
      points,
    );
  for (const [price, points] of [
    [15000, 20],
    [17500, 15],
    [20000, 10],
    [20001, 10],
    [21000, 0],
    [22000, -10],
  ])
    assert.equal(row({ pricePerSqmLabel: String(price) }, "Cena za m²").points, points);
});
test("onsite-only route times control commute scoring and stale or partial routes cannot flatter the average", () => {
  const workplaces = [
    { key: "wife", label: "Biuro", address: "", latitude: 52, longitude: 21 },
    {
      key: "me",
      label: "Dom",
      address: "",
      latitude: 53,
      longitude: 22,
      workMode: "remote" as const,
    },
  ];
  const result = (minutes: number, remote = true) =>
    evaluate(
      {
        scoringCommutes: [
          {
            key: "wife",
            destinationLatitude: 52,
            destinationLongitude: 21,
            durationMinutes: minutes,
          },
          { key: "me", destinationLatitude: 53, destinationLongitude: 22, durationMinutes: 75 },
        ],
      },
      workplaces.map((w) => ({ ...w, workMode: w.key === "me" && remote ? "remote" : "onsite" })),
    ).rows.find((r) => r.label === "Dojazd do pracy")!;
  for (const [minutes, points] of [
    [35, 12],
    [45, 8],
    [55, 4],
    [70, -5],
  ])
    assert.equal(result(minutes).points, points);
  assert.equal(result(35, false).points, 4);
  const missing = evaluate({}, workplaces).rows.find((r) => r.label === "Dojazd do pracy")!;
  assert.equal(missing.points, -3);
  assert.equal(missing.dataStatus, "unknown");
  assert.equal(
    evaluate(
      {},
      workplaces.map((w) => ({ ...w, workMode: "remote" })),
    ).rows.find((r) => r.label === "Dojazd do pracy")!.maxPoints,
    0,
  );
});
test("description bonuses require apartment facts and sanitary extras do not stack", () => {
  assert.equal(
    row(
      {
        description: "Budynek zaprojektowany przez architekta. Jasne meble. Wysoka jakość obsługi.",
      },
      "Architekt",
    ).points,
    0,
  );
  assert.equal(row({ description: "Jasne meble." }, "Jasne mieszkanie").points, 0);
  assert.equal(row({ description: "Wysoka jakość obsługi." }, "Wysoki standard").points, 0);
  assert.equal(
    row({ description: "Mieszkanie zaprojektowane przez architekta wnętrz." }, "Architekt").points,
    5,
  );
  assert.equal(row({ description: "Osobne WC. Pralnia." }, "Łazienki / WC / pralnia").points, 3);
  assert.equal(
    row({ description: "Dwie łazienki. Osobne WC. Pralnia." }, "Łazienki / WC / pralnia").points,
    4,
  );
  assert.equal(
    row(
      { description: "Łazienka z armaturą Grohe i prysznicem termostatycznym." },
      "Armatura łazienkowa",
    ).points,
    2,
  );
});
