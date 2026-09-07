import "../../config";
import { pool } from "../../db";

const relations = [
  "crawl_artifacts",
  "listing_snapshots",
  "listing_media_assets",
  "listing_images",
  "listing_import_queue",
  "listings",
  "listing_parcel_context",
  "listing_neighborhood_context",
  "listing_planning_context",
];

try {
  const sizes = await pool.query<{
    relation: string;
    total_bytes: string;
    table_bytes: string;
    indexes_bytes: string;
  }>(
    `
    select
      relation,
      pg_total_relation_size(to_regclass(relation))::text as total_bytes,
      pg_relation_size(to_regclass(relation))::text as table_bytes,
      pg_indexes_size(to_regclass(relation))::text as indexes_bytes
    from unnest($1::text[]) relation
    where to_regclass(relation) is not null
    order by pg_total_relation_size(to_regclass(relation)) desc
  `,
    [relations],
  );

  const payloads = await pool.query<{
    relation: string;
    rows: string;
    payload_bytes: string;
    rows_with_top_level_html: string;
  }>(`
    select 'crawl_artifacts' as relation,
      count(*)::text as rows,
      coalesce(sum(pg_column_size(payload_raw)), 0)::text as payload_bytes,
      count(*) filter (where payload_raw ?| array['html', 'primaryHtml', 'rawHtml', 'pageHtml'])::text as rows_with_top_level_html
    from crawl_artifacts
    union all
    select 'listing_snapshots',
      count(*)::text,
      coalesce(sum(pg_column_size(payload_raw)), 0)::text,
      count(*) filter (where payload_raw ?| array['html', 'primaryHtml', 'rawHtml', 'pageHtml'])::text
    from listing_snapshots
    union all
    select 'listing_import_queue',
      count(*)::text,
      coalesce(sum(pg_column_size(payload_raw)), 0)::text,
      count(*) filter (where payload_raw ?| array['html', 'primaryHtml', 'rawHtml', 'pageHtml'])::text
    from listing_import_queue
  `);

  const artifactsByType = await pool.query<{
    artifact_type: string;
    rows: string;
    payload_bytes: string;
    rows_with_top_level_html: string;
  }>(`
    select artifact_type::text,
      count(*)::text as rows,
      coalesce(sum(pg_column_size(payload_raw)), 0)::text as payload_bytes,
      count(*) filter (where payload_raw ?| array['html', 'primaryHtml', 'rawHtml', 'pageHtml'])::text as rows_with_top_level_html
    from crawl_artifacts
    group by artifact_type
    order by sum(pg_column_size(payload_raw)) desc
  `);

  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        generatedAt: new Date().toISOString(),
        relations: sizes.rows.map((row) => ({
          relation: row.relation,
          totalBytes: Number(row.total_bytes),
          totalSize: formatBytes(Number(row.total_bytes)),
          tableSize: formatBytes(Number(row.table_bytes)),
          indexesSize: formatBytes(Number(row.indexes_bytes)),
        })),
        jsonPayloads: payloads.rows.map((row) => ({
          relation: row.relation,
          rows: Number(row.rows),
          payloadBytes: Number(row.payload_bytes),
          payloadSize: formatBytes(Number(row.payload_bytes)),
          rowsWithTopLevelHtml: Number(row.rows_with_top_level_html),
        })),
        crawlArtifactsByType: artifactsByType.rows.map((row) => ({
          artifactType: row.artifact_type,
          rows: Number(row.rows),
          payloadSize: formatBytes(Number(row.payload_bytes)),
          rowsWithTopLevelHtml: Number(row.rows_with_top_level_html),
        })),
        note: "Raport nie zmienia bazy danych. Rozmiar total obejmuje tabelę, TOAST i indeksy.",
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}
