import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPropertySegments,
  classifyProperty,
  readMonthlyFee,
} from "./market-property-segments";

test("monthly fees accept explicit amounts but not ranges, missing, annual or per-area fees", () => {
  assert.equal(readMonthlyFee("1 200,50 zł", ""), 1200.5);
  assert.equal(readMonthlyFee("0 zł", ""), 0);
  assert.equal(readMonthlyFee(undefined, "Czynsz administracyjny wynosi około 950 zł."), 950);
  for (const description of [
    "Cena mieszkania 900000 zł",
    "Czynsz 800–1000 zł",
    "Czynsz 12 zł/m²",
    "Czynsz 1200 zł rocznie",
    "Czynsz najmu 3500 zł",
  ])
    assert.equal(readMonthlyFee(undefined, description), null, description);
  for (const value of ["do uzgodnienia", "800–1000 zł", "12 zł/m²", "1200 zł/rok"])
    assert.equal(readMonthlyFee(value, ""), null);
});

test("property groups preserve missing data and exact monthly fee boundaries", () => {
  const row = { description: null, payload_raw: null, price_amount: "1000000", area_sqm: "60" };
  assert.equal(classifyProperty(row).fee, "Brak danych o czynszu");
  assert.equal(classifyProperty(row).finish, "Brak danych o stanie");
  for (const [fee, label] of [
    [0, "0 zł"],
    [499.99, "Poniżej 500 zł"],
    [500, "500–<1000 zł"],
    [999.99, "500–<1000 zł"],
    [1000, "1000–<1500 zł"],
    [1500, "1500 zł i więcej"],
  ] as const)
    assert.equal(
      classifyProperty({
        ...row,
        payload_raw: { portalFeatures: { fees: `${fee} zł`, finishQuality: "to_completion" } },
      }).fee,
      label,
    );
  assert.equal(
    classifyProperty({
      ...row,
      payload_raw: { portalFeatures: { finishQuality: "to_completion" } },
    }).finish,
    "Do wykończenia / remontu",
  );
  assert.equal(
    classifyProperty({ ...row, description: "Mieszkanie po remoncie, nie wymaga remontu." }).finish,
    "Wykończone / do zamieszkania",
  );
});

test("segment shares cover every listing and quartiles use priced observations with interpolation", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    description: "Mieszkanie po remoncie. Czynsz 600 zł.",
    payload_raw: null,
    price_amount: String((10000 + i * 1000) * 50),
    area_sqm: "50",
  }));
  const stats = buildPropertySegments(rows);
  for (const groups of [stats.finishing, stats.monthlyFees]) {
    assert.equal(
      groups.reduce((sum, g) => sum + g.count, 0),
      12,
    );
    assert.equal(groups[0].sharePercent, 100);
    assert.equal(groups[0].medianPricePerSqm, 15500);
    assert.equal(groups[0].lowerQuartilePricePerSqm, 12750);
    assert.equal(groups[0].upperQuartilePricePerSqm, 18250);
  }
  assert.equal(buildPropertySegments(rows.slice(0, 9)).finishing[0].medianPricePerSqm, null);
  assert.deepEqual(buildPropertySegments([]), { finishing: [], monthlyFees: [] });
});
