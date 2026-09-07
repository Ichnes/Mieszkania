import "../config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { pool } from "../db";
import { storageRoot } from "../config";
import { extractAdresowoConstructionYear } from "../collectors/adresowo";

type Manifest = {
  externalId: string;
  raw?: { storageKey?: string; encoding?: string };
};

const apply = process.argv.includes("--apply");

async function main() {
  const missing = await pool.query<{ id: string; external_id: string }>(`
    select l.id, l.external_id
    from listings l
    join sources s on s.id = l.source_id
    where s.key = 'adresowo' and l.year_built is null
  `);
  const missingByExternalId = new Map(missing.rows.map((row) => [row.external_id, row]));
  const inferred: Array<{ id: string; externalId: string; yearBuilt: number }> = [];

  const manifestRoot = resolve(storageRoot, "offers", "manifests", "adresowo");
  const manifestPaths = existsSync(manifestRoot)
    ? readdirSync(manifestRoot).filter((name) => name.endsWith(".json")).map((name) => resolve(manifestRoot, name))
    : [];
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
      const listing = missingByExternalId.get(manifest.externalId);
      const rawStorageKey = manifest.raw?.storageKey;
      if (!listing || !rawStorageKey) continue;
      const raw = readFileSync(resolve(storageRoot, ...rawStorageKey.split("/")));
      const html = manifest.raw?.encoding === "gzip" ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
      const yearBuilt = extractAdresowoConstructionYear(html);
      if (yearBuilt) inferred.push({ id: listing.id, externalId: listing.external_id, yearBuilt });
    } catch {
      // A missing legacy object must not stop the remaining archive scan.
    }
  }

  let updated = 0;
  if (apply && inferred.length > 0) {
    const result = await pool.query(`
      update listings l
      set year_built = values.year_built
      from unnest($1::uuid[], $2::int[]) as values(id, year_built)
      where l.id = values.id and l.year_built is null
    `, [inferred.map((row) => row.id), inferred.map((row) => row.yearBuilt)]);
    updated = result.rowCount ?? 0;
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", missing: missing.rowCount, inferred: inferred.length, updated }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
