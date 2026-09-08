import "../../config";
import { storageRoot } from "../../config";
import { pool } from "../../db";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { GratkaParser } from "../../collectors/gratka/gratka-parser";
import { parseListing } from "../../collectors/nieruchomosci-online";
import { readArchivedText, resolveArchivedFile } from "../../services/archive/archived-file-reader";

type Row = {
  id: string;
  key: string;
  external_id: string;
  canonical_url: string;
  floor: number | null;
  total_floors: number | null;
  latitude: string | null;
  longitude: string | null;
};
type Proposal = {
  row: Row;
  floor?: number;
  totalFloors?: number;
  latitude?: number;
  longitude?: number;
};
const apply = process.argv.includes("--apply");
function storagePath(...parts: string[]) {
  const path = resolve(storageRoot, ...parts);
  if (!path.startsWith(resolve(storageRoot) + sep)) throw new Error("Invalid archive path");
  return path;
}
async function archivedHtml(row: Row) {
  const safeId = row.external_id.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const manifestName = `${safeId.slice(0, 80)}-${createHash("sha1").update(row.external_id).digest("hex").slice(0, 10)}.json`;
  try {
    const manifest = JSON.parse(
      await readFile(storagePath("offers", "manifests", row.key, manifestName), "utf8"),
    );
    if (manifest.raw?.storageKey)
      return await readArchivedText(storagePath(manifest.raw.storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const root = storagePath("offers", row.key, safeId);
  let directories;
  try {
    directories = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  for (const dir of directories
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse()) {
    const path = await resolveArchivedFile(resolve(root, dir, "raw.html"));
    if (path) return readArchivedText(path);
  }
  return null;
}
async function main() {
  const rows =
    await pool.query<Row>(`select l.id,s.key,l.external_id,l.canonical_url,l.floor,l.total_floors,l.latitude,l.longitude from listings l join sources s on s.id=l.source_id
    where (s.key='gratka' and (l.floor is null or l.total_floors is null)) or (s.key in ('domiporta','nieruchomosci_online') and l.latitude is null and l.longitude is null)`);
  const proposals: Proposal[] = [];
  let missingArchive = 0,
    failed = 0;
  for (const row of rows.rows)
    try {
      const html = await archivedHtml(row);
      if (!html) {
        missingArchive++;
        continue;
      }
      const parsed =
        row.key === "gratka"
          ? await new GratkaParser().parse({ url: row.canonical_url, html, statusCode: 200 })
          : parseListing(row.canonical_url, html, row.external_id);
      const proposal: Proposal = { row };
      if (row.key === "gratka") {
        if (row.floor == null && parsed.floor != null) proposal.floor = parsed.floor;
        if (row.total_floors == null && parsed.totalFloors != null)
          proposal.totalFloors = parsed.totalFloors;
      } else if (parsed.latitude != null && parsed.longitude != null) {
        proposal.latitude = parsed.latitude;
        proposal.longitude = parsed.longitude;
      }
      if (Object.keys(proposal).length > 1) proposals.push(proposal);
    } catch (error) {
      failed++;
      console.error(row.external_id, (error as Error).message);
    }
  let updated = 0;
  let backup: string | undefined;
  if (apply && proposals.length) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const before = await client.query(
        "select id,floor,total_floors,latitude,longitude from listings where id=any($1::uuid[]) order by id for update",
        [proposals.map((p) => p.row.id)],
      );
      await mkdir(storagePath("maintenance"), { recursive: true });
      backup = storagePath("maintenance", `portal-facts-before-${Date.now()}.ndjson`);
      await writeFile(backup, before.rows.map((row) => JSON.stringify(row)).join("\n") + "\n", {
        flag: "wx",
      });
      for (const p of proposals) {
        const result = await client.query(
          `update listings set floor=coalesce(floor,$2),total_floors=coalesce(total_floors,$3),
          latitude=case when latitude is null and longitude is null then $4 else latitude end,
          longitude=case when latitude is null and longitude is null then $5 else longitude end
          where id=$1 and ((floor is null and $2::int is not null) or (total_floors is null and $3::int is not null) or (latitude is null and longitude is null and $4::numeric is not null and $5::numeric is not null))`,
          [
            p.row.id,
            p.floor ?? null,
            p.totalFloors ?? null,
            p.latitude ?? null,
            p.longitude ?? null,
          ],
        );
        updated += result.rowCount ?? 0;
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        candidates: rows.rowCount,
        missingArchive,
        failed,
        recoverable: proposals.length,
        bySource: proposals.reduce<Record<string, number>>(
          (a, p) => ((a[p.row.key] = (a[p.row.key] ?? 0) + 1), a),
          {},
        ),
        updated,
        backup,
      },
      null,
      2,
    ),
  );
}
try {
  await main();
} finally {
  await pool.end();
}
