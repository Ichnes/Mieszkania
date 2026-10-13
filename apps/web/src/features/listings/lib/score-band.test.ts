import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDreamEvaluation,
  createDefaultFamilySettings,
  type ListingSummary,
} from "@mieszkania/shared";
import { getScoreBand } from "./score-band";

const profile = createDefaultFamilySettings().dreamProfile;
function band(label: string, listing: Partial<ListingSummary>, customProfile = profile) {
  const evaluation = computeDreamEvaluation(
    {
      title: "Test",
      district: "Mokotów",
      badges: [],
      priceChangePercent: 0,
      ...listing,
    } as ListingSummary,
    customProfile,
    [],
    new Date("2026-10-13T12:00:00Z"),
  );
  return getScoreBand(evaluation.rows.find((row) => row.label === label)!);
}

test("score bands explain exact thresholds and do not turn missing or disabled data into a match", () => {
  assert.match(band("Cena zakupu", { priceLabel: "1 800 000 zł" }), /limit 1800000 zł: \+15/);
  assert.match(band("Cena zakupu", { priceLabel: "1 800 001 zł" }), /limit 1800000 zł: \+15/);
  assert.match(band("Cena zakupu", {}), /niepotwierdzone;.*: 0/);
  assert.equal(
    band("Cena zakupu", { priceLabel: "1 zł" }, { ...profile, maxPrice: 0 }),
    "Kryterium wyłączone",
  );
  assert.match(band("Metraż", { areaLabel: "65 m²" }), /Do 5 m² poza zakresem: \+10/);
  assert.match(band("Metraż", { areaLabel: "64 m²" }), /Ponad 5 m² poza zakresem: -3/);
  assert.match(band("Cena za m²", { pricePerSqmLabel: "19 250 zł" }), /\+15 pkt/);
});

test("compound and partial scoring explains the actual floor, year, parking and finishing branches", () => {
  assert.match(
    band("Piętro", { floor: 3, totalFloors: 3 }),
    /Piętro: 3 \/ 3; ostatnie piętro: \+12/,
  );
  assert.match(band("Piętro", { floor: 8 }), /niepotwierdzone; Piętro: 8 \/ \?: 0/);
  assert.match(band("Rok budowy", { yearBuilt: 2025 }), /rok bieżący lub poprzedni.*\+14/);
  assert.match(
    band("Garaż", { hasGarage: false, hasOutdoorParking: true }),
    /Parking zewnętrzny zamiast garażu.*\+8 pkt/,
  );
  assert.match(band("Stan wykończenia", { finishQuality: "to_finish" }), /brak ceny za m²: -10/);
  assert.match(
    band("Szacowana rata", { priceLabel: "500 000 zł", totalAcquisitionPrice: 500000 }),
    /limit 7500 zł/,
  );
});
