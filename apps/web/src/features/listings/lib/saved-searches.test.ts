import assert from "node:assert/strict";
import test from "node:test";
import { parseSavedSearches } from "./saved-searches";

test("saved searches reject corrupt shapes and unsupported filters without breaking offers", () => {
  for (const raw of [null, "broken", "{}", '[null,1,"text"]'])
    assert.deepEqual(parseSavedSearches(raw), []);
  const input = {
    id: "one",
    name: "  Rodzinne  ",
    sort: "price_asc",
    filters: {
      districts: ["Mokotów", "Mokotów"],
      minArea: 60,
      hiddenOnly: true,
      page: 999,
      unknown: "no",
      minPrice: "broken",
    },
  };
  assert.deepEqual(
    parseSavedSearches(
      JSON.stringify([input, input, { ...input, id: "two", sort: "unsupported" }]),
    ),
    [
      {
        id: "one",
        name: "Rodzinne",
        sort: "price_asc",
        filters: { districts: ["Mokotów"], minArea: 60, hiddenOnly: true },
      },
    ],
  );
  assert.equal(
    parseSavedSearches(
      JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ ...input, id: String(i) }))),
    ).length,
    12,
  );
});
