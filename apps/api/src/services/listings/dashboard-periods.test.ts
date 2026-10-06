import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import {
  dashboardPeriods,
  dashboardBaselineSql,
  dashboardNewListingsSql,
} from "./dashboard-periods";

test(
  "dashboard periods reconstruct historical stock and prices, and count newly discovered active offers",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query(`begin;
        create temporary table listings (
          id int, status text, city text, hidden_duplicate_of_id int,
          rooms int, price_amount numeric, area_sqm numeric,
          first_seen_at timestamptz, removed_at timestamptz, hidden_at timestamptz
        );
        create temporary table price_events (
          listing_id int, changed_at timestamptz, previous_price_amount numeric
        );
        insert into listings values
          (1,'active','Warszawa',null,3,1200,100,now()-interval '200 days',null,null),
          (2,'active','Warszawa',null,3,2000,100,now()-interval '20 days',null,null),
          (3,'removed','Warszawa',null,3,3000,100,now()-interval '200 days',now()-interval '10 days',null),
          (4,'active','Warszawa',1,3,4000,100,now()-interval '200 days',null,now()-interval '40 days'),
          (5,'active','Warszawa',null,3,5000,100,now()-interval '2 days',null,null),
          (6,'active','Warszawa',null,3,6000,100,now()-interval '30 days',null,null);
        insert into price_events values
          (1,now()-interval '20 days',1000),
          (1,now()-interval '3 days',1100);
      `);
      const fresh = await db.query(dashboardNewListingsSql, ["Warszawa", 10000, 50]);
      assert.deepEqual(fresh.rows, [{ days7: "1", days30: "3", days60: "3" }]);
      const averages = ["30", "33", "27"];
      for (const [index, days] of dashboardPeriods.entries()) {
        const historical = await db.query(dashboardBaselineSql, ["Warszawa", 10000, 50, days]);
        assert.deepEqual(historical.rows, [
          { active_count: "3", average: averages[index], has_history: true },
        ]);
      }
      await db.query("truncate listings, price_events");
      const empty = await db.query(dashboardBaselineSql, ["Warszawa", 10000, 50, 60]);
      assert.deepEqual(empty.rows, [{ active_count: "0", average: null, has_history: false }]);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
