import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createDefaultFamilySettings } from "@mieszkania/shared";
import { pool } from "../../db";
import { getDashboardContext, getListingsPage, getMapListings } from "./listing-repository";

test("list, map and dashboard use current configured area, price and city", async (t) => {
  const settings = createDefaultFamilySettings();
  const queries: string[] = [];
  t.mock.method(fs, "existsSync", () => true);
  t.mock.method(pool, "query", async (sql: string) => {
    if (sql.includes("select value from app_settings")) return { rows: [{ value: settings }] };
    queries.push(sql);
    return { rows: [] };
  });
  for (const [area, price] of [
    [53, 2800000],
    [71, 1700000],
  ]) {
    settings.searchContract.minArea = area;
    settings.searchContract.maxPrice = price;
    queries.length = 0;
    await getListingsPage();
    await getMapListings();
    await getDashboardContext();
    const scoped = queries.filter((sql) => sql.includes("area_sqm >="));
    assert.ok(scoped.length >= 7);
    for (const sql of scoped) {
      assert.ok(sql.includes(`area_sqm >= ${area}`), sql.slice(0, 180));
      assert.ok(sql.includes(`<= ${price}`), sql.slice(0, 180));
    }
  }
});
