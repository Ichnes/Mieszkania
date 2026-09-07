import { opendir, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { mediaCacheRoot, storageRoot } from "../config";

type FileEntry = {
  path: string;
  relativePath: string;
  bytes: number;
  device: number;
  inode: number;
};

if (process.argv.includes("--apply")) {
  throw new Error("Ten skrypt jest celowo tylko raportem (dry-run) i nie usuwa ani nie przenosi plikow.");
}

const offersRoot = resolve(storageRoot, "offers");
const [offerFiles, mediaFiles] = await Promise.all([
  collectFiles(offersRoot),
  collectFiles(mediaCacheRoot)
]);

const legacyHtml = offerFiles.filter((file) => file.relativePath.endsWith(`${sep}raw.html`) || file.relativePath === "raw.html");
const legacyJson = offerFiles.filter((file) => file.relativePath.endsWith(`${sep}parsed.json`) || file.relativePath === "parsed.json");
const legacyCompressedHtml = offerFiles.filter((file) => file.relativePath.endsWith(`${sep}raw.html.gz`) || file.relativePath === "raw.html.gz");
const legacyCompressedJson = offerFiles.filter((file) => file.relativePath.endsWith(`${sep}parsed.json.gz`) || file.relativePath === "parsed.json.gz");
const compressedObjects = offerFiles.filter((file) => file.relativePath.startsWith(`objects${sep}`));
const manifests = offerFiles.filter((file) => file.relativePath.startsWith(`manifests${sep}`));
const legacySources = summarizeLegacySources([...legacyHtml, ...legacyJson, ...legacyCompressedHtml, ...legacyCompressedJson]);
const mediaDuplicates = summarizeDuplicateMediaExtensions(mediaFiles);

const report = {
  mode: "dry-run",
  generatedAt: new Date().toISOString(),
  note: "Nie zmieniono zadnego pliku. Oferty ukryte i archiwalne pozostaja zachowane.",
  offers: {
    total: summarize(offerFiles),
    legacyHtml: summarize(legacyHtml),
    legacyParsedJson: summarize(legacyJson),
    migratedHtmlGzip: summarize(legacyCompressedHtml),
    migratedParsedJsonGzip: summarize(legacyCompressedJson),
    compressedObjects: summarize(compressedObjects),
    manifests: summarize(manifests),
    legacyVersions: Math.min(
      legacyHtml.length + legacyCompressedHtml.length,
      legacyJson.length + legacyCompressedJson.length
    ),
    legacyBySource: legacySources
  },
  media: {
    total: summarize(mediaFiles),
    duplicateExtensionGroups: mediaDuplicates.groups,
    duplicateExtensionFiles: mediaDuplicates.files,
    potentiallyRedundantBytes: mediaDuplicates.redundantBytes,
    potentiallyRedundantSize: formatBytes(mediaDuplicates.redundantBytes)
  },
  nextSafeStep: "Migrator storage:migrate kompresuje po jednym pliku i usuwa oryginal dopiero po kontrolnym gunzip oraz porownaniu SHA-256."
};

console.log(JSON.stringify(report, null, 2));

async function collectFiles(root: string) {
  const files: FileEntry[] = [];
  try {
    await walk(root, root, files);
  } catch (error) {
    if (!isMissingPath(error)) throw error;
  }
  return files;
}

async function walk(root: string, directory: string, files: FileEntry[]) {
  const entries = await opendir(directory);
  for await (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(root, path, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const details = await stat(path);
    files.push({
      path,
      relativePath: relative(root, path),
      bytes: details.size,
      device: details.dev,
      inode: details.ino
    });
  }
}

function summarize(files: FileEntry[]) {
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  const uniqueFiles = new Map<string, FileEntry>();
  for (const file of files) {
    uniqueFiles.set(`${file.device}:${file.inode}`, file);
  }
  const physicalBytes = [...uniqueFiles.values()].reduce((total, file) => total + file.bytes, 0);
  return {
    files: files.length,
    bytes,
    size: formatBytes(bytes),
    physicalFiles: uniqueFiles.size,
    physicalBytes,
    physicalSize: formatBytes(physicalBytes),
    hardlinkSavingsBytes: bytes - physicalBytes,
    hardlinkSavingsSize: formatBytes(bytes - physicalBytes)
  };
}

function summarizeLegacySources(files: FileEntry[]) {
  const sources = new Map<string, { files: number; bytes: number }>();
  for (const file of files) {
    const source = file.relativePath.split(sep)[0] || "unknown";
    const current = sources.get(source) ?? { files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += file.bytes;
    sources.set(source, current);
  }
  return [...sources.entries()]
    .map(([source, value]) => ({ source, ...value, size: formatBytes(value.bytes) }))
    .sort((left, right) => right.bytes - left.bytes);
}

function summarizeDuplicateMediaExtensions(files: FileEntry[]) {
  const groups = new Map<string, FileEntry[]>();
  for (const file of files) {
    const extension = extname(file.relativePath);
    const key = extension ? file.relativePath.slice(0, -extension.length) : file.relativePath;
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }

  let duplicateGroups = 0;
  let duplicateFiles = 0;
  let redundantBytes = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    duplicateGroups += 1;
    duplicateFiles += group.length - 1;
    const bytes = group.map((file) => file.bytes).sort((left, right) => right - left);
    redundantBytes += bytes.slice(1).reduce((total, size) => total + size, 0);
  }
  return { groups: duplicateGroups, files: duplicateFiles, redundantBytes };
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function isMissingPath(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
