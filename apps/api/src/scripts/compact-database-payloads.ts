import { appendFile, mkdir, readdir } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import "../config";
import { pool } from "../db";
import { projectRoot, storageRoot } from "../config";
import { resolveArchivedFile } from "../services/archived-file-reader";

type CandidateRow = {
  id: string;
  storage_key: string;
  before_bytes: number;
  reclaimable_bytes: number;
  source_key: string;
  external_id: string;
  captured_at: Date;
};

const HTML_KEYS = ["html", "primaryHtml", "rawHtml", "pageHtml"];
const apply = process.argv.includes("--apply");
const limit = parseLimit(process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1]);
const logPath = resolve(storageRoot, "logs", "database-payload-compaction.ndjson");

try {
  const [artifactCandidates, snapshotCandidates] = await Promise.all([
    loadArtifactCandidates(limit),
    loadSnapshotCandidates(limit)
  ]);
  const [artifacts, snapshots] = await Promise.all([
    verifyCandidates(artifactCandidates),
    verifyCandidates(snapshotCandidates)
  ]);

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      crawlArtifacts: summarize(artifactCandidates, artifacts),
      listingSnapshots: summarize(snapshotCandidates, snapshots),
      missingArchiveExamples: [...artifacts.missing, ...snapshots.missing]
        .slice(0, 5)
        .map((candidate) => candidate.storage_key),
      note: "Nie zmieniono bazy. Do trybu --apply kwalifikują się tylko rekordy z istniejącym plikiem archiwum."
    }, null, 2));
    process.exit(0);
  }

  await mkdir(resolve(storageRoot, "logs"), { recursive: true });
  const artifactResult = await compactTable("crawl_artifacts", artifacts.verified);
  const snapshotResult = await compactTable("listing_snapshots", snapshots.verified);
  const report = {
    mode: "apply",
    crawlArtifacts: { ...summarize(artifactCandidates, artifacts), updated: artifactResult.updated },
    listingSnapshots: { ...summarize(snapshotCandidates, snapshots), updated: snapshotResult.updated },
    logicalBytesRemoved: artifactResult.logicalBytesRemoved + snapshotResult.logicalBytesRemoved,
    logicalSizeRemoved: formatBytes(artifactResult.logicalBytesRemoved + snapshotResult.logicalBytesRemoved),
    logPath,
    nextStep: "VACUUM FULL odzyskuje miejsce dla systemu plików, ale wymaga wyłącznego locka i należy uruchomić go osobno w oknie serwisowym."
  };
  await appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...report })}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.end();
}

async function loadArtifactCandidates(rowLimit: number | null) {
  const result = await pool.query<CandidateRow>(`
    select id, storage_key, source_key, external_id, captured_at,
      pg_column_size(payload_raw)::int as before_bytes,
      greatest(pg_column_size(payload_raw) - pg_column_size(payload_raw - $1::text[]), 0)::int as reclaimable_bytes
    from (
      select ca.id, ca.storage_key, ca.payload_raw, ca.captured_at, s.key as source_key, l.external_id
      from crawl_artifacts ca
      join sources s on s.id = ca.source_id
      join listings l on l.id = ca.listing_id
      where ca.payload_raw ?| $1::text[]
      ${rowLimit === null ? "" : "limit $2"}
    ) candidates
  `, rowLimit === null ? [HTML_KEYS] : [HTML_KEYS, rowLimit]);
  return result.rows;
}

async function loadSnapshotCandidates(rowLimit: number | null) {
  const result = await pool.query<CandidateRow>(`
    select candidates.id, nearest.storage_key, candidates.source_key, candidates.external_id, candidates.captured_at,
      pg_column_size(candidates.payload_raw)::int as before_bytes,
      greatest(pg_column_size(candidates.payload_raw) - pg_column_size(candidates.payload_raw - $1::text[]), 0)::int as reclaimable_bytes
    from (
      select ls.id, ls.listing_id, ls.captured_at, ls.payload_raw, s.key as source_key, l.external_id
      from listing_snapshots ls
      join listings l on l.id = ls.listing_id
      join sources s on s.id = l.source_id
      where ls.payload_raw ?| $1::text[]
      ${rowLimit === null ? "" : "limit $2"}
    ) candidates
    join lateral (
      select ca.storage_key
      from crawl_artifacts ca
      where ca.listing_id = candidates.listing_id and ca.artifact_type = 'html'
      order by abs(extract(epoch from (ca.captured_at - candidates.captured_at))), ca.id
      limit 1
    ) nearest on true
  `, rowLimit === null ? [HTML_KEYS] : [HTML_KEYS, rowLimit]);
  return result.rows;
}

