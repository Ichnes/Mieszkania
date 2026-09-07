import "../config";
import { pool } from "../db";

type PriceAuditRow = {
  source_key: string;
  status: string;
  total: string;
  missing: string;
};

function summarize(rows: PriceAuditRow[]) {
  const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
  const missing = rows.reduce((sum, row) => sum + Number(row.missing), 0);
  return {
    total,
    missing,
    percent: total > 0 ? Number((missing / total * 100).toFixed(2)) : 0,
    bySource: Object.fromEntries(Object.entries(rows.reduce<Record<string, { total: number; missing: number }>>((result, row) => {
      const current = result[row.source_key] ?? { total: 0, missing: 0 };
      current.total += Number(row.total);
      current.missing += Number(row.missing);
      result[row.source_key] = current;
      return result;
    }, {})).map(([source, values]) => [source, {
      ...values,
      percent: values.total > 0 ? Number((values.missing / values.total * 100).toFixed(2)) : 0
    }])),
    byStatus: Object.fromEntries(Object.entries(rows.reduce<Record<string, { total: number; missing: number }>>((result, row) => {
      const current = result[row.status] ?? { total: 0, missing: 0 };
      current.total += Number(row.total);
      current.missing += Number(row.missing);
      result[row.status] = current;
      return result;
    }, {})).map(([status, values]) => [status, {
      ...values,
      percent: values.total > 0 ? Number((values.missing / values.total * 100).toFixed(2)) : 0
    }]))
  };
}

async function readAudit(where: string) {
  const result = await pool.query<PriceAuditRow>(`
    select
      s.key as source_key,
      l.status::text as status,
      count(*)::text as total,
      count(*) filter (where l.price_amount is null or l.price_amount <= 0)::text as missing
    from listings l
    join sources s on s.id = l.source_id
    where ${where}
    group by s.key, l.status
    order by count(*) filter (where l.price_amount is null or l.price_amount <= 0) desc, s.key, l.status
  `);
  return summarize(result.rows);
}

async function main() {
  const [allListings, activeListings, recentWarsaw, recentMissingSamples] = await Promise.all([
    readAudit("true"),
    readAudit("l.status = 'active' and l.hidden_duplicate_of_id is null"),
    readAudit(`
      l.status = 'active'
      and l.hidden_duplicate_of_id is null
      and lower(l.city) = 'warszawa'
      and l.first_seen_at >= now() - interval '30 days'
    `),
    pool.query<{
      source_key: string;
      external_id: string;
      title: string;
      canonical_url: string;
      first_seen_at: string;
      area_sqm: string | null;
      rooms: number | null;
    }>(`
      select
        s.key as source_key,
        l.external_id,
        l.title,
        l.canonical_url,
        l.first_seen_at::text,
        l.area_sqm::text,
        l.rooms
      from listings l
      join sources s on s.id = l.source_id
      where l.status = 'active'
        and l.hidden_duplicate_of_id is null
        and lower(l.city) = 'warszawa'
        and l.first_seen_at >= now() - interval '30 days'
        and (l.price_amount is null or l.price_amount <= 0)
      order by l.first_seen_at desc
      limit 12
    `)
  ]);

  console.log(JSON.stringify({ allListings, activeListings, recentWarsaw, recentMissingSamples: recentMissingSamples.rows }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
