import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { autoMergeDuplicateByDescription } from "./listing-duplicates";

test(
  "description prefix: 25 words merge ads on the same portal, 24 do not",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const db = await pool.connect();
    try {
      await db.query("begin");
      for (const table of [
        "sources",
        "listings",
        "listing_duplicate_groups",
        "listing_duplicate_group_members",
        "listing_duplicate_reviews",
      ]) {
        await db.query(
          `create temporary table ${table} (like public.${table} including defaults including indexes) on commit drop`,
        );
      }
      const source = (
        await db.query(
          "insert into sources(key,name,kind,access_mode) values ('otodom','Test','portal','crawler') returning id",
        )
      ).rows[0].id;
      const prefix = Array.from({ length: 25 }, (_, i) => `slowo${i}`);
      const ids: string[] = [];
      for (const suffix of ["pierwszy", "drugi"]) {
        ids.push(
          (
            await db.query(
              `insert into listings(source_id,external_id,canonical_url,title,city,description,area_sqm) values ($1,$2,'https://example.test','Test','Warszawa',$3,50) returning id`,
              [source, suffix, [...prefix.slice(0, 24), suffix].join(" ")],
            )
          ).rows[0].id,
        );
      }
      assert.equal(await autoMergeDuplicateByDescription(db, ids[0]), null);
      await db.query("update listings set description=$1 || ' ' || external_id", [
        prefix.join(" "),
      ]);
      const merged = await autoMergeDuplicateByDescription(db, ids[0]);
      assert.ok(merged);
      assert.deepEqual(new Set([merged.primaryListingId, merged.duplicateListingId]), new Set(ids));
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from listings where hidden_duplicate_of_id is not null",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(await autoMergeDuplicateByDescription(db, merged.primaryListingId), null);
    } finally {
      await db.query("rollback");
      db.release();
      await pool.end();
    }
  },
);
