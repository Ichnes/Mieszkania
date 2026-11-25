import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { linkedFees, needsPeerFee } from "./listing-repository";

test("a range, annual rate, or explicit absence of rent prevents replacing the listing's information", () => {
  for (const description of [
    "Czynsz: 800–1000 zł",
    "Czynsz 1200 zł rocznie",
    "Mieszkanie bezczynszowe",
  ]) {
    assert.equal(needsPeerFee(description), false);
  }
  assert.equal(needsPeerFee("Piętro trzecie."), true);
});

test(
  "fees follow current duplicate membership and require agreement between other portals",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    const id = "00000000-0000-0000-0000-000000000001";
    try {
      await db.query(`begin;
      create temporary table sources(id int, name text);
      create temporary table listings(id uuid,source_id int,status text,description text,exclusion_reason text,last_seen_at timestamptz);
      create temporary table listing_duplicate_group_members(listing_id uuid,group_id int);
      create temporary table listing_snapshots(listing_id uuid,payload_raw jsonb,captured_at timestamptz);
      insert into sources values (1,'A'),(2,'B'),(3,'C');
      insert into listings select lpad(i::text,32,'0')::uuid,i,'removed',case i when 2 then 'Czynsz: 850 zł' end,null,now() from generate_series(1,3) i;
      insert into listing_duplicate_group_members select id,1 from listings;`);
      const amount = async () => (await linkedFees(db, [id])).get(id);
      assert.equal((await amount())?.amount, 850);
      assert.equal((await amount())?.source.archived, true);
      await db.query("update listings set description='Czynsz 950 zł' where source_id=3");
      assert.equal(await amount(), undefined);
      await db.query("delete from listing_duplicate_group_members where listing_id=$1", [id]);
      assert.equal(await amount(), undefined);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
