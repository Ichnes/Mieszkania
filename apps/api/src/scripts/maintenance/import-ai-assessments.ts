import "../../config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { pool } from "../../db";
import { AI_ASSESSMENT_SCHEMA } from "../../services/listings/ai-assessment-repository";
import { validateAiReview } from "../../services/listings/ai-assessment-validation";

// This imports already prepared reviews. It never calls an AI provider.
async function main() {
  const [reviewsPath, model] = process.argv.slice(2);
  if (!reviewsPath || !model)
    throw new Error("Usage: import-ai-assessments <reviews.json> <model-name>");
  const root = dirname(resolve(reviewsPath));
  const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
  const reviews = await readJson(resolve(reviewsPath));
  const manifest = await readJson(resolve(root, "manifest.json"));
  if (
    !Array.isArray(reviews) ||
    !reviews.length ||
    reviews.length > 100 ||
    !Array.isArray(manifest)
  ) {
    throw new Error("Expected 1–100 reviews and a manifest");
  }
  const seen = new Set<string>();
  const validated = [];
  for (const review of reviews) {
    if (!review || typeof review.listingId !== "string" || seen.has(review.listingId))
      throw new Error("Invalid or duplicate listing ID");
    if (!/^[a-f0-9-]{36}$/i.test(review.listingId)) throw new Error("Invalid listing UUID");
    seen.add(review.listingId);
    const entry = manifest.find(
      (item: { listingId: string }) => item.listingId === review.listingId,
    );
    if (!entry || !Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 100)
      throw new Error("Review not in manifest");
    const packet = await readJson(resolve(root, `${entry.rank}.json`));
    if (packet.listingId !== review.listingId) throw new Error("Wrong snapshot");
    const photos = packet.photos.map(({ url, sha256 }: { url: string; sha256: string }) => ({
      url,
      sha256,
    }));
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ facts: packet.facts, preferences: packet.preferences, photos }))
      .digest("hex");
    if (inputHash !== packet.inputHash || inputHash !== entry.inputHash)
      throw new Error("Prepared snapshot has changed");
    validated.push({
      listingId: review.listingId,
      assessment: validateAiReview(review, {
        listingId: packet.listingId,
        inputHash,
        model,
        evaluatedAt: new Date().toISOString(),
        photos,
        sourcePrice: packet.facts.totalAcquisitionPrice ?? null,
      }),
    });
  }
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query(AI_ASSESSMENT_SCHEMA);
    let saved = 0;
    for (const { listingId, assessment } of validated) {
      // Re-import is idempotent; replacing an existing opinion is a separate, explicit task.
      const result = await db.query(
        `insert into listing_ai_assessments (listing_id, assessment)
        values ($1::uuid, $2::jsonb) on conflict (listing_id) do nothing`,
        [listingId, JSON.stringify(assessment)],
      );
      saved += result.rowCount ?? 0;
    }
    await db.query("commit");
    console.log(
      `Validated ${validated.length}; saved ${saved}; already present ${validated.length - saved}. No AI API calls.`,
    );
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Import failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