async function verifyCandidates(candidates: CandidateRow[]) {
  const verified: CandidateRow[] = [];
  const missing: CandidateRow[] = [];
  for (let index = 0; index < candidates.length; index += 64) {
    const batch = candidates.slice(index, index + 64);
    const results = await Promise.all(batch.map(async (candidate) => ({
      candidate,
      archivedPath: await findArchivedHtml(candidate)
    })));
    for (const result of results) {
      (result.archivedPath ? verified : missing).push(result.candidate);
    }
  }
  return { verified, missing };
}

function toArchivePath(storageKey: string) {
  const normalized = storageKey.replaceAll("/", sep);
  const absolute = isAbsolute(normalized)
    ? resolve(normalized)
    : normalized.startsWith(`storage${sep}`)
      ? resolve(projectRoot, normalized)
      : resolve(storageRoot, normalized);
  const allowedRoot = resolve(storageRoot);
  if (absolute !== allowedRoot && !absolute.startsWith(`${allowedRoot}${sep}`)) {
    throw new Error(`Archiwum poza katalogiem storage: ${storageKey}`);
  }
  return absolute;
}

async function findArchivedHtml(candidate: CandidateRow) {
  const direct = await resolveArchivedFile(toArchivePath(candidate.storage_key));
  if (direct) return direct;

  const listingDirectory = resolve(
    storageRoot,
    "offers",
    safeSegment(candidate.source_key),
    safeSegment(candidate.external_id)
  );
  let entries;
  try {
    entries = await readdir(listingDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }

  const storageTimestamp = candidate.storage_key.match(/(\d{13})(?=\.[^.]+$)/)?.[1];
  const expectedAt = storageTimestamp ? Number(storageTimestamp) : candidate.captured_at.getTime();
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, time: archiveDirectoryTime(entry.name) }))
    .filter((entry): entry is { name: string; time: number } => entry.time !== null)
    .sort((left, right) => Math.abs(left.time - expectedAt) - Math.abs(right.time - expectedAt));
  const nearest = matches[0];
  if (!nearest || Math.abs(nearest.time - expectedAt) > 120_000) return null;
  return resolveArchivedFile(resolve(listingDirectory, nearest.name, "raw.html"));
}

function archiveDirectoryTime(name: string) {
  const normalized = name.replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_") || "unknown";
}

async function compactTable(table: "crawl_artifacts" | "listing_snapshots", candidates: CandidateRow[]) {
  let updated = 0;
  let logicalBytesRemoved = 0;
  for (let index = 0; index < candidates.length; index += 250) {
    const batch = candidates.slice(index, index + 250);
    const result = await pool.query(`
      update ${table}
      set payload_raw = payload_raw - $1::text[]
      where id = any($2::uuid[]) and payload_raw ?| $1::text[]
    `, [HTML_KEYS, batch.map((candidate) => candidate.id)]);
    updated += result.rowCount ?? 0;
    logicalBytesRemoved += batch.reduce((total, candidate) => total + candidate.reclaimable_bytes, 0);
  }
  return { updated, logicalBytesRemoved };
}

function summarize(all: CandidateRow[], result: { verified: CandidateRow[]; missing: CandidateRow[] }) {
  const reclaimableBytes = result.verified.reduce((total, candidate) => total + candidate.reclaimable_bytes, 0);
  return {
    candidates: all.length,
    verifiedArchive: result.verified.length,
    skippedMissingArchive: result.missing.length,
    reclaimableBytes,
    reclaimableSize: formatBytes(reclaimableBytes)
  };
}

function parseLimit(value?: string) {
  if (value === undefined) return null;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Nieprawidłowa wartość --limit.");
  return parsed;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}
