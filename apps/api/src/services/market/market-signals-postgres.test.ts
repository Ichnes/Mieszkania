import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { getMarketSignals } from "./market-signals";

test(
  "the latest genuine cut includes confirmed cheaper returns once per active listing",
  {
    skip: !process.env.TEST_DATABASE_URL,
  },
  async () => {
    const db = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
    try {
      await db.query(`create temporary table listings(id int, city text, district text, neighborhood text, status text, first_seen_at timestamptz, last_seen_at timestamptz);
      create temporary table listing_relisting_reviews(current_listing_id int,previous_listing_id int,decision text);
      create temporary table listing_snapshots(id int,listing_id int,captured_at timestamptz,price_amount numeric);
      create temporary table price_events(id int,listing_id int,changed_at timestamptz,previous_price_amount numeric,new_price_amount numeric,event_type text,snapshot_id int,source_url text);
      insert into listings values(1,'Warszawa',null,null,'active',now()-interval '10 days',now());
      insert into listing_relisting_reviews values(1,2,'confirmed'),(1,3,'confirmed'),(1,4,'rejected');
      insert into listing_snapshots values(1,1,now()-interval '10 days',750000),(2,2,now()-interval '12 days',1000000),(3,3,now()-interval '15 days',900000),(4,4,now()-interval '11 days',2000000);
      insert into price_events values(1,1,now(),750000,700000,'price_drop',null,'duplicate');`);
      const read = () => getMarketSignals(db, "true", 30, "[{}]");
      const first = await read();
      assert.equal(first.discounted, 1);
      assert.equal(first.relistingDiscounted, 1);
      assert.equal(first.repeatedCuts, 0);
      assert.equal(first.medianCutAmount, 250000);
      await db.query(
        "insert into price_events values(2,1,now(),750000,730000,'price_drop',5,null)",
      );
      const next = await read();
      assert.equal(next.medianCutAmount, 20000);
      assert.equal(next.repeatedCuts, 1);
      assert.equal(next.relistingDiscounted, 0);
    } finally {
      await db.end();
    }
  },
);
