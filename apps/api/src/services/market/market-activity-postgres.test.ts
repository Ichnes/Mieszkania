import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { marketActivitySql } from "./market-activity";

test(
  "weekly average includes older active offers at their historical prices and excludes archived stock",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query(`create temporary table listings (id int, city text, first_seen_at timestamptz, removed_at timestamptz, status text, price_amount numeric, area_sqm numeric);
      create temporary table price_events (id int, listing_id int, changed_at timestamptz, new_price_amount numeric, previous_price_amount numeric);
      insert into listings values
        (1,'Warszawa',now()-interval '60 days',null,'active',1000000,50),
        (2,'Warszawa',date_trunc('week',now())-interval '12 days',null,'active',500000,50),
        (3,'Warszawa',now()-interval '60 days',date_trunc('week',now())-interval '10 days','removed',1500000,50),
        (4,'Warszawa',now()-interval '60 days',null,'active',0,0);
      insert into price_events values (1,1,date_trunc('week',now())-interval '2 days',1000000,500000);`);
      const rows = (await db.query(marketActivitySql("true", 90))).rows;
      const current = rows.at(-1);
      const previous = rows.at(-2);
      const earlier = rows.at(-3);
      assert.equal(Number(current.average_price), 15000);
      assert.equal(Number(previous.average_price), 15000);
      assert.equal(Number(earlier.average_price), 10000);
      assert.equal(Number(earlier.new_listings), 1);
      assert.equal(Number(earlier.archived_listings), 1);
      assert.equal(Number(earlier.median_price), 10000);
      assert.equal(rows[0].average_price, null);
      assert.equal(current.median_price, null);
    } finally {
      await db.end();
    }
  },
);
