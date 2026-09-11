import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { getMarketAmenityFilter } from "./market-amenities";

test("storage and compass filters combine, respect overrides and preserve unfiltered unknowns", async () => {
  const rows = [
    {
      id: "10000000-0000-0000-0000-000000000001",
      description: "Komórka lokatorska. Okna na południe.",
      has_storage_override: null,
    },
    {
      id: "10000000-0000-0000-0000-000000000002",
      description: "Piwnica. Okna na południe i północ.",
      has_storage_override: null,
    },
    {
      id: "10000000-0000-0000-0000-000000000003",
      description: "Komórka. Okna na południe.",
      has_storage_override: false,
    },
    {
      id: "10000000-0000-0000-0000-000000000004",
      description: "Okna na południe.",
      has_storage_override: true,
    },
    {
      id: "10000000-0000-0000-0000-000000000005",
      description: "Piwnica. Mieszkanie narożne.",
      has_storage_override: null,
    },
  ];
  let calls = 0;
  const db = {
    query: async () => {
      calls++;
      return { rows };
    },
  } as unknown as Pool;
  const predicate = await getMarketAmenityFilter(db, "true", { storage: "true", directions: "S" });
  for (const index of [0, 3]) assert.ok(predicate.includes(rows[index].id));
  for (const index of [1, 2, 4]) assert.ok(!predicate.includes(rows[index].id));
  assert.equal(await getMarketAmenityFilter(db, "true", { directions: "N,NE,E,SE,S,SW,W,NW" }), "");
  assert.equal(await getMarketAmenityFilter(db, "true", { directions: "" }), "");
  assert.equal(calls, 1);
});
