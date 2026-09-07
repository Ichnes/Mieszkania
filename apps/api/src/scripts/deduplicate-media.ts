import { createHash, randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { appendFile, link, mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { mediaCacheRoot, storageRoot } from "../config";
import { pool } from "../db";
import { findMediaFilePaths } from "../services/image-repository";

type AssetRow = {
  id: string;
  storage_key: string;
  content_hash: string;
  file_size_bytes: number | null;
};

const apply = process.argv.includes("--apply");
const limitGroups = parseLimit(process.argv.find((argument) => argument.startsWith("--limit-groups="))?.split("=")[1]);
const logPath = resolve(storageRoot, "logs", "media-deduplication.ndjson");

try {
  const result = await pool.query<AssetRow>(`
    select id, storage_key, content_hash, file_size_bytes
    from listing_media_assets
    where download_status = 'downloaded' and content_hash is not null and content_hash <> ''
    order by content_hash, created_at, id
  `);
  const groups = groupExistingFiles(result.rows)
    .filter((group) => group.paths.length > 1)
    .slice(0, limitGroups ?? undefined);
  const candidates = groups.reduce((total, group) => total + group.paths.length - 1, 0);
  const remainingCandidates = groups.reduce(
    (total, group) => total + group.paths.slice(1).filter((item) => !isSameFile(group.paths[0], item)).length,
    0
  );
  const estimatedBytes = groups.reduce(
    (total, group) => total + group.paths.slice(1)
      .filter((item) => !isSameFile(group.paths[0], item))
      .reduce((sum, item) => sum + (item.bytes ?? 0), 0),
    0
  );

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      duplicateHashGroups: groups.length,
      duplicateFiles: candidates,
      alreadyHardlinkedFiles: candidates - remainingCandidates,
      remainingFilesToHardlink: remainingCandidates,
      potentiallyReclaimableBytes: estimatedBytes,
      potentiallyReclaimableSize: formatBytes(estimatedBytes),
      note: "Nie zmieniono plikow. Tryb --apply zastepuje tylko identyczne bajtowo kopie twardymi dowiazaniami."
    }, null, 2));
    process.exit(0);
  }

  await mkdir(dirname(logPath), { recursive: true });
  let linked = 0;
  let alreadyLinked = 0;
  let failed = 0;
  let reclaimedBytes = 0;

  for (const group of groups) {
    const canonical = group.paths[0];
    try {
      await assertFileHash(canonical.path, group.hash);
    } catch (error) {
      failed += group.paths.length - 1;
      await appendLog({ status: "canonical_failed", hash: group.hash, path: canonical.path, error: errorMessage(error) });
      continue;
    }

    for (const duplicate of group.paths.slice(1)) {
      try {
        await assertFileHash(duplicate.path, group.hash);
        const outcome = await replaceWithHardLink(canonical.path, duplicate.path);
        if (outcome === "already_linked") {
          alreadyLinked += 1;
        } else {
          linked += 1;
          reclaimedBytes += duplicate.bytes ?? 0;
        }
        await appendLog({ status: outcome, hash: group.hash, canonicalPath: canonical.path, duplicatePath: duplicate.path });
      } catch (error) {
        failed += 1;
        await appendLog({ status: "failed", hash: group.hash, canonicalPath: canonical.path, duplicatePath: duplicate.path, error: errorMessage(error) });
      }
    }
  }

  console.log(JSON.stringify({
    mode: "apply",
    duplicateHashGroups: groups.length,
    candidates,
    linked,
    alreadyLinked,
    failed,
    reclaimedBytes,
    reclaimedSize: formatBytes(reclaimedBytes),
    logPath
  }, null, 2));
  if (failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}

function groupExistingFiles(rows: AssetRow[]) {
  const byHash = new Map<string, Map<string, { path: string; bytes: number | null; device: bigint; inode: bigint }>>();
  for (const row of rows) {
    const matchingPaths = findMediaFilePaths(row.storage_key);
    const path = matchingPaths.find((candidate) => row.file_size_bytes !== null && statSync(candidate).size === row.file_size_bytes)
      ?? matchingPaths[0];
    if (!path) continue;
    assertInsideMediaCache(path);
    const paths = byHash.get(row.content_hash) ?? new Map();
    if (!paths.has(path)) {
      const details = statSync(path, { bigint: true });
      paths.set(path, { path, bytes: row.file_size_bytes, device: details.dev, inode: details.ino });
    }
    byHash.set(row.content_hash, paths);
  }
  return [...byHash.entries()].map(([hash, paths]) => ({ hash, paths: [...paths.values()] }));
}

function isSameFile(
  left: { device: bigint; inode: bigint },
  right: { device: bigint; inode: bigint }
) {
  return left.device === right.device && left.inode === right.inode;
}

async function replaceWithHardLink(canonicalPath: string, duplicatePath: string) {
  const [canonicalStat, duplicateStat] = await Promise.all([stat(canonicalPath), stat(duplicatePath)]);
  if (canonicalStat.dev === duplicateStat.dev && canonicalStat.ino === duplicateStat.ino) return "already_linked" as const;

  const token = randomUUID();
  const temporaryPath = `${duplicatePath}.${token}.link-tmp`;
  const backupPath = `${duplicatePath}.${token}.backup-tmp`;
  let backupCreated = false;
  let replacementCreated = false;

  try {
    await link(canonicalPath, temporaryPath);
    await rename(duplicatePath, backupPath);
    backupCreated = true;
    await rename(temporaryPath, duplicatePath);
    replacementCreated = true;
    const [nextCanonicalStat, nextDuplicateStat] = await Promise.all([stat(canonicalPath), stat(duplicatePath)]);
    if (nextCanonicalStat.dev !== nextDuplicateStat.dev || nextCanonicalStat.ino !== nextDuplicateStat.ino) {
      throw new Error("HARDLINK_VERIFICATION_FAILED");
    }
    await unlink(backupPath);
    return "linked" as const;
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    if (replacementCreated) await unlink(duplicatePath).catch(() => undefined);
    if (backupCreated) await rename(backupPath, duplicatePath).catch(() => undefined);
    throw error;
  }
}

async function assertFileHash(path: string, expected: string) {
  const actual = createHash("sha256").update(await readFile(path)).digest("hex");
  if (actual !== expected) throw new Error(`CONTENT_HASH_MISMATCH: ${actual}`);
}

function assertInsideMediaCache(path: string) {
  const root = resolve(mediaCacheRoot) + sep;
  const absolute = resolve(path);
  if (!absolute.startsWith(root)) throw new Error(`Sciezka poza media-cache: ${relative(storageRoot, absolute)}`);
}

function parseLimit(value?: string) {
  if (value === undefined) return null;
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 0) throw new Error("Nieprawidlowa wartosc --limit-groups.");
  return number;
}

async function appendLog(entry: Record<string, unknown>) {
  await appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}
