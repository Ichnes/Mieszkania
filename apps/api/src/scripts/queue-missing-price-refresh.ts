import "../config";
import { pool } from "../db";
import { enqueueListingImports } from "../services/listing-import-queue";

type Candidate = {
  source_key: string;
  external_id: string;
  canonical_url: string;
  city: string;
};

async function main() {
  const candidates = await pool.query<Candidate>(`
    select s.key as source_key, l.external_id, l.canonical_url, l.city
    from listings l
    join sources s on s.id = l.source_id
    where l.status = 'active'
      and l.hidden_duplicate_of_id is null
      and lower(l.city) = 'warszawa'
      and l.first_seen_at >= now() - interval '30 days'
      and (l.price_amount is null or l.price_amount <= 0)
    order by s.key, l.last_seen_at desc
  `);

  const bySource = new Map<string, Candidate[]>();
  for (const row of candidates.rows) {
    bySource.set(row.source_key, [...(bySource.get(row.source_key) ?? []), row]);
  }

  const queuedBySource: Record<string, number> = {};
  for (const [sourceKey, rows] of bySource) {
    const forceRefreshExternalIds = new Set(rows.map((row) => row.external_id));
    const result = await enqueueListingImports({
      sourceKey,
      city: rows[0]?.city ?? "Warszawa",
      priority: 130,
      forceRefreshExternalIds,
      items: rows.map((row) => ({ externalId: row.external_id, url: row.canonical_url }))
    });
    queuedBySource[sourceKey] = result.queued;
  }

  console.log(JSON.stringify({ candidates: candidates.rowCount, queuedBySource }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
