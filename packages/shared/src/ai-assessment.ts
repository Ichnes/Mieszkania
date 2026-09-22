export const AI_ASSESSMENT_VERSION = "apartment-v1";
export const AI_ASSESSMENT_CRITERIA = [
  { key: "location", label: "Lokalizacja", weight: 25 },
  { key: "value", label: "Cena i koszty", weight: 20 },
  { key: "condition", label: "Stan i wykończenie", weight: 20 },
  { key: "layout", label: "Układ i funkcjonalność", weight: 15 },
  { key: "building", label: "Budynek", weight: 10 },
  { key: "light", label: "Światło i przestrzeń zewnętrzna", weight: 10 },
] as const;
export type AiAssessmentCriterionKey = (typeof AI_ASSESSMENT_CRITERIA)[number]["key"];
export type AiAssessmentConfidence = "low" | "medium" | "high";
export type AiAssessmentCriterion = {
  key: AiAssessmentCriterionKey;
  score: number | null;
  confidence: AiAssessmentConfidence;
  evidence: string;
};
export type AiAssessmentSummary = {
  score: number | null;
  coverage: number;
  confidence: AiAssessmentConfidence;
  evaluatedAt: string;
};
export type AiAssessment = AiAssessmentSummary & {
  version: typeof AI_ASSESSMENT_VERSION;
  model: string;
  inputHash: string;
  summary: string;
  criteria: AiAssessmentCriterion[];
  strengths: string[];
  concerns: string[];
  questions: string[];
  limitations: string[];
  photos: { url: string; sha256: string }[];
  sourcePrice: number | null;
};
/** Missing evidence reduces coverage, never silently becomes a zero score. */
export function calculateAiAssessmentScore(criteria: AiAssessmentCriterion[]) {
  let coverage = 0;
  let weightedScore = 0;
  for (const definition of AI_ASSESSMENT_CRITERIA) {
    const criterion = criteria.find((item) => item.key === definition.key);
    if (criterion?.score == null) continue;
    if (!Number.isFinite(criterion.score) || criterion.score < 0 || criterion.score > 100) {
      throw new Error("AI criterion score must be between 0 and 100");
    }
    coverage += definition.weight;
    weightedScore += criterion.score * definition.weight;
  }
  return { score: coverage ? Math.round(weightedScore / coverage) : null, coverage };
}
