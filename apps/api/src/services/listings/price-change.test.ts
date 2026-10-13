import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { isRealPriceChange, realPriceChangeSql } from "./price-change";

const cases: Array<[string, string | null, string | null, boolean]> = [
  ["price_drop", "1000000", "900000", true],
  ["price_increase", "900000", "1000000", true],
  ["price_increase", null, "1000000", false],
  ["price_increase", "0", "1000000", false],
  ["price_drop", "1000000", null, false],
  ["price_drop", "1000000", "0", false],
  ["price_drop", "1000000", "1000000", false],
  ["relisted", "1000000", "1000000", false],
  ["created", null, "1000000", false],
  ["price_drop", "-1000000", "900000", false],
];
test("only two distinct positive prices represent a real price change", () => {
  for (const [event_type, previous_price_amount, new_price_amount, expected] of cases)
    assert.equal(
      isRealPriceChange({ event_type, previous_price_amount, new_price_amount }),
      expected,
    );
});
test(
  "SQL filter and latest visible change agree even after relisting",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query("begin");
      await db.query(
        "create temporary table price_events (listing_id int, event_type text, previous_price_amount numeric, new_price_amount numeric, changed_at int)",
      );
      for (const [index, [type, previous, next]] of cases.entries())
        await db.query("insert into price_events values ($1,$2,$3,$4,1)", [
          index,
          type,
          previous,
          next,
        ]);
      await db.query("insert into price_events values (0, 'relisted', 900000, 900000, 2)");
      const filtered = await db.query(
        `select distinct on (pe.listing_id) pe.listing_id, pe.new_price_amount::text from price_events pe where ${realPriceChangeSql} order by pe.listing_id, pe.changed_at desc`,
      );
      assert.deepEqual(filtered.rows, [
        { listing_id: 0, new_price_amount: "900000" },
        { listing_id: 1, new_price_amount: "1000000" },
      ]);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
