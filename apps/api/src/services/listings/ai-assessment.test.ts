import test from "node:test";
import assert from "node:assert/strict";
import { AI_ASSESSMENT_CRITERIA, calculateAiAssessmentScore } from "@mieszkania/shared";
import { validateAiReview } from "./ai-assessment-validation";

const metadata = {
  listingId: "11111111-1111-4111-8111-111111111111",
  inputHash: "a".repeat(64),
  model: "test-model",
  evaluatedAt: "2026-09-22T12:00:00Z",
  photos: [],
  sourcePrice: 900000,
};
const review = () => ({
  ...metadata,
  confidence: "medium",
  summary: "Ocena próbna",
  criteria: AI_ASSESSMENT_CRITERIA.map(({ key }) => ({
    key,
    score: 80 as number | null,
    confidence: "medium" as const,
    evidence: "Fakt z oferty.",
  })),
  strengths: ["Układ"],
  concerns: ["Koszty"],
  questions: ["Stan instalacji?"],
  limitations: ["Brak oględzin"],
});
test("AI score uses fixed weights, ignoring a model-provided total", () => {
  const input = { ...review(), score: 100, coverage: 100 };
  input.criteria[0].score = 40;
  const output = validateAiReview(input, metadata);
  assert.equal(output.score, 70);
  assert.equal(output.coverage, 100);
});
test("missing criteria reduce coverage, not the average; wholly unknown score stays null", () => {
  const input = review();
  input.criteria[0].score = null;
  assert.deepEqual(calculateAiAssessmentScore(input.criteria), { score: 80, coverage: 75 });
  input.criteria.forEach((item) => {
    item.score = null;
  });
  assert.deepEqual(calculateAiAssessmentScore(input.criteria), { score: null, coverage: 0 });
});
test("rejects mismatched snapshot, incomplete/duplicate criteria and invalid numeric scores", () => {
  assert.throws(
    () => validateAiReview({ ...review(), inputHash: "b".repeat(64) }, metadata),
    /snapshot/,
  );
  assert.throws(() => validateAiReview({ ...review(), listingId: "wrong" }, metadata), /snapshot/);
  const input = review();
  assert.throws(
    () => validateAiReview({ ...input, criteria: input.criteria.slice(1) }, metadata),
    /six/,
  );
  assert.throws(
    () =>
      validateAiReview(
        { ...input, criteria: [...input.criteria.slice(1), input.criteria[1]] },
        metadata,
      ),
    /duplicate/,
  );
  for (const bad of [-1, 101, NaN, Infinity, "80", undefined]) {
    assert.throws(
      () =>
        validateAiReview(
          {
            ...input,
            criteria: [{ ...input.criteria[0], score: bad }, ...input.criteria.slice(1)],
          },
          metadata,
        ),
      /score/,
    );
  }
});
test("rejects unsafe image metadata, bad confidence, empty evidence, and excess photos", () => {
  assert.throws(
    () =>
      validateAiReview(review(), {
        ...metadata,
        photos: [{ url: "javascript:alert(1)", sha256: "b".repeat(64) }],
      }),
    /URL/,
  );
  assert.throws(
    () =>
      validateAiReview(review(), {
        ...metadata,
        photos: Array(7).fill({ url: "https://example.com/image.jpg", sha256: "b".repeat(64) }),
      }),
    /6 photos/,
  );
  assert.throws(
    () => validateAiReview({ ...review(), confidence: "certain" }, metadata),
    /confidence/,
  );
  const input = review();
  input.criteria[0].evidence = "";
  assert.throws(() => validateAiReview(input, metadata), /evidence/);
});
