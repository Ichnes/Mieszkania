import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { normalizeMarketLocation, marketLocationJoinSql } from "./market-locations";
import { priceSampleSql } from "./market-sample";
import { inheritStableDuplicateFacts } from "../duplicates/listing-duplicates";
import { buildListingSearch } from "../listings/listing-search";

test(
  "PostgreSQL: alias percentiles use observations and duplicate inheritance preserves conflicts",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query(
        `create temporary table listings(id text primary key, district text, neighborhood text, price_amount numeric, area_sqm numeric, year_built int, rooms int, floor int, total_floors int, price_per_sqm numeric,address_text text,latitude numeric,longitude numeric,last_seen_at timestamptz default now()) on commit drop`,
      );
      await db.query(
        `create temporary table listing_duplicate_group_members(listing_id text,group_id text,is_primary boolean) on commit drop`,
      );
      await db.query(
        `insert into listings(id,district,price_amount,area_sqm) values ('a','MOKOTÓW',10000,1),('b','MOKOTÓW',10000,1),('c','MOKOTÓW',10000,1),('d','MOKOTÓW',100000,1),('e','Mokotów',20000,1)`,
      );
      const mapping = JSON.stringify(
        ["MOKOTÓW", "Mokotów"].map((district) =>
          normalizeMarketLocation({ district, neighborhood: null }),
        ),
      );
      const result = await db.query(
        `select location.district,${priceSampleSql} from listings l ${marketLocationJoinSql} group by location.district`,
        [mapping],
      );
      assert.equal(result.rows.length, 1);
      assert.equal(Number(result.rows[0].median_price), 10000);
      assert.equal(Number(result.rows[0].q1), 10000);
      assert.equal(Number(result.rows[0].q3), 20000);
      // Search must work even when a street occurs only in the stored address.
      await db.query("alter table listings add column title text, add column description text");
      await db.query("update listings set address_text='Okopowej 13, Warszawa' where id='a'");
      for (const query of ["Okopowa", "okopowej", "ul. Okopowa 13"]) {
        const search = buildListingSearch(query, 1);
        const matches = await db.query(
          `select id from listings l where ${search.clause}`,
          search.values,
        );
        assert.deepEqual(
          matches.rows.map((row) => row.id),
          ["a"],
        );
      }
      // The previous weighted average of alias medians was 12,000, which is not the median.
      await db.query(`truncate listings; insert into listings(id,price_amount) values ('target',1000000),('donor',900000),('other',950000);
      insert into listing_duplicate_group_members values ('target','group',true),('donor','group',false),('other','group',false);
      update listings set year_built=2000,floor=0,total_floors=6,area_sqm=80,latitude=52.2,longitude=21.1 where id='donor'`);
      await inheritStableDuplicateFacts(db, "group");
      let row = (await db.query("select * from listings where id='target'")).rows[0];
      assert.equal(row.year_built, 2000);
      assert.equal(row.floor, 0);
      assert.equal(Number(row.price_per_sqm), 12500);
      await db.query(
        `update listings set year_built=2001,floor=1,latitude=52.3 where id='other'; update listings set year_built=null,floor=null,latitude=null,longitude=null where id='target'`,
      );
      await inheritStableDuplicateFacts(db, "group");
      row = (await db.query("select * from listings where id='target'")).rows[0];
      assert.equal(row.year_built, null);
      assert.equal(row.floor, null);
      assert.equal(row.latitude, null);
      assert.equal(row.longitude, null);
      assert.equal(Number(row.price_amount), 1000000);
    } finally {
      await db.query("rollback");
      db.release();
      await pool.end();
    }
  },
);
