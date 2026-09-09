import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { storageRoot } from "../../config";
import { fetchMedia } from "./media-downloader";

const pending = new Map<string, Promise<Buffer>>();
const cacheRoot = join(storageRoot, "map-thumbnails");

export async function getMapThumbnail(filePath: string) {
  const file = await stat(filePath);
  const key = createHash("sha256")
    .update(`${filePath}:${file.size}:${file.mtimeMs}:384x240-v1`)
    .digest("hex");
  return cachedThumbnail(key, async () => filePath);
}

// URL comes exclusively from the listing's stored image record, never a request parameter.
export async function getRemoteMapThumbnail(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid image protocol");
  const key = createHash("sha256").update(`remote:${sourceUrl}:384x240-v1`).digest("hex");
  return cachedThumbnail(
    key,
    async () => {
      const response = await fetchMedia(sourceUrl, {
        "user-agent": "mieszkania-local-app/0.1",
        accept: "image/*",
        referer: `${url.origin}/`,
      });
      if (!response.ok || !response.body) throw new Error(`Image HTTP ${response.status}`);
      const maximumBytes = 20 * 1024 * 1024;
      if (Number(response.headers.get("content-length")) > maximumBytes) {
        await response.body.cancel();
        throw new Error("Image exceeds thumbnail size limit");
      }
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maximumBytes) throw new Error("Image exceeds thumbnail size limit");
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return Buffer.concat(chunks);
    },
    7 * 24 * 60 * 60 * 1000,
  );
}

async function cachedThumbnail(
  key: string,
  input: () => Promise<string | Buffer>,
  maximumAge = Infinity,
) {
  const cachedPath = join(cacheRoot, `${key}.webp`);
  let task = pending.get(key);
  if (!task) {
    task = (async () => {
      try {
        const cached = await stat(cachedPath);
        if (Date.now() - cached.mtimeMs < maximumAge) return await readFile(cachedPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const bytes = await sharp(await input(), { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width: 384, height: 240, fit: "cover", withoutEnlargement: true })
        .webp({ quality: 65 })
        .toBuffer();
      await mkdir(cacheRoot, { recursive: true });
      const temporaryPath = `${cachedPath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, bytes);
      await rename(temporaryPath, cachedPath);
      return bytes;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return task;
}
