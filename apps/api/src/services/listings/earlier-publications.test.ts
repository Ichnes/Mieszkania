import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { getEarlierPublications } from "./earlier-publications";

test(
  "history follows linked archives across copies and predecessors, dates first observations and ignores newer records",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query(`begin;
      create temporary table sources(id int, name text);
      create temporary table listings(id text, status text, published_at timestamptz, first_seen_at timestamptz, source_id int default 1, exclusion_reason text);
      create temporary table listing_duplicate_group_members(group_id int,listing_id text);
      create temporary table listing_relistings(current_listing_id text,previous_listing_id text);
      insert into sources values (1,'Portal');
      insert into listings(id,status,published_at,first_seen_at) values
        ('focus','active','2026-11-25','2026-11-26'),('peer','active',null,'2026-11-25'),
        ('archive','removed','2026-05-06','2026-07-27'),('older','removed',null,'2026-02-19'),
        ('unrelated','removed','2025-01-01','2025-01-05'),('newer','removed','2026-11-26','2026-11-26'),
        ('refreshed','removed','2026-09-04','2026-08-01'),('rejected','removed',null,'2026-02-01');
      update listings set exclusion_reason='manual_rejected' where id='rejected';
      insert into listing_duplicate_group_members values (1,'focus'),(1,'peer'),(1,'archive'),(1,'newer'),(1,'rejected');
      insert into listing_relistings values ('peer','archive'),('archive','older'),('older','refreshed');`);
      const result = await getEarlierPublications(db, "focus");
      assert.deepEqual(
        result.map((r) => [r.id, r.dateOrigin]),
        [
          ["older", "first_seen"],
          ["archive", "portal"],
          ["refreshed", "first_seen"],
        ],
      );
      assert.deepEqual(await getEarlierPublications(db, "unrelated"), []);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
