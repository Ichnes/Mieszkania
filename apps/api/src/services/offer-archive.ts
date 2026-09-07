import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { storageRoot } from "../config";

const gzipAsync = promisify(gzip);

type ArchiveManifest = {
  version: 1;
  sourceKey: string;
  externalId: string;
  listingChecksum: string;
  capturedAt: string;
  raw: ArchiveObject;
  parsed: ArchiveObject;
};

type ArchiveObject = {
  storageKey: string;
  checksum: string;
  bytes: number;
  compressedBytes: number;
  encoding: "gzip";
};

export type ArchivedOfferArtifacts = {
  basePath: string;
  rawHtmlPath: string;
  parsedJsonPath: string;
  rawStorageKey: string;
  parsedStorageKey: string;
  rawChecksum: string;
  parsedChecksum: string;
  encoding: "gzip";
  deduplicated: boolean;
};

export async function archiveOfferArtifacts(input: {
  sourceKey: string;
  externalId: string;
  timestamp: string;
  html: string;
  parsed: Record<string, unknown>;
}): Promise<ArchivedOfferArtifacts> {
  const listingChecksum = createListingArchiveChecksum(input.parsed);
  const manifestPath = buildManifestPath(input.sourceKey, input.externalId);
  const previous = await readManifest(manifestPath);

  if (
    previous?.listingChecksum === listingChecksum &&
    await archiveObjectExists(previous.raw.storageKey) &&
    await archiveObjectExists(previous.parsed.storageKey)
  ) {
    return manifestToResult(previous, true);
  }

  const rawBuffer = Buffer.from(input.html, "utf8");
  const compactParsed = compactArchivePayload(input.parsed) as Record<string, unknown>;
  const parsedBuffer = Buffer.from(JSON.stringify(compactParsed), "utf8");
  const rawChecksum = sha256(rawBuffer);
  const parsedChecksum = sha256(parsedBuffer);
  const rawStorageKey = objectStorageKey("html", rawChecksum, "html.gz");
  const parsedStorageKey = objectStorageKey("json", parsedChecksum, "json.gz");
  const [rawCompressed, parsedCompressed] = await Promise.all([
    gzipAsync(rawBuffer),
    gzipAsync(parsedBuffer)
  ]);

  await Promise.all([
    writeObjectOnce(rawStorageKey, rawCompressed),
    writeObjectOnce(parsedStorageKey, parsedCompressed)
  ]);

  const manifest: ArchiveManifest = {
    version: 1,
    sourceKey: input.sourceKey,
    externalId: input.externalId,
    listingChecksum,
    capturedAt: input.timestamp,
    raw: {
      storageKey: rawStorageKey,
      checksum: rawChecksum,
      bytes: rawBuffer.byteLength,
      compressedBytes: rawCompressed.byteLength,
      encoding: "gzip"
    },
    parsed: {
      storageKey: parsedStorageKey,
      checksum: parsedChecksum,
      bytes: parsedBuffer.byteLength,
      compressedBytes: parsedCompressed.byteLength,
      encoding: "gzip"
    }
  };

  await writeManifest(manifestPath, manifest);
  return manifestToResult(manifest, false);
}

export function compactArchivePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactArchivePayload);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (["html", "primaryhtml", "rawhtml", "pagehtml"].includes(key.toLowerCase())) {
      continue;
    }
    result[key] = compactArchivePayload(child);
  }
  return result;
}

export function createListingArchiveChecksum(parsed: Record<string, unknown>) {
  const images = Array.isArray(parsed.images)
    ? parsed.images.map((image) => {
        if (!image || typeof image !== "object") return image;
        const entry = image as Record<string, unknown>;
        return {
          sourceUrl: entry.sourceUrl ?? null,
          position: entry.position ?? null,
          caption: entry.caption ?? null,
          isPrimary: entry.isPrimary ?? null
        };
      })
    : [];
  const meaningful = {
    externalId: parsed.externalId ?? null,
    canonicalUrl: parsed.canonicalUrl ?? null,
    title: parsed.title ?? null,
    description: parsed.description ?? null,
    offerType: parsed.offerType ?? null,
    marketType: parsed.marketType ?? null,
    status: parsed.status ?? null,
    priceAmount: parsed.priceAmount ?? null,
    areaSqm: parsed.areaSqm ?? null,
    rooms: parsed.rooms ?? null,
    floor: parsed.floor ?? null,
    totalFloors: parsed.totalFloors ?? null,
    yearBuilt: parsed.yearBuilt ?? null,
    latitude: parsed.latitude ?? null,
    longitude: parsed.longitude ?? null,
    sourceContactPhone: parsed.sourceContactPhone ?? null,
    addressText: parsed.addressText ?? null,
    district: parsed.district ?? null,
    neighborhood: parsed.neighborhood ?? null,
    street: parsed.street ?? null,
    city: parsed.city ?? null,
    publishedAt: parsed.publishedAt ?? null,
    images
  };
  return sha256(Buffer.from(JSON.stringify(meaningful), "utf8"));
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function objectStorageKey(kind: "html" | "json", checksum: string, extension: string) {
  return `offers/objects/${kind}/${checksum.slice(0, 2)}/${checksum}.${extension}`;
}

function buildManifestPath(sourceKey: string, externalId: string) {
  const safeSource = safeSegment(sourceKey);
  const safeExternal = `${safeSegment(externalId).slice(0, 80)}-${createHash("sha1").update(externalId).digest("hex").slice(0, 10)}`;
  return resolve(storageRoot, "offers", "manifests", safeSource, `${safeExternal}.json`);
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_") || "unknown";
}

function absoluteStoragePath(storageKey: string) {
  const absolute = resolve(storageRoot, ...storageKey.split("/"));
  const rootWithSeparator = resolve(storageRoot) + sep;
  if (!absolute.startsWith(rootWithSeparator)) {
    throw new Error(`Nieprawidlowa sciezka archiwum: ${storageKey}`);
  }
  return absolute;
}

async function archiveObjectExists(storageKey: string) {
  try {
    await access(absoluteStoragePath(storageKey), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeObjectOnce(storageKey: string, content: Buffer) {
  const path = absoluteStoragePath(storageKey);
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, content, { flag: "wx" });
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error;
  }
}

async function readManifest(path: string): Promise<ArchiveManifest | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ArchiveManifest;
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeManifest(path: string, manifest: ArchiveManifest) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(manifest), "utf8");
  await rename(temporaryPath, path);
}

function manifestToResult(manifest: ArchiveManifest, deduplicated: boolean): ArchivedOfferArtifacts {
  const rawHtmlPath = absoluteStoragePath(manifest.raw.storageKey);
  const parsedJsonPath = absoluteStoragePath(manifest.parsed.storageKey);
  return {
    basePath: dirname(rawHtmlPath),
    rawHtmlPath,
    parsedJsonPath,
    rawStorageKey: manifest.raw.storageKey,
    parsedStorageKey: manifest.parsed.storageKey,
    rawChecksum: manifest.raw.checksum,
    parsedChecksum: manifest.parsed.checksum,
    encoding: "gzip",
    deduplicated
  };
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isAlreadyExistsError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}
