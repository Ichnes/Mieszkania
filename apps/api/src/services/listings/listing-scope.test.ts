import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createDefaultFamilySettings } from "@mieszkania/shared";
import { pool } from "../../db";
import { getDashboardContext, getListingsPage, getMapListings } from "./listing-repository";
import { dashboardPriceChangesSql } from "./dashboard-price-changes";
import { dashboardNewListingsSql, dashboardBaselineSql } from "./dashboard-periods";

test("unit price sorting uses current price divided by area before pagination with nulls last", async (t) => {
  const queries: string[] = [];
  t.mock.method(fs, "existsSync", () => true);
  t.mock.method(pool, "query", async (sql: string) => {
    if (sql.includes("select value from app_settings"))
      return { rows: [{ value: createDefaultFamilySettings() }] };
    queries.push(sql);
    return { rows: [] };
  });
  for (const direction of ["asc", "desc"] as const) {
    queries.length = 0;
    await getListingsPage({ sort: `price_per_sqm_${direction}`, page: 2, pageSize: 30 });
    const query = queries.find((sql) => sql.includes("order by") && sql.includes("limit"));
    assert.ok(query);
    assert.match(query, new RegExp(` / nullif\\(l.area_sqm, 0\\)\\) ${direction} nulls last`));
    assert.match(query, /l.id asc/);
  }
});

test("list, map and dashboard use current configured area, price and city", async (t) => {
  const settings = createDefaultFamilySettings();
  const queries: { sql: string; params?: unknown[] }[] = [];
  t.mock.method(fs, "existsSync", () => true);
  t.mock.method(pool, "query", async (sql: string, params?: unknown[]) => {
    if (sql.includes("select value from app_settings")) return { rows: [{ value: settings }] };
    queries.push({ sql, params });
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
    const scoped = queries.filter(({ sql }) => sql.includes("area_sqm >="));
    assert.ok(scoped.length >= 7);
    for (const { sql, params } of scoped) {
      if ([dashboardPriceChangesSql, dashboardNewListingsSql, dashboardBaselineSql].includes(sql)) {
        assert.deepEqual(params?.slice(0, 3), [settings.searchContract.city, price, area]);
        if (sql === dashboardBaselineSql) assert.ok([7, 30, 60].includes(Number(params?.[3])));
        continue;
      }
      assert.ok(sql.includes(`area_sqm >= ${area}`), sql.slice(0, 180));
      assert.ok(sql.includes(`<= ${price}`), sql.slice(0, 180));
    }
  }
});
