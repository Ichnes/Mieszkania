import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { MaxonCollector } from "../../collectors/maxon";
import { pool } from "../../db";
import { publicHttp } from "../http/public-fetch";
import {
  claimListingImportBatch,
  enqueueListingImports,
  enqueueStaleListingPriceUpdates,
  skipFailedMaxonLegacyImports,
  skipListingImportUrl,
} from "./listing-import-queue";

test(
  "obsolete Maxon queue URLs stay skipped through retries and can be replaced by current URLs",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const schema = `test_import_queue_${randomUUID().replaceAll("-", "")}`;
    const db = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    t.mock.method(pool, "query", db.query.bind(db));
    t.mock.method(pool, "connect", db.connect.bind(db));

    const sourceKey = "maxon";
    const externalId = "maxon-101";
    const obsolete = "https://www.maxon.pl/mieszkania/oferta/test-ms-max";
    const current = "https://www.maxon.pl/oferta/test-101";
    const enqueue = (url: string, id = externalId) =>
      enqueueListingImports({ sourceKey, city: "Warszawa", items: [{ url, externalId: id }] });
    const collector = new MaxonCollector();
    try {
      await db.query(`create schema ${schema}`);
      for (const table of ["sources", "listings", "listing_import_queue"]) {
        await db.query(
          `create table ${table} (like public.${table} including defaults including indexes)`,
        );
      }
      await db.query(
        `insert into sources(key,name,kind,access_mode) values ('maxon','Maxon','portal','crawler')`,
      );
      await db.query(
        `insert into listings (source_id, external_id, canonical_url, title, city, price_amount, last_seen_at)
        select id, $1, $2, 'Saved listing', 'Warszawa', 500000, now() - interval '2 days' from sources`,
        [externalId, obsolete],
      );
      await db.query(
        `insert into listing_import_queue (source_key, external_id, canonical_url, city, status, attempts, last_error)
        values ('maxon', $1, $2, 'Warszawa', 'failed', 70, 'MAXON_LEGACY_URL: obsolete'),
               ('maxon', 'maxon-102', $2, 'Warszawa', 'failed', 1, 'MAXON_SITEMAP_HTTP_503'),
               ('adresowo', 'other', $2, 'Warszawa', 'failed', 1, 'MAXON_LEGACY_URL: obsolete')`,
        [externalId, obsolete],
      );

      assert.equal((await skipFailedMaxonLegacyImports(db)).rowCount, 1);
      assert.equal((await skipFailedMaxonLegacyImports(db)).rowCount, 0);
      const status = await collector.getQueueStatus();
      assert.deepEqual(status.counts, { pending: 0, processing: 0, completed: 0, failed: 1 });
      assert.deepEqual(
        status.recentFailures.map((failure) => failure.external_id),
        ["maxon-102"],
      );
      assert.deepEqual(await collector.retryFailed(), { retried: 1 });
      assert.deepEqual(await enqueueStaleListingPriceUpdates(), { due: 0, queued: 0 });
      assert.deepEqual(await enqueue(obsolete), { queued: 0 });

      t.mock.method(publicHttp, "fetch", async () => new Response(`<loc>${current}</loc>`));
      assert.deepEqual(await collector.processQueue(), {
        claimed: 1,
        completed: 0,
        failed: 0,
        skipped: 1,
        failures: [],
      });
      assert.deepEqual(await collector.retryFailed(), { retried: 0 });
      assert.deepEqual((await collector.getQueueStatus()).recentFailures, []);

      assert.deepEqual(await enqueue(current), { queued: 1 });
      assert.deepEqual(await enqueueStaleListingPriceUpdates(), { due: 0, queued: 0 });
      const [item] = await claimListingImportBatch({ sourceKey, limit: 1 });
      assert.equal(item.canonical_url, current);
      assert.equal(item.attempts, 0);
      assert.equal(
        (await db.query("select canonical_url from listings where external_id = $1", [externalId]))
          .rows[0].canonical_url,
        obsolete,
      );

      const legacy = "https://www.maxon.pl/mieszkania/oferta/redirecting-ms-max";
      const replacement = "https://www.maxon.pl/oferta/test-103";
      await enqueue(legacy, "maxon-103");
      const [inProgress] = await claimListingImportBatch({ sourceKey, limit: 1 });
      await enqueue(replacement, "maxon-103");
      await skipListingImportUrl(inProgress.id, inProgress.canonical_url);
      const [rediscovered] = await claimListingImportBatch({ sourceKey, limit: 1 });
      assert.equal(rediscovered.id, inProgress.id);
      assert.equal(rediscovered.canonical_url, replacement);
    } finally {
      await db.query(`drop schema if exists ${schema} cascade`);
      await db.end();
    }
  },
);
