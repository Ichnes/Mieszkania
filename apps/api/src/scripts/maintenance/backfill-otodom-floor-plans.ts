import "../../config";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { storageRoot } from "../../config";
import { pool } from "../../db";
import { readArchivedText, resolveArchivedFile } from "../../services/archive/archived-file-reader";
import { buildManifestPath } from "../../services/archive/offer-archive";
import { OtodomParser } from "../../collectors/otodom/otodom-parser";
import { imageIdentity } from "../../collectors/otodom/otodom-floor-plans";
import { downloadListingMedia } from "../../services/media/media-downloader";

const apply = process.argv.includes("--apply");
const download = process.argv.includes("--download");
const parser = new OtodomParser();
const stats = {
  scanned: 0,
  missingArchive: 0,
  offersWithPlans: 0,
  plans: 0,
  downloaded: 0,
  failed: 0,
};
const pendingDownloads = new Map<
  string,
  { assetId: string; storageKey: string; sourceUrl: string }
>();
try {
  const listings = (
    await pool.query<{ id: string; external_id: string; canonical_url: string }>(
      "select l.id,l.external_id,l.canonical_url from listings l join sources s on s.id=l.source_id where s.key='otodom' order by l.id",
    )
  ).rows;
  for (const listing of listings) {
    let html: string;
    try {
      try {
        const manifest = JSON.parse(
          await readFile(buildManifestPath("otodom", listing.external_id), "utf8"),
        );
        html = await readArchivedText(resolve(storageRoot, manifest.raw.storageKey));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const root = resolve(storageRoot, "offers/otodom", listing.external_id);
        const timestamps = (await readdir(root, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
          .reverse();
        let latest: string | null = null;
        for (const timestamp of timestamps) {
          latest = await resolveArchivedFile(resolve(root, timestamp, "raw.html"));
          if (latest) break;
        }
        if (!latest) {
          stats.missingArchive++;
          continue;
        }
        html = await readArchivedText(latest);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        stats.missingArchive++;
        continue;
      }
      throw error;
    }
    stats.scanned++;
    const parsed = await parser.parse({ url: listing.canonical_url, html, statusCode: 200 });
    const plans = parsed.images.filter((image) => image.caption === "Rzut");
    if (!plans.length) continue;
    stats.offersWithPlans++;
    stats.plans += plans.length;
    if (!apply) continue;
    const db = await pool.connect();
    const assets: Array<{ assetId: string; storageKey: string; sourceUrl: string }> = [];
    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(735189241)");
      const existing = (
        await db.query<{
          id: string;
          source_url: string;
          position: number;
          caption: string | null;
        }>(
          "select id,source_url,position,caption from listing_images where listing_id=$1 order by position,id",
          [listing.id],
        )
      ).rows;
      let position = Math.max(-1, ...existing.map((image) => image.position)) + 1;
      for (const plan of plans) {
        const matches = existing.filter(
          (image) => imageIdentity(image.source_url) === imageIdentity(plan.sourceUrl),
        );
        const match = matches.find((image) => image.caption === "Rzut") ?? matches[0];
        if (match) {
          // Old archives may contain several resolutions of the same photo.
          // Keep one stable plan marker, even when PostgreSQL changes physical row order.
          await db.query(
            `update listing_images set caption=case when id=$1 then 'Rzut' else null end,updated_at=now()
            where id=any($2::uuid[]) and (id=$1 or caption='Rzut')
            and caption is distinct from case when id=$1 then 'Rzut' else null end`,
            [match.id, matches.map((image) => image.id)],
          );
          continue;
        }
        const storageKey = `sources/otodom/${listing.external_id}/images/plan-${createHash("sha256").update(plan.sourceUrl).digest("hex").slice(0, 20)}`;
        const asset = (
          await db.query<{ id: string }>(
            `insert into listing_media_assets(storage_key,source_url) values($1,$2) on conflict(storage_key) do update set source_url=excluded.source_url returning id`,
            [storageKey, plan.sourceUrl],
          )
        ).rows[0];
        await db.query(
          "insert into listing_images(listing_id,asset_id,source_url,position,caption,is_primary) values($1,$2,$3,$4,'Rzut',false)",
          [listing.id, asset.id, plan.sourceUrl, position++],
        );
      }
      const pending = (
        await db.query<{ assetId: string; storageKey: string; sourceUrl: string }>(
          `select a.id "assetId",a.storage_key "storageKey",a.source_url "sourceUrl" from listing_images i join listing_media_assets a on a.id=i.asset_id where i.listing_id=$1 and i.caption='Rzut' and a.download_status<>'downloaded'`,
          [listing.id],
        )
      ).rows;
      assets.push(...pending);
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
    if (download && assets.length) {
      for (const asset of assets) pendingDownloads.set(asset.assetId, asset);
    }
    if (stats.offersWithPlans % 50 === 0) console.log(JSON.stringify(stats));
  }
  const queued = [...pendingDownloads.values()];
  for (let index = 0; index < queued.length; index += 100) {
    const results = await downloadListingMedia(queued.slice(index, index + 100));
    stats.downloaded += results.filter((result) => result.status === "downloaded").length;
    stats.failed += results.filter((result) => result.status === "failed").length;
    console.log(JSON.stringify({ phase: "download", total: queued.length, ...stats }));
  }
  console.log(JSON.stringify({ apply, ...stats }));
  if (stats.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
