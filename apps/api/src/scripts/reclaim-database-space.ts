import "../config";
import { pool } from "../db";

const tables = ["crawl_artifacts", "listing_snapshots"] as const;

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({
    mode: "dry-run",
    tables,
    note: "Użyj --apply w oknie serwisowym. VACUUM FULL zakłada wyłączny lock na każdą tabelę, ale nie usuwa rekordów."
  }, null, 2));
  await pool.end();
  process.exit(0);
}

try {
  const before = await sizes();
  for (const table of tables) {
    console.log(`VACUUM FULL ${table}: start`);
    await pool.query(`vacuum (full, analyze) ${table}`);
    console.log(`VACUUM FULL ${table}: gotowe`);
  }
  const after = await sizes();
  const beforeBytes = before.reduce((total, row) => total + row.bytes, 0);
  const afterBytes = after.reduce((total, row) => total + row.bytes, 0);
  console.log(JSON.stringify({
    mode: "apply",
    before,
    after,
    reclaimedBytes: Math.max(beforeBytes - afterBytes, 0),
    reclaimedSize: formatBytes(Math.max(beforeBytes - afterBytes, 0))
  }, null, 2));
} finally {
  await pool.end();
}

async function sizes() {
  const result = await pool.query<{ relation: string; bytes: string }>(`
    select relation, pg_total_relation_size(to_regclass(relation))::text as bytes
    from unnest($1::text[]) relation
  `, [tables]);
  return result.rows.map((row) => ({ relation: row.relation, bytes: Number(row.bytes), size: formatBytes(Number(row.bytes)) }));
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}
