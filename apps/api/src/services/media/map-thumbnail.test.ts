import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getMapThumbnail, getRemoteMapThumbnail } from "./map-thumbnail";

test("map thumbnail is bounded WebP, shared by concurrent requests and refreshed after source changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "map-thumbnail-"));
  try {
    const path = join(directory, "photo.png");
    await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "red" } })
      .png()
      .toFile(path);
    const [first, concurrent] = await Promise.all([getMapThumbnail(path), getMapThumbnail(path)]);
    assert.deepEqual(first, concurrent);
    assert.deepEqual(await getMapThumbnail(path), first);
    const metadata = await sharp(first).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 384);
    assert.equal(metadata.height, 240);
    await writeFile(
      path,
      await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "blue" } })
        .png()
        .toBuffer(),
    );
    assert.notDeepEqual(await getMapThumbnail(path), first);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("remote thumbnails share downloads, cache resized images and reject oversized responses", async (t) => {
  const source = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(new Uint8Array(source)),
  );
  const url = "https://example.test/" + crypto.randomUUID() + ".png";
  const [first, second] = await Promise.all([
    getRemoteMapThumbnail(url),
    getRemoteMapThumbnail(url),
  ]);
  assert.deepEqual(first, second);
  assert.deepEqual(await getRemoteMapThumbnail(url), first);
  assert.equal(mocked.mock.callCount(), 1);
  assert.equal((await sharp(first).metadata()).width, 384);
  mocked.mock.mockImplementation(
    async () =>
      new Response("oversized", { headers: { "content-length": String(21 * 1024 * 1024) } }),
  );
  await assert.rejects(getRemoteMapThumbnail(url + "large"), /size limit/);
  await assert.rejects(getRemoteMapThumbnail("file:///photo.png"), /protocol/);
});
