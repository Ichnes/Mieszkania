import assert from "node:assert/strict";
import test from "node:test";
import { readStatisticsPreferences } from "./useStatisticsPreferences";
test("restores both applied and unfinished statistics filters with the selected period", () => {
  const filters = {
    minYear: "2000",
    minArea: "55",
    maxArea: "90",
    elevator: true,
    garage: false,
    storage: true,
    directions: ["SE", "S"],
  };
  const draft = { ...filters, minArea: "62", garage: true };
  assert.deepEqual(readStatisticsPreferences(JSON.stringify({ filters, draft, period: 180 })), {
    filters,
    draft,
    period: 180,
  });
});
test("invalid or older saved statistics preferences have safe defaults", () => {
  const defaults = readStatisticsPreferences(null);
  assert.deepEqual(readStatisticsPreferences("broken"), defaults);
  assert.deepEqual(
    readStatisticsPreferences(
      JSON.stringify({ period: 999, filters: { minYear: {}, elevator: "false" } }),
    ),
    defaults,
  );
  const saved = readStatisticsPreferences(JSON.stringify({ filters: { minArea: "55" } }));
  assert.equal(saved.draft.minArea, "55");
});
