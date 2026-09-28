import "../../config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "../../db";
import { storageRoot } from "../../config";
import { extractOtodomExternalId } from "../../collectors/otodom/otodom-url";

// Diagnostic only. Potential conflicts never trigger a merge, deletion or history rewrite.
const db = await pool.connect();
try {
  await db.query("begin read only");
  const identity = await db.query<{ id: string; external_id: string; canonical_url: string }>(
    "select l.id, l.external_id, l.canonical_url from listings l join sources s on s.id=l.source_id where s.key='otodom'",
  );
  const mismatchedIds = identity.rows
    .filter((row) => extractOtodomExternalId(row.canonical_url) !== row.external_id)
    .map((row) => ({ id: row.id }));
  const groups = await db.query(`select m.group_id, array_agg(l.id) as listing_ids,
    count(*)::int as members, count(*) filter(where m.is_primary)::int as primaries,
    min(l.area_sqm)::float as min_area, max(l.area_sqm)::float as max_area,
    min(l.rooms)::float as min_rooms, max(l.rooms)::float as max_rooms,
    min(l.floor) as min_floor, max(l.floor) as max_floor
    from listing_duplicate_group_members m join listings l on l.id=m.listing_id group by m.group_id
    having count(*) filter(where m.is_primary) <> 1 or
      max(l.area_sqm)-min(l.area_sqm)>greatest(3, min(l.area_sqm)*0.08) or
      max(l.rooms)<>min(l.rooms) or max(l.floor)<>min(l.floor)`);
  const history = await db.query(`select l.id, count(*)::int as snapshots,
    count(*) filter(where abs(ls.area_sqm-l.area_sqm)>greatest(5,l.area_sqm*0.15) or abs(ls.rooms-l.rooms)>1)::int as suspicious_snapshots
    from listings l join listing_snapshots ls on ls.listing_id=l.id
    group by l.id having count(*) filter(where abs(ls.area_sqm-l.area_sqm)>greatest(5,l.area_sqm*0.15) or abs(ls.rooms-l.rooms)>1)>0`);
  await db.query("rollback");
  const directory = join(storageRoot, "audits");
  await mkdir(directory, { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    mismatchedIds,
    suspiciousGroups: groups.rows,
    suspiciousHistory: history.rows,
  };
  await writeFile(join(directory, "listing-integrity.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      checkedOtodom: identity.rowCount,
      mismatchedIds: mismatchedIds.length,
      suspiciousGroups: groups.rowCount,
      suspiciousHistory: history.rowCount,
      report: "storage/audits/listing-integrity.json",
      changedListings: 0,
    }),
  );
} finally {
  db.release();
  await pool.end();
}
