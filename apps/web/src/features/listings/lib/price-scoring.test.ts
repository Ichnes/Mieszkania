import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDreamEvaluation,
  createDefaultFamilySettings,
  findNearestWarsawMetroStation,
  type ListingSummary,
} from "@mieszkania/shared";
const settings = createDefaultFamilySettings();
const profile = { ...settings.dreamProfile, maxPrice: 1_000_000, maxPricePerSqm: 20_000 };
const base: ListingSummary = {
  id: "price-boundaries",
  city: "Warszawa",
  district: "",
  title: "Mieszkanie",
  description: "",
  areaLabel: "80",
  priceLabel: "1000000",
  pricePerSqmLabel: "20000",
  badges: [],
  imageUrls: [],
  imageCount: 0,
  isShortlisted: false,
  summary: "",
  rcnDeltaLabel: "",
  priceChangePercent: 0,
  finishQuality: "unknown",
};
const row = (patch: Partial<ListingSummary>, label: string) =>
  computeDreamEvaluation({ ...base, ...patch }, profile, []).rows.find(
    (row) => row.label === label,
  )!;

test("missing lift costs no points on the ground floor", () => {
  assert.equal(row({ floor: 0, hasLift: false }, "Winda").points, 0);
  assert.equal(row({ description: "Mieszkanie na parterze.", hasLift: false }, "Winda").points, 0);
  assert.equal(row({ floor: 0, hasLift: true }, "Winda").points, 21);
  assert.equal(row({ floor: 1, hasLift: false }, "Winda").points, -20);
  assert.equal(
    row({ hasLift: false, description: "Na parterze lokale usługowe." }, "Winda").points,
    -20,
  );
  assert.equal(
    row({ floor: 2, hasLift: false, description: "Na parterze jest wejście." }, "Winda").points,
    -20,
  );
});
test("purchase price: exact budget, seven percent and above", () => {
  for (const [price, points] of [
    [999999, 15],
    [1000000, 15],
    [1000001, -5],
    [1070000, -5],
    [1070001, -15],
  ])
    assert.equal(row({ priceLabel: String(price) }, "Cena zakupu").points, points, String(price));
});
test("unit price: proportional discount bonus and explicit overspending penalties", () => {
  for (const [price, points] of [
    [14000, 20],
    [15000, 20],
    [17500, 15],
    [20000, 10],
    [20001, -5],
    [21400, -5],
    [21401, -10],
  ])
    assert.equal(
      row({ pricePerSqmLabel: String(price) }, "Cena za m²").points,
      points,
      String(price),
    );
});
test("unknown finish has no bonus or invented finishing cost; recognized condition still matters", () => {
  assert.equal(row({ finishQuality: "unknown" }, "Stan wykończenia").points, 0);
  assert.equal(row({ finishQuality: undefined }, "Stan wykończenia").points, 0);
  assert.equal(row({ finishQuality: "ready" }, "Stan wykończenia").points, 16);
  assert.equal(row({ finishQuality: "to_finish" }, "Stan wykończenia").points, -8);
  assert.equal(
    row({ badges: ["Oferta prywatna", "Z prowizją"] }, "Sprzedający / prowizja").points,
    -15,
  );
});

test("area tolerates five square metres on either side, then deducts three", () => {
  for (const [area, points] of [
    [54.99, -3],
    [55, 10],
    [60, 20],
    [100, 20],
    [105, 10],
    [105.01, -3],
  ]) {
    const result = computeDreamEvaluation(
      { ...base, areaLabel: String(area) },
      { ...profile, minArea: 60, maxArea: 100 },
      [],
    );
    assert.equal(result.rows.find((row) => row.label === "Metraż")!.points, points, String(area));
  }
});

test("metro penalties start beyond 150 percent; missing location remains neutral", () => {
  const listing = { ...base, latitude: 52.2, longitude: 21.1 };
  const distance = findNearestWarsawMetroStation(
    listing.latitude,
    listing.longitude,
  )!.distanceMeters;
  for (const [limit, points] of [
    [distance / 0.59, 13],
    [distance / 0.6, 10],
    [distance / 0.61, 10],
    [distance, 10],
    [distance / 1.49, 5],
    [distance / 1.51, -3],
    [0, 0],
  ]) {
    const result = computeDreamEvaluation(
      listing,
      { ...profile, maxMetroDistanceMeters: limit },
      [],
    );
    assert.equal(result.rows.find((row) => row.label === "Metro")!.points, points);
  }
  assert.equal(row({ latitude: undefined, longitude: undefined }, "Metro").points, 0);
});

test("commute without location data deducts five points and keeps a twelve-point budget", () => {
  const result = row({}, "Dojazd do pracy");
  assert.equal(result.points, -5);
  assert.equal(result.maxPoints, 12);
  assert.ok(
    !computeDreamEvaluation(base, profile, []).rows.some((row) => /\bdalej\b/i.test(row.rule)),
  );
});

test("score reasons describe listing facts instead of repeating rules or timestamps", () => {
  const result = computeDreamEvaluation(
    { ...base, firstSeenAt: "2026-09-08T12:00:00Z", roomsCount: 2 },
    profile,
    [],
    new Date("2026-09-09T12:00:00Z"),
  );
  const detail = (label: string) => result.rows.find((row) => row.label === label)!.detail;
  assert.equal(detail("Wiek oferty"), "1 dzień");
  assert.equal(detail("Układ mieszkania"), "nie spełnia");
  assert.equal(detail("Parking zewnętrzny"), "brak");
  assert.equal(detail("Klimatyzacja"), "brak danych");
  assert.equal(detail("Wynajem miejsc parkingowych"), "brak danych");
  assert.equal(detail("Dojazd do pracy"), "brak danych");
  assert.match(detail("Szacowana rata"), /^(Do|Powyżej) 7500 zł$/);
  assert.equal(row({ hasGarage: false, hasOutdoorParking: true }, "Parking zewnętrzny").points, 8);
  assert.ok(row({ hasGarage: false, hasOutdoorParking: true }, "Garaż").points < 0);
});

test("commute distance bands award points only inside the configured ranges", () => {
  for (const [km, points] of [
    [6.99, 12],
    [7.01, 8],
    [11.99, 8],
    [12.01, 4],
    [17.99, 4],
    [18.01, -5],
  ]) {
    const result = computeDreamEvaluation({ ...base, latitude: 52, longitude: 21 }, profile, [
      { key: "test", label: "Test", address: "", latitude: 52 + km / 111.195, longitude: 21 },
    ]);
    assert.equal(
      result.rows.find((row) => row.label === "Dojazd do pracy")!.points,
      points,
      String(km),
    );
  }
});
