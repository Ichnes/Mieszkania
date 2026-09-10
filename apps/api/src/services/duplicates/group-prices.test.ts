import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { restoreSourcePrice, syncDuplicateGroupPrice } from "./group-prices";

test(
  "PostgreSQL: duplicate prices share the minimum and record attributed, idempotent changes",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query(`create temporary table sources(id text, name text) on commit drop;
      create temporary table listings(id text primary key, source_id text, canonical_url text, price_amount numeric, source_price_amount numeric, price_per_sqm numeric, area_sqm numeric, status text default 'active', exclusion_reason text) on commit drop;
      create temporary table listing_duplicate_group_members(listing_id text, group_id text, is_primary boolean) on commit drop;
      create type pg_temp.test_price_event as enum ('price_drop','price_increase');
      create temporary table price_events(listing_id text, event_type pg_temp.test_price_event, previous_price_amount numeric, new_price_amount numeric, source_label text, source_url text, changed_at timestamptz default now()) on commit drop;
      insert into sources values ('a','Otodom'),('b','Domiporta');
      insert into listings(id,source_id,canonical_url,price_amount,source_price_amount,area_sqm) values ('a','a','https://example.com/a',1000000,1000000,50),('b','b','https://example.com/b',900000,900000,50);
      insert into listing_duplicate_group_members values ('a','g',true),('b','g',false);`);
      await syncDuplicateGroupPrice(db, "g");
      const prices = async () =>
        (
          await db.query(
            "select price_amount::int price,source_price_amount::int source,price_per_sqm::int unit from listings order by id",
          )
        ).rows;
      assert.deepEqual(await prices(), [
        { price: 900000, source: 1000000, unit: 18000 },
        { price: 900000, source: 900000, unit: 18000 },
      ]);
      const events = async () =>
        (await db.query("select * from price_events order by listing_id")).rows;
      assert.equal((await events()).length, 2);
      assert.equal((await events())[0].source_label, "Domiporta");
      assert.equal((await events())[0].event_type, "price_drop");
      assert.equal(Number((await events())[0].previous_price_amount), 1000000);
      assert.ok((await events())[0].changed_at instanceof Date);
      await syncDuplicateGroupPrice(db, "g");
      assert.equal((await events()).length, 2);
      await db.query("update listings set source_price_amount=1100000 where id='a'");
      await syncDuplicateGroupPrice(db, "g");
      assert.equal((await events()).length, 2);
      await db.query("update listings set source_price_amount=850000 where id='b'");
      await syncDuplicateGroupPrice(db, "g");
      assert.equal((await events()).length, 4);
      assert.equal((await prices())[0].price, 850000);
      await db.query("update listings set status='removed' where id='b'");
      await syncDuplicateGroupPrice(db, "g");
      assert.equal((await prices())[0].price, 1100000);
      assert.equal((await events()).length, 6);
      await db.query("delete from listing_duplicate_group_members where listing_id='b'");
      await restoreSourcePrice(db, "b");
      assert.equal((await prices())[1].price, 850000);
    } finally {
      await db.query("rollback");
      db.release();
      await pool.end();
    }
  },
);
