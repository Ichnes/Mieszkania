import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createListingSnapshotCache, listingSnapshotPayloadSql } from "./listing-snapshot-cache";

test(
  "PostgreSQL xmin invalidates a snapshot edited in place, and deletion removes cached facts",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const client = await pool.connect();
    try {
      // Connection-local table shadows the real relation; application records are untouched.
      await client.query(
        "create temporary table listing_snapshots (id uuid primary key, payload_raw jsonb not null)",
      );
      const id = randomUUID();
      const payload = (floor: string) => ({
        portalFeatures: { lift: "tak" },
        jsonLd: { additionalProperty: [{ name: "Winda", value: "tak" }] },
        nextData: { props: { pageProps: { ad: { attributes: { floor_no: floor } } } } },
      });
      await client.query("insert into listing_snapshots values ($1,$2)", [
        id,
        payload("ground_floor"),
      ]);
      const cache = createListingSnapshotCache();
      let reads = 0;
      const load = async () => {
        const refs = await client.query(
          "select id as snapshot_id, xmin::text as snapshot_version from listing_snapshots",
        );
        return cache.load(refs.rows, async (ids) => {
          reads++;
          return (
            await client.query(
              `select id, xmin::text as version, ${listingSnapshotPayloadSql} as payload from listing_snapshots where id=any($1::uuid[])`,
              [ids],
            )
          ).rows;
        });
      };
      assert.deepEqual((await load()).get(id), payload("ground_floor"));
      await load();
      assert.equal(reads, 1);
      await client.query("update listing_snapshots set payload_raw=$2 where id=$1", [
        id,
        payload("7"),
      ]);
      assert.deepEqual((await load()).get(id), payload("7"));
      assert.equal(reads, 2);
      await client.query("delete from listing_snapshots where id=$1", [id]);
      assert.equal((await load()).size, 0);
    } finally {
      client.release();
      await pool.end();
    }
  },
);
