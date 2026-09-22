import {
  AI_ASSESSMENT_CRITERIA,
  AI_ASSESSMENT_VERSION,
  calculateAiAssessmentScore,
  type AiAssessment,
  type AiAssessmentConfidence,
  type AiAssessmentCriterion,
} from "@mieszkania/shared";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected object");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`Invalid ${label}`);
  return value.trim();
}
function confidence(value: unknown): AiAssessmentConfidence {
  if (value !== "low" && value !== "medium" && value !== "high")
    throw new Error("Invalid confidence");
  return value;
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error(`Invalid ${label}`);
  return value.map((item) => text(item, label));
}
export function validateAiReview(
  value: unknown,
  metadata: {
    listingId: string;
    inputHash: string;
    model: string;
    evaluatedAt: string;
    photos: AiAssessment["photos"];
    sourcePrice: number | null;
  },
): AiAssessment {
  const review = record(value);
  if (review.listingId !== metadata.listingId || review.inputHash !== metadata.inputHash) {
    throw new Error("Review does not match the prepared listing snapshot");
  }
  if (!/^[a-f0-9]{64}$/.test(metadata.inputHash)) throw new Error("Invalid input hash");
  if (!Number.isFinite(Date.parse(metadata.evaluatedAt)))
    throw new Error("Invalid evaluation date");
  if (
    metadata.sourcePrice !== null &&
    (!Number.isFinite(metadata.sourcePrice) || metadata.sourcePrice <= 0)
  ) {
    throw new Error("Invalid source price");
  }
  if (!Array.isArray(metadata.photos) || metadata.photos.length > 6)
    throw new Error("At most 6 photos allowed");
  const photos = metadata.photos.map((photo) => {
    const url = text(photo.url, "photo URL", 4000);
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/api/media/"))
      throw new Error("Invalid photo URL");
    if (!/^[a-f0-9]{64}$/.test(photo.sha256)) throw new Error("Invalid photo hash");
    return { url, sha256: photo.sha256 };
  });
  if (new Set(photos.map((p) => p.sha256)).size !== photos.length)
    throw new Error("Duplicate photos");
  if (!Array.isArray(review.criteria) || review.criteria.length !== AI_ASSESSMENT_CRITERIA.length) {
    throw new Error("All six criteria are required");
  }
  const seen = new Set<string>();
  const criteria: AiAssessmentCriterion[] = review.criteria.map((value: unknown) => {
    const item = record(value);
    const definition = AI_ASSESSMENT_CRITERIA.find((entry) => entry.key === item.key);
    if (!definition || seen.has(definition.key)) throw new Error("Unknown or duplicate criterion");
    seen.add(definition.key);
    if (
      item.score !== null &&
      (typeof item.score !== "number" ||
        !Number.isFinite(item.score) ||
        item.score < 0 ||
        item.score > 100)
    ) {
      throw new Error("Invalid criterion score");
    }
    return {
      key: definition.key,
      score: item.score,
      confidence: confidence(item.confidence),
      evidence: text(item.evidence, "evidence"),
    };
  });
  return {
    version: AI_ASSESSMENT_VERSION,
    inputHash: metadata.inputHash,
    model: text(metadata.model, "model", 100),
    evaluatedAt: new Date(metadata.evaluatedAt).toISOString(),
    photos,
    sourcePrice: metadata.sourcePrice,
    ...calculateAiAssessmentScore(criteria),
    confidence: confidence(review.confidence),
    summary: text(review.summary, "summary"),
    criteria,
    strengths: strings(review.strengths, "strengths"),
    concerns: strings(review.concerns, "concerns"),
    questions: strings(review.questions, "questions"),
    limitations: strings(review.limitations, "limitations"),
  };
}
