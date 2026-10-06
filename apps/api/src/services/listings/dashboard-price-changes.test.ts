import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { dashboardPriceChangesSql } from "./dashboard-price-changes";

test(
  "dashboard periods count distinct visible offers, include cutoff dates and exclude old events",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query(`begin;
        create temporary table listings (
          id int, status text, city text, hidden_duplicate_of_id int,
          rooms int, price_amount numeric, area_sqm numeric
        );
        create temporary table price_events (listing_id int, event_type text, changed_at timestamptz);
        insert into listings
          select id, 'active', 'Warszawa', null, 3, 900000, 60 from generate_series(1, 14) id;
        insert into price_events values
          (1, 'price_drop', now() - interval '2 days'),
          (1, 'price_increase', now() - interval '4 days'),
          (2, 'price_increase', now() - interval '10 days'),
          (3, 'price_drop', now() - interval '45 days'),
          (4, 'price_drop', now() - interval '61 days'),
          (5, 'price_drop', now() - interval '7 days'),
          (6, 'price_drop', now() - interval '30 days'),
          (7, 'price_drop', now() - interval '60 days'),
          (8, 'new_listing', now());
        insert into price_events select id, 'price_drop', now() from generate_series(9, 14) id;
        update listings set status = 'removed' where id = 9;
        update listings set city = 'Kraków' where id = 10;
        update listings set hidden_duplicate_of_id = 1 where id = 11;
        update listings set rooms = 2 where id = 12;
        update listings set price_amount = 2000000 where id = 13;
        update listings set area_sqm = 20 where id = 14;
        update listings set price_amount = null, area_sqm = null, rooms = null where id = 1;
      `);
      const result = await db.query(dashboardPriceChangesSql, ["Warszawa", 1500000, 50]);
      assert.deepEqual(result.rows, [{ days7: "2", days30: "4", days60: "6" }]);
      await db.query("truncate price_events");
      const empty = await db.query(dashboardPriceChangesSql, ["Warszawa", 1500000, 50]);
      assert.deepEqual(empty.rows, [{ days7: "0", days30: "0", days60: "0" }]);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
