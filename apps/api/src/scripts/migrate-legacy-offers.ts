import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, opendir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { storageRoot } from "../config";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const offersRoot = resolve(storageRoot, "offers");
const logPath = resolve(storageRoot, "logs", "storage-migration.ndjson");

const options = parseOptions(process.argv.slice(2));
const scanRoot = options.source ? resolve(offersRoot, options.source) : offersRoot;
assertSafeScanRoot(scanRoot, options.source);

const candidates = await collectCandidates(scanRoot, options.limit);
const sourceBytes = candidates.reduce((total, candidate) => total + candidate.bytes, 0);

if (!options.apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    source: options.source ?? "all",
    candidates: candidates.length,
    bytes: sourceBytes,
    size: formatBytes(sourceBytes),
    concurrency: options.concurrency,
    note: "Nie zmieniono zadnego pliku. Uzyj --apply dopiero do zweryfikowanej migracji."
  }, null, 2));
  process.exit(0);
}

await mkdir(dirname(logPath), { recursive: true });
let migrated = 0;
let recoveredExisting = 0;
let failed = 0;
let originalBytes = 0;
let compressedBytes = 0;

await runPool(candidates, options.concurrency, async (candidate) => {
  try {
    const result = await migrateOne(candidate.path);
    migrated += 1;
    if (result.reusedExisting) recoveredExisting += 1;
    originalBytes += result.originalBytes;
    compressedBytes += result.compressedBytes;
    await appendLog({ status: "migrated", path: candidate.path, ...result });
    if (migrated % 500 === 0) {
      console.error(`Zweryfikowano i skompresowano ${migrated}/${candidates.length} plikow.`);
    }
  } catch (error) {
    failed += 1;
    await appendLog({ status: "failed", path: candidate.path, error: errorMessage(error) });
    console.error(`Blad migracji ${candidate.path}: ${errorMessage(error)}`);
  }
});

const reclaimedBytes = originalBytes - compressedBytes;
console.log(JSON.stringify({
  mode: "apply",
  source: options.source ?? "all",
  candidates: candidates.length,
  migrated,
  reusedAlreadyVerifiedArchives: recoveredExisting,
  failed,
  originalBytes,
  originalSize: formatBytes(originalBytes),
  compressedBytes,
  compressedSize: formatBytes(compressedBytes),
  reclaimedBytes,
  reclaimedSize: formatBytes(reclaimedBytes),
  logPath
}, null, 2));

if (failed > 0) process.exitCode = 1;

async function migrateOne(originalPath: string) {
  const compressedPath = `${originalPath}.gz`;
  const original = await readFile(originalPath);
  const originalChecksum = sha256(original);
  let compressed: Buffer;
  let reusedExisting = false;

  try {
    compressed = await readFile(compressedPath);
    await verifyCompressed(compressed, originalChecksum);
    reusedExisting = true;
  } catch (error) {
    if (!isMissingPath(error)) throw error;
    compressed = await gzipAsync(original, { level: 6 });
    await verifyCompressed(compressed, originalChecksum);
    const temporaryPath = `${compressedPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, compressed, { flag: "wx" });
      const written = await readFile(temporaryPath);
      await verifyCompressed(written, originalChecksum);
      await rename(temporaryPath, compressedPath);
    } catch (writeError) {
      await unlink(temporaryPath).catch(() => undefined);
      throw writeError;
    }
  }

  // This is the only removal in the migrator. It happens after a disk read-back,
  // gunzip and SHA-256 comparison have all succeeded.
  await unlink(originalPath);
  return {
    originalBytes: original.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: originalChecksum,
    compressedPath,
    reusedExisting
  };
}

async function verifyCompressed(compressed: Buffer, expectedChecksum: string) {
  const restored = await gunzipAsync(compressed);
  const restoredChecksum = sha256(restored);
  if (restoredChecksum !== expectedChecksum) {
    throw new Error(`CHECKSUM_MISMATCH: oczekiwano ${expectedChecksum}, otrzymano ${restoredChecksum}`);
  }
}

async function collectCandidates(root: string, limit: number | null) {
  const files: Array<{ path: string; bytes: number }> = [];
  await walk(root, files, limit);
  return files;
}

async function walk(directory: string, files: Array<{ path: string; bytes: number }>, limit: number | null) {
  if (limit !== null && files.length >= limit) return;
  let entries;
  try {
    entries = await opendir(directory);
  } catch (error) {
    if (isMissingPath(error)) return;
    throw error;
  }
  for await (const entry of entries) {
    if (limit !== null && files.length >= limit) break;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const relativePath = relative(offersRoot, path);
      if (relativePath === "objects" || relativePath === "manifests") continue;
      await walk(path, files, limit);
    } else if (entry.isFile() && (entry.name === "raw.html" || entry.name === "parsed.json")) {
      files.push({ path, bytes: (await stat(path)).size });
    }
  }
}

async function runPool<T>(items: T[], concurrency: number, action: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await action(item);
    }
  }));
}

function parseOptions(args: string[]) {
  const source = readArgument(args, "source");
  if (source && !/^[a-z0-9_-]+$/i.test(source)) throw new Error("Nieprawidlowa wartosc --source.");
  const limitValue = readArgument(args, "limit");
  const concurrencyValue = readArgument(args, "concurrency");
  const limit = limitValue === undefined ? null : Math.max(0, Math.floor(Number(limitValue)));
  const concurrency = concurrencyValue === undefined ? 4 : Math.max(1, Math.min(12, Math.floor(Number(concurrencyValue))));
  if (limit !== null && !Number.isFinite(limit)) throw new Error("Nieprawidlowa wartosc --limit.");
  if (!Number.isFinite(concurrency)) throw new Error("Nieprawidlowa wartosc --concurrency.");
  return { apply: args.includes("--apply"), source, limit, concurrency };
}

function readArgument(args: string[], name: string) {
  const prefix = `--${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function assertSafeScanRoot(root: string, source?: string) {
  const normalizedOffersRoot = offersRoot + sep;
  if (root !== offersRoot && !root.startsWith(normalizedOffersRoot)) throw new Error("Sciezka migracji wychodzi poza storage/offers.");
  if (source && resolve(root) === resolve(offersRoot)) throw new Error("Nieprawidlowe zrodlo migracji.");
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function appendLog(entry: Record<string, unknown>) {
  await appendFile(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

function isMissingPath(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
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
