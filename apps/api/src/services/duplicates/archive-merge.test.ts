import { getMediaDownloadCandidates } from "../media/image-repository";
import test from "node:test";
import assert from "node:assert/strict";
import { choosePreferredPrimaryListingId } from "./listing-duplicates";

test("manual archive merge keeps an active listing visible regardless of source priority", async () => {
  const db = {
    query: async () => ({
      rows: [
        { id: "archive", status: "removed", source_key: "otodom", created_at: "2020-01-01" },
        { id: "live", status: "active", source_key: "olx", created_at: "2026-01-01" },
      ],
    }),
  };
  assert.equal(await choosePreferredPrimaryListingId(db as never, "archive", "live"), "live");
});
import { randomUUID } from "node:crypto";
import pg from "pg";
import { pool } from "../../db";
import { getDuplicateCandidates, reviewDuplicateCandidate } from "./listing-duplicates";

test(
  "archived duplicate candidates can be merged without hiding the live listing or changing archive status",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const schema = `test_archive_merge_${randomUUID().replaceAll("-", "")}`;
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
        "listing_duplicate_groups",
        "listing_duplicate_group_members",
        "listing_duplicate_reviews",
        "listing_images",
        "listing_media_assets",
        "price_events",
      ])
        await db.query(
          `create table ${table} (like public.${table} including defaults including indexes)`,
        );
      t.mock.method(pool, "query", db.query.bind(db));
      t.mock.method(pool, "connect", db.connect.bind(db));
      const source = (
        await db.query(
          "insert into sources(key,name,kind,access_mode) values('otodom','Test','portal','crawler') returning id",
        )
      ).rows[0].id;
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      for (let i = 0; i < ids.length; i++)
        await db.query(
          `insert into listings(id,source_id,external_id,canonical_url,title,city,district,address_text,description,area_sqm,rooms,price_amount,source_price_amount,status)
      values($1,$2,$3,'https://example.test','Test','Warszawa','Mokotów','Testowa 1, Warszawa',$4,60,3,900000,900000,$5)`,
          [
            ids[i],
            source,
            String(i),
            "Bardzo przestronne jasne mieszkanie salon kuchnia sypialnia łazienka balkon garaż winda park szkoła przedszkole ogrodzone osiedle",
            i === 0 ? "active" : "removed",
          ],
        );
      const candidates = await getDuplicateCandidates(20, ids[1], { minConfidence: 0 });
      assert.ok(candidates.items.some((pair) => [pair.left.id, pair.right.id].includes(ids[0])));
      assert.ok(candidates.items.some((pair) => [pair.left.id, pair.right.id].includes(ids[2])));
      await reviewDuplicateCandidate({ leftId: ids[1], rightId: ids[0], status: "same_listing" });
      const asset = (
        await db.query(
          `insert into listing_media_assets(storage_key,source_url) values('test/archive.jpg','https://example.test/archive.jpg') returning id`,
        )
      ).rows[0].id;
      await db.query(
        `insert into listing_images(listing_id,asset_id,source_url) values($1,$2,'https://example.test/archive.jpg')`,
        [ids[1], asset],
      );
      const downloads = await getMediaDownloadCandidates({ listingId: ids[0], limit: 1 });
      assert.equal(
        downloads[0]?.assetId,
        asset,
        "shared photos from an archived member can be downloaded through the live offer",
      );
      const rows = (
        await db.query(
          "select id,status,hidden_duplicate_of_id from listings where id=any($1::uuid[])",
          [ids],
        )
      ).rows;
      assert.equal(rows.find((row) => row.id === ids[0]).hidden_duplicate_of_id, null);
      assert.equal(rows.find((row) => row.id === ids[1]).hidden_duplicate_of_id, ids[0]);
      assert.equal(rows.find((row) => row.id === ids[1]).status, "removed");
      assert.equal(
        (await getDuplicateCandidates(20, ids[0], { minConfidence: 0 })).items.some((pair) =>
          [pair.left.id, pair.right.id].includes(ids[1]),
        ),
        false,
      );
    } finally {
      t.mock.restoreAll();
      await db.end();
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    }
  },
);
