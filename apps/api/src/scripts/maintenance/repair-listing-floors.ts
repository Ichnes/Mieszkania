import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "../../db";
import { storageRoot } from "../../config";
import { parseListing } from "../../collectors/nieruchomosci-online";
import { inferBuildingDetails } from "../../services/listings/listing-description-facts";
import { readArchivedText, resolveArchivedFile } from "../../services/archive/archived-file-reader";
import { buildManifestPath } from "../../services/archive/offer-archive";

async function findArchive(row: { source: string; external_id: string; archive: string | null }) {
  if (row.archive) {
    const path = await resolveArchivedFile(join(storageRoot, row.archive));
    if (path) return path;
  }
  try {
    const manifest = JSON.parse(
      await readFile(buildManifestPath(row.source, row.external_id), "utf8"),
    );
    const path = await resolveArchivedFile(join(storageRoot, manifest.raw.storageKey));
    if (path) return path;
  } catch {
    /* Older offers use dated folders instead of manifests. */
  }
  const root = join(storageRoot, "offers", row.source, row.external_id);
  try {
    const folders = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
    for (const folder of folders) {
      const path = await resolveArchivedFile(join(root, folder, "raw.html"));
      if (path) return path;
    }
  } catch {
    /* Missing archives remain unresolved. */
  }
  return null;
}

// Preview by default. Apply only corroborated corrections; never split a number heuristically.
const apply = process.argv.includes("--apply");
const changes: Array<{ id: string; before: number; after: number; evidence: string }> = [];
let unresolved = 0;
try {
  const result =
    await pool.query(`select l.id,l.floor,l.total_floors,l.description,l.external_id,l.canonical_url,s.key source,
    (select storage_key from crawl_artifacts a where a.listing_id=l.id and a.artifact_type='html' order by captured_at desc limit 1) archive
    from listings l join sources s on s.id=l.source_id where l.floor>l.total_floors or l.floor>100`);
  for (const row of result.rows) {
    let floor: number | undefined;
    let evidence = "description";
    if (row.source === "domiporta") {
      try {
        const archive = await findArchive(row);
        if (!archive) throw new Error("No archived HTML");
        const html = await readArchivedText(archive);
        const parsed = parseListing(row.canonical_url, html, row.external_id);
        if (
          parsed.floor !== undefined &&
          parsed.floor >= 0 &&
          (row.total_floors == null || parsed.floor <= row.total_floors)
        ) {
          floor = parsed.floor;
          evidence = archive;
        }
      } catch {
        /* Keep the original if the archived source is unavailable. */
      }
    }
    if (floor === undefined) {
      const facts = inferBuildingDetails(row.description ?? "");
      if (
        facts.floor !== undefined &&
        facts.totalFloors !== undefined &&
        facts.floor <= facts.totalFloors &&
        row.total_floors === facts.totalFloors &&
        row.floor === Number(`${facts.floor}${facts.totalFloors}`)
      )
        floor = facts.floor;
    }
    if (floor === undefined || floor === row.floor) {
      unresolved++;
      continue;
    }
    changes.push({ id: row.id, before: row.floor, after: floor, evidence });
  }
  const reportDir = join(storageRoot, "maintenance");
  await mkdir(reportDir, { recursive: true });
  const report = join(reportDir, `floor-repair-${Date.now()}.json`);
  await writeFile(report, JSON.stringify({ apply, changes, unresolved }, null, 2));
  let updated = 0;
  if (apply) {
    const db = await pool.connect();
    try {
      await db.query("begin");
      for (const item of changes) {
        const r = await db.query(
          "update listings set floor=$1,updated_at=now() where id=$2 and floor=$3",
          [item.after, item.id, item.before],
        );
        updated += r.rowCount ?? 0;
      }
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  }
  console.log(
    JSON.stringify({
      apply,
      candidates: result.rowCount,
      corroborated: changes.length,
      updated,
      unresolved,
      report,
    }),
  );
} finally {
  await pool.end();
}
