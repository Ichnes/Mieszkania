import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { pressureKey, type BuyerObservation } from "@mieszkania/shared";
import { recordPressure } from "./pressure-history";

test(
  "pressure captures are immutable across repeat reads, scoped, and omit unobserved dates",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    const row: BuyerObservation = {
      id: "one",
      start: 0,
      end: null,
      price: 900000,
      area: 60,
      district: "Ursus",
      neighborhood: "Szamoty",
      market: "secondary",
      year: 2007,
      rooms: 3,
      relisted: false,
      history: [[0, 900000]],
    };
    try {
      await db.query(
        "create temporary table market_pressure_daily(scope text,day int,groups jsonb,primary key(scope,day))",
      );
      const first = await recordPressure(db, "scope A", 100, [row]);
      assert.equal(first[0].groups[pressureKey()].active, 1);
      assert.deepEqual(await recordPressure(db, "scope A", 100, []), first);
      const next = await recordPressure(db, "scope A", 160, [row, row]);
      assert.deepEqual(
        next.map((f) => f.day),
        [100, 160],
      );
      assert.equal(next[1].groups[pressureKey()].values.supply, null);
      assert.deepEqual(
        (await recordPressure(db, "scope B", 160, [])).map((f) => f.day),
        [160],
      );
    } finally {
      await db.end();
    }
  },
);
