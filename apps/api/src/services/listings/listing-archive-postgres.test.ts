import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { archiveUnavailableListing, markListingArchivedWithDb } from "./listing-archive";

test(
  "portal removal preserves saved facts and archives only the matching source, idempotently",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query("begin");
      for (const table of ["sources", "listings", "price_events"]) {
        await db.query(
          `create temporary table ${table} (like public.${table} including defaults including indexes) on commit drop`,
        );
      }
      for (const sourceKey of ["adresowo", "maxon"]) {
        const source = await db.query(
          "insert into sources(key,name,kind,access_mode) values ($1,$1,'portal','crawler') returning id",
          [sourceKey],
        );
        await db.query(
          "insert into listings(source_id,external_id,canonical_url,title,city,description,price_amount,status) values ($1,'legacy-id',$2,'Saved title','Warszawa','Saved description',1240000,'active')",
          [source.rows[0].id, `https://${sourceKey}.pl/oferta/test`],
        );
      }
      for (const sourceKey of ["adresowo", "maxon"]) {
        const input = {
          sourceKey,
          externalId: "new-url-derived-id",
          url: `https://${sourceKey}.pl/oferta/test`,
          html:
            sourceKey === "adresowo" ? "<p>Ogłoszenie usunięte</p>" : "<h1>OFERTA NIEAKTUALNA</h1>",
        };
        const before = await db.query(
          "select l.* from listings l join sources s on s.id=l.source_id where s.key=$1",
          [sourceKey],
        );
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await archiveUnavailableListing(input, (identity) =>
            markListingArchivedWithDb(db, identity),
          );
          assert.equal(result?.listingId, before.rows[0].id);
          const after = (await db.query("select * from listings where id=$1", [result!.listingId]))
            .rows[0];
          assert.equal(after.status, "removed");
          assert.ok(after.removed_at);
          for (const key of Object.keys(after).filter(
            (key) => !["status", "removed_at", "updated_at"].includes(key),
          )) {
            assert.deepEqual(after[key], before.rows[0][key], key);
          }
          assert.equal(
            (
              await db.query(
                "select count(*)::int n from price_events where listing_id=$1 and event_type='removed'",
                [result!.listingId],
              )
            ).rows[0].n,
            1,
          );
        }
        if (sourceKey === "adresowo") {
          assert.equal(
            (
              await db.query(
                "select l.status from listings l join sources s on s.id=l.source_id where s.key='maxon'",
              )
            ).rows[0].status,
            "active",
          );
        }
      }
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
