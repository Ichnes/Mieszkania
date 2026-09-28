import { publicFetch } from "../http/public-fetch";
import { createHash } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { mediaCacheRoot } from "../../config";
import { withDb } from "../../db";
import { getMediaDownloadCandidates } from "./image-repository";

type PendingMediaAsset = {
  assetId: string;
  storageKey: string;
  sourceUrl: string;
};

export async function downloadListingMedia(assets: PendingMediaAsset[]) {
  const results: Awaited<ReturnType<typeof downloadSingleMedia>>[] = [];
  const concurrency = 4;

  for (let index = 0; index < assets.length; index += concurrency) {
    const batch = await Promise.all(
      assets.slice(index, index + concurrency).map(downloadSingleMedia),
    );
    results.push(...batch);
  }

  return results;
}

async function downloadSingleMedia(asset: PendingMediaAsset) {
  try {
    const assetUrl = new URL(asset.sourceUrl);
    const headers = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      referer: `${assetUrl.origin}/`,
    };
    const response = await fetchMedia(asset.sourceUrl, headers);

    if (!response.ok) {
      await markMediaFailed(asset.assetId);
      return {
        assetId: asset.assetId,
        status: "failed" as const,
        reason: `HTTP ${response.status}`,
      };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") ?? inferMimeType(asset.sourceUrl);
    const outputPath = resolve(
      mediaCacheRoot,
      `${asset.storageKey}${getExtension(asset.sourceUrl, mimeType)}`,
    );

    await writeMediaAtomically(outputPath, bytes);

    await markMediaDownloaded({
      assetId: asset.assetId,
      mimeType,
      fileSizeBytes: bytes.byteLength,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    });

    return { assetId: asset.assetId, status: "downloaded" as const, outputPath };
  } catch (error) {
    await markMediaFailed(asset.assetId);
    return {
      assetId: asset.assetId,
      status: "failed" as const,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function writeMediaAtomically(outputPath: string, bytes: Buffer) {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}-${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    // Renaming a new inode over the destination also safely breaks a hard link
    // created by media deduplication without modifying its canonical sibling.
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function fetchMedia(url: string, headers: Record<string, string>) {
  return publicFetch(url, { headers, signal: AbortSignal.timeout(20_000) });
}

export async function backfillListingMedia(input?: { listingId?: string; limit?: number }) {
  const candidates = await getMediaDownloadCandidates(input);
  const results = await downloadListingMedia(candidates);

  return {
    requested: candidates.length,
    downloaded: results.filter((result) => result.status === "downloaded").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: 0,
    results,
  };
}

async function markMediaDownloaded(input: {
  assetId: string;
  mimeType: string;
  fileSizeBytes: number;
  contentHash: string;
}) {
  await withDb((db) =>
    db.query(
      `
        update listing_media_assets
        set
          mime_type = $2,
          file_size_bytes = $3,
          content_hash = $4,
          download_status = 'downloaded',
          last_downloaded_at = now()
        where id = $1
      `,
      [input.assetId, input.mimeType, input.fileSizeBytes, input.contentHash],
    ),
  );
}

async function markMediaFailed(assetId: string) {
  await withDb((db) =>
    db.query(
      `
        update listing_media_assets
        set download_status = 'failed'
        where id = $1
      `,
      [assetId],
    ),
  );
}

function getExtension(sourceUrl: string, mimeType: string) {
  const existing = extname(new URL(sourceUrl).pathname);

  if (existing) {
    return existing;
  }

  if (mimeType.includes("jpeg")) {
    return ".jpg";
  }

  if (mimeType.includes("png")) {
    return ".png";
  }

  if (mimeType.includes("webp")) {
    return ".webp";
  }

  return ".bin";
}

function inferMimeType(sourceUrl: string) {
  const extension = extname(new URL(sourceUrl).pathname).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "application/octet-stream";
}
