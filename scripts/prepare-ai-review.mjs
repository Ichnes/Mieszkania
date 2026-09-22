import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
const root = resolve(process.argv[2] || ".local/ai-review");
if (existsSync(resolve(root, "manifest.json")))
  throw new Error("A prepared batch already exists. Choose a new output directory.");
await mkdir(root, { recursive: true });
const base = process.env.AI_REVIEW_BASE_URL || "http://localhost:8080";
const hash = (data) => createHash("sha256").update(data).digest("hex");
async function json(path) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}
const ranking = await json("/api/listings?sort=dream_desc&pageSize=10");
const settings = await json("/api/settings/family");
const manifest = [];
for (let rank = 0; rank < ranking.items.length; rank++) {
  const listing = await json("/api/listings/" + ranking.items[rank].id);
  const fields = [
    "id",
    "title",
    "description",
    "canonicalUrl",
    "sourceLabel",
    "city",
    "district",
    "neighborhood",
    "addressText",
    "priceLabel",
    "pricePerSqmLabel",
    "areaLabel",
    "rooms",
    "floor",
    "totalFloors",
    "yearBuilt",
    "hasGarage",
    "hasOutdoorParking",
    "hasStorage",
    "hasLift",
    "hasBalcony",
    "hasAirConditioning",
    "finishQuality",
    "maintenanceFeeLabel",
    "additionalPurchaseCosts",
    "totalAcquisitionPrice",
    "totalAcquisitionPricePerSqm",
    "latitude",
    "longitude",
    "coordinateAccuracy",
    "features",
    "priceHistory",
  ];
  const facts = Object.fromEntries(
    fields.filter((k) => listing[k] !== undefined).map((k) => [k, listing[k]]),
  );
  facts.description = (facts.description || "")
    .replace(/(?:\+48[\s-]*)?(?:\d[\s-]*){9,}/g, "[numer usunięty]")
    .slice(0, 14000);
  const plans = listing.floorPlanImageUrls || [];
  const gallery = [...new Set(listing.imageUrls)].filter((x) => !plans.includes(x));
  const count = plans.length ? 5 : 6;
  const indexes = Array.from({ length: Math.min(count, gallery.length) }, (_, i) =>
    Math.round((i * (gallery.length - 1)) / Math.max(1, Math.min(count, gallery.length) - 1)),
  );
  const candidates = [
    ...new Set([...indexes.map((i) => gallery[i]), ...plans.slice(0, 1), ...gallery]),
  ];
  const photos = [],
    tiles = [],
    failures = [];
  for (const url of candidates) {
    if (photos.length >= 6) break;
    try {
      const response = await fetch(new URL(url, base), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get("content-length")) > 25 * 1024 * 1024)
        throw new Error("Image exceeds 25 MB");
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) throw new Error("Image exceeds 25 MB");
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      const sha256 = hash(bytes);
      if (photos.some((p) => p.sha256 === sha256)) continue;
      const jpeg = await sharp(bytes)
        .rotate()
        .resize(512, 360, { fit: "inside", withoutEnlargement: true })
        .extend({ top: 0, bottom: 24, left: 0, right: 0, background: "#ffffff" })
        .resize(512, 384, { fit: "contain", background: "#ffffff" })
        .jpeg({ quality: 82 })
        .toBuffer();
      const photoPath = resolve(root, `${rank + 1}-${photos.length + 1}.jpg`);
      await writeFile(photoPath, jpeg);
      tiles.push({
        input: jpeg,
        left: (photos.length % 2) * 512,
        top: Math.floor(photos.length / 2) * 384,
      });
      photos.push({
        url,
        sha256,
        kind: plans.includes(url) ? "floor-plan" : "photo",
        path: photoPath,
      });
    } catch (e) {
      failures.push(String(e));
    }
  }
  const sheet = resolve(root, `${rank + 1}-photos.jpg`);
  if (tiles.length)
    await sharp({
      create: {
        width: 1024,
        height: Math.ceil(tiles.length / 2) * 384,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite(tiles)
      .jpeg({ quality: 88 })
      .toFile(sheet);
  const packet = {
    rank: rank + 1,
    listingId: listing.id,
    dreamScore: ranking.items[rank].dreamScore,
    preparedAt: new Date().toISOString(),
    facts,
    preferences: { dreamProfile: settings.dreamProfile, searchContract: settings.searchContract },
    photos,
    photoSheet: tiles.length ? sheet : null,
    photoFailures: failures.length,
  };
  packet.inputHash = hash(
    JSON.stringify({
      facts,
      preferences: packet.preferences,
      photos: photos.map(({ url, sha256 }) => ({ url, sha256 })),
    }),
  );
  const path = resolve(root, `${rank + 1}.json`);
  await writeFile(path, JSON.stringify(packet, null, 2));
  manifest.push({
    rank: rank + 1,
    listingId: listing.id,
    path,
    photoSheet: packet.photoSheet,
    inputHash: packet.inputHash,
    photos: photos.length,
  });
  console.log(
    `Prepared ${rank + 1}/10: ${photos.length} images, ${failures.length} download failures`,
  );
}
await writeFile(resolve(root, "manifest.json"), JSON.stringify(manifest, null, 2));
