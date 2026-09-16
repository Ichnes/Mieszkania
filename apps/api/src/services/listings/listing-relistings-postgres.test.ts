import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  getPotentialRelistings,
  scanRelistedListings,
  visibleRelistingCandidateSql,
} from "./listing-relistings";

test(
  "scan persists suggestions separately, repeated scans are idempotent, and stale archives disappear",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const schema = `test_relistings_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const db = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    try {
      await admin.query(`create schema ${schema}`);
      for (const table of [
        "sources",
        "listings",
        "listing_relistings",
        "listing_relisting_candidates",
      ]) {
        await db.query(
          `create table ${table} (like public.${table} including defaults including indexes)`,
        );
      }
      const source = (
        await db.query(
          "insert into sources(key,name,kind,access_mode) values ('test','Test','portal','crawler') returning id",
        )
      ).rows[0].id;
      const ids = [randomUUID(), randomUUID()];
      for (let index = 0; index < ids.length; index++) {
        await db.query(
          `insert into listings(id,source_id,external_id,canonical_url,title,city,address_text,description,rooms,area_sqm,floor,price_amount,status,first_seen_at,last_seen_at,removed_at)
        values ($1,$2,$3,'https://example.test','Test','Warszawa','Motorowa 10, Warszawa',$4,3,65,2,$5,$6,$7,$8,$9)`,
          [
            ids[index],
            source,
            `test-${index}`,
            index ? "Changed description" : "Original description",
            index ? 1_100_000 : 1_200_000,
            index ? "active" : "removed",
            index ? "2026-03-01" : "2026-01-01",
            index ? "2026-03-01" : "2026-02-01",
            index ? null : "2026-02-01",
          ],
        );
      }
      for (let run = 0; run < 2; run++) {
        const result = await scanRelistedListings(1, db);
        assert.equal(result.matched, 0);
        assert.equal(result.potentialCount, 1);
        assert.equal(result.potentialItems[0].previous.id, ids[0]);
        assert.equal(
          (await db.query("select count(*)::int n from listing_relistings")).rows[0].n,
          0,
        );
        const candidates = await getPotentialRelistings(ids[1], db);
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0].priceDifferenceAmount, -100_000);
        const count = await db.query(
          `select (select count(*) ${visibleRelistingCandidateSql})::int n from listings l where l.id=$1`,
          [ids[1]],
        );
        assert.equal(count.rows[0].n, 1);
      }
      await db.query("update listings set exclusion_reason='manual_rejected' where id=$1", [
        ids[0],
      ]);
      assert.deepEqual(await getPotentialRelistings(ids[1], db), []);
      assert.equal((await scanRelistedListings(100, db)).potentialCount, 0);
      assert.equal(
        (await db.query("select count(*)::int n from listing_relisting_candidates")).rows[0].n,
        0,
      );
      await db.query("update listings set exclusion_reason=null where id=$1", [ids[0]]);
      const description = Array.from({ length: 40 }, (_, i) => `sameword${i}`).join(" ");
      await db.query("update listings set description=$1", [description]);
      const strong = await scanRelistedListings(100, db);
      assert.equal(strong.matched, 1);
      assert.equal(strong.potentialCount, 0);
      assert.equal((await db.query("select count(*)::int n from listing_relistings")).rows[0].n, 1);
    } finally {
      await db.end();
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
    }
  },
);
