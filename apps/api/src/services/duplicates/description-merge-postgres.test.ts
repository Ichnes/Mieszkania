import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { autoMergeDuplicateByDescription, duplicateGroupsCompatible } from "./listing-duplicates";

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
      for (const area of [60, 51.01, 0, null]) {
        await db.query("update listings set area_sqm=$1 where id=$2", [area, ids[1]]);
        assert.equal(await autoMergeDuplicateByDescription(db, ids[0]), null, `area=${area}`);
      }
      await db.query("update listings set area_sqm=51 where id=$1", [ids[1]]);
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
      const third = (
        await db.query(
          `insert into listings(source_id,external_id,canonical_url,title,city,description,area_sqm) values ($1,'third','https://example.test','Test','Warszawa',$2,52) returning id`,
          [source, prefix.join(" ")],
        )
      ).rows[0].id;
      assert.equal(
        await duplicateGroupsCompatible(db, ids[1], third, true),
        false,
        "group spread blocks a transitive merge",
      );
      assert.equal(
        await duplicateGroupsCompatible(db, ids[1], third, false),
        false,
        "manual merge also respects area limit",
      );
      await db.query("update listings set area_sqm=50.5 where id=$1", [third]);
      assert.equal(await duplicateGroupsCompatible(db, ids[1], third, true), true);
      await db.query(
        `insert into listing_duplicate_reviews(pair_key,listing_id_left,listing_id_right,status) values (concat(least($1::text,$2::text),':',greatest($1::text,$2::text)),least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'different_listing')`,
        [ids[0], third],
      );
      assert.equal(
        await duplicateGroupsCompatible(db, ids[1], third, true),
        false,
        "rejection against another group member prevents remerge",
      );
    } finally {
      await db.query("rollback");
      db.release();
      await pool.end();
    }
  },
);
