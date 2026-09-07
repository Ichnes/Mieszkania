import "../config";
import { pool } from "../db";
import { inferConstructionYear, inferStructuredConstructionYear } from "../services/listing-description-facts";

type CandidateRow = {
  id: string;
  source_key: string;
  title: string;
  description: string | null;
  snapshot_payload: unknown;
};

type DuplicateCandidateRow = {
  id: string;
  source_key: string;
  year_built: number;
};

const apply = process.argv.includes("--apply");

async function main() {
  const candidates = await pool.query<CandidateRow>(`
    select
      l.id,
      s.key as source_key,
      l.title,
      l.description,
      snapshot.payload_raw as snapshot_payload
    from listings l
    join sources s on s.id = l.source_id
    left join lateral (
      select ls.payload_raw
      from listing_snapshots ls
      where ls.listing_id = l.id
      order by ls.captured_at desc
      limit 1
    ) snapshot on true
    where l.year_built is null
  `);

  const inferred = candidates.rows.flatMap((row) => {
    const description = row.source_key === "domiporta" ? row.description?.slice(0, 5_000) : row.description;
    const yearBuilt = inferStructuredConstructionYear(row.snapshot_payload)
      ?? inferConstructionYear([row.title, description].filter(Boolean).join("\n"));
    return yearBuilt ? [{ ...row, yearBuilt }] : [];
  });
  const bySource = Object.entries(inferred.reduce<Record<string, number>>((result, row) => {
    result[row.source_key] = (result[row.source_key] ?? 0) + 1;
    return result;
  }, {})).sort((left, right) => right[1] - left[1]);

  let updated = 0;
  if (apply) {
    for (let offset = 0; offset < inferred.length; offset += 500) {
      const batch = inferred.slice(offset, offset + 500);
      const result = await pool.query(`
        update listings as l
        set year_built = values.year_built
        from unnest($1::uuid[], $2::int[]) as values(id, year_built)
        where l.id = values.id
          and l.year_built is null
      `, [batch.map((row) => row.id), batch.map((row) => row.yearBuilt)]);
      updated += result.rowCount ?? 0;
    }
  }

  const duplicateCandidates = await pool.query<DuplicateCandidateRow>(`
    with group_years as (
      select
        gm.group_id,
        min(l.year_built)::int as year_built,
        count(distinct l.year_built) as known_years
      from listing_duplicate_group_members gm
      join listings l on l.id = gm.listing_id
      where l.year_built is not null
      group by gm.group_id
    )
    select l.id, s.key as source_key, gy.year_built
    from listing_duplicate_group_members gm
    join group_years gy on gy.group_id = gm.group_id and gy.known_years = 1
    join listings l on l.id = gm.listing_id and l.year_built is null
    join sources s on s.id = l.source_id
  `);
  let inheritedFromDuplicate = 0;
  if (apply) {
    for (let offset = 0; offset < duplicateCandidates.rows.length; offset += 500) {
      const batch = duplicateCandidates.rows.slice(offset, offset + 500);
      const result = await pool.query(`
        update listings as l
        set year_built = values.year_built
        from unnest($1::uuid[], $2::int[]) as values(id, year_built)
        where l.id = values.id and l.year_built is null
      `, [batch.map((row) => row.id), batch.map((row) => row.year_built)]);
      inheritedFromDuplicate += result.rowCount ?? 0;
    }
  }
  const inheritedBySource = duplicateCandidates.rows.reduce<Record<string, number>>((result, row) => {
    result[row.source_key] = (result[row.source_key] ?? 0) + 1;
    return result;
  }, {});

  const recent = await pool.query<{ source_key: string; missing: string }>(`
    select s.key as source_key, count(*)::text as missing
    from listings l
    join sources s on s.id = l.source_id
    where lower(l.city) = 'warszawa'
      and l.hidden_duplicate_of_id is null
      and l.first_seen_at >= now() - interval '30 days'
      and l.year_built is null
    group by s.key
    order by count(*) desc, s.key asc
  `);
  const recentMissingTotal = recent.rows.reduce((total, row) => total + Number(row.missing), 0);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    missingBefore: candidates.rowCount,
    inferred: inferred.length,
    updated,
    inferredBySource: Object.fromEntries(bySource),
    duplicateCandidates: duplicateCandidates.rowCount,
    inheritedFromDuplicate,
    inheritedBySource,
    missingInWarsawLast30DaysAfterRun: recentMissingTotal,
    missingInWarsawLast30DaysBySource: Object.fromEntries(recent.rows.map((row) => [row.source_key, {
      count: Number(row.missing),
      percent: recentMissingTotal > 0 ? Number((Number(row.missing) / recentMissingTotal * 100).toFixed(1)) : 0
    }]))
  }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
