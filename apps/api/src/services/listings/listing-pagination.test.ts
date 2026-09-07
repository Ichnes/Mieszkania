import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultFamilySettings } from "@mieszkania/shared";
import { pool } from "../../db";
import fs from "node:fs";
import { getListingsPage } from "./listing-repository";

test("dream sorting enriches only the selected page and keeps stable global pagination", async (t) => {
  const rows = Array.from({ length: 3000 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(3000 - i).padStart(12, "0")}`,
    title: "Mieszkanie",
    description: "",
    city: "Warszawa",
    district: "Mokotów",
    canonical_url: "https://example.com/offer",
    source_name: "Test",
    price_amount: "1000000",
    area_sqm: "60",
    rooms: "3",
    status: "active",
  }));
  let rcnQueries = 0;
  const imageRequests: string[][] = [];
  // Prevent local settings backup writes: this test uses only in-memory database rows.
  t.mock.method(fs, "existsSync", () => true);
  t.mock.method(pool, "query", async (sql: string, values: unknown[]) => {
    if (sql.includes("select value from app_settings"))
      return { rows: [{ value: createDefaultFamilySettings() }] };
    if (sql.includes("count(*)::text as total")) return { rows: [{ total: String(rows.length) }] };
    if (sql.includes("l.canonical_url")) return { rows };
    if (sql.includes("from transaction_rcn")) {
      rcnQueries++;
      return { rows: [{ sample_count: "0", avg_price_per_sqm: null }] };
    }
    if (sql.includes("with requested(listing_id)")) imageRequests.push(values[0] as string[]);
    return { rows: [] };
  });
  const result = await getListingsPage({ sort: "dream_desc", page: 2, pageSize: 30 });
  const expectedIds = rows
    .map((row) => row.id)
    .sort()
    .slice(30, 60);
  assert.equal(result.total, 3000);
  assert.deepEqual(
    result.items.map((item) => item.id),
    expectedIds,
  );
  assert.deepEqual(imageRequests, [expectedIds]);
  assert.ok(
    rcnQueries > 0 && rcnQueries <= 90,
    `Expected only page RCN lookups, got ${rcnQueries}`,
  );
  assert.ok(result.items.every((item) => typeof item.dreamScore === "number"));
});
