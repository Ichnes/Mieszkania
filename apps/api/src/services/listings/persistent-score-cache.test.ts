import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPersistentScoreCache, scoreSignature } from "./persistent-score-cache";

test("ranking cache survives restart, invalidates code changes and contains no source text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "score-cache-"));
  try {
    const file = join(directory, "scores.json");
    const signature = scoreSignature("private description and preferences");
    const first = createPersistentScoreCache(file, async () => "v1");
    await first.load();
    first.set("offer", { signature, score: 42 });
    await first.save();
    assert.equal((await readFile(file, "utf8")).includes("private description"), false);
    const restarted = createPersistentScoreCache(file, async () => "v1");
    await restarted.load();
    assert.deepEqual(restarted.get("offer"), { signature, score: 42 });
    assert.notEqual(scoreSignature("changed price"), signature);
    const changedCode = createPersistentScoreCache(file, async () => "v2");
    await changedCode.load();
    assert.equal(changedCode.get("offer"), undefined);
    await writeFile(file, "broken json");
    const corrupt = createPersistentScoreCache(file, async () => "v1");
    await corrupt.load();
    assert.equal(corrupt.get("offer"), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unavailable disk and invalid entries cannot supply a score", async () => {
  const directory = await mkdtemp(join(tmpdir(), "score-cache-"));
  try {
    const file = join(directory, "scores.json");
    await writeFile(
      file,
      JSON.stringify({
        version: "v1",
        entries: [
          ["offer", { signature: "bad", score: 90 }],
          ["other", { signature: scoreSignature("a"), score: 999 }],
        ],
      }),
    );
    const cache = createPersistentScoreCache(file, async () => "v1");
    await cache.load();
    assert.equal(cache.get("offer"), undefined);
    assert.equal(cache.get("other"), undefined);
    const unavailable = createPersistentScoreCache(join(file, "scores.json"), async () => "v1");
    await unavailable.load();
    unavailable.set("offer", { signature: scoreSignature("a"), score: 30 });
    await unavailable.save();
    assert.equal(unavailable.get("offer")?.score, 30);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
