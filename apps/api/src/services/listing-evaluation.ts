import {
  createDefaultFamilySettings,
  evaluationDimensions,
  type EvaluationDimensionKey,
  type EvaluationRaterKey,
  type FamilySettings,
  type ListingEvaluationEntry,
  type ListingEvaluationSummary
} from "@mieszkania/shared";
import { withDb } from "../db";
import { getFamilySettings } from "./family-settings";

type ScoreRow = {
  rater_key: string;
  dimension_key: string;
  score: number;
  note: string | null;
};

export async function getListingEvaluation(listingId: string): Promise<ListingEvaluationSummary> {
  const [settings, entries] = await Promise.all([getFamilySettings(), getListingEvaluationEntries(listingId)]);
  return buildEvaluationSummary(settings, entries);
}

export async function saveListingEvaluation(
  listingId: string,
  entries: ListingEvaluationEntry[]
): Promise<ListingEvaluationSummary> {
  await withDb(async (db) => {
    for (const entry of entries) {
      validateEntry(entry);

      await db.query(
        `
          insert into listing_scores (listing_id, rater_key, dimension_key, score, note, updated_at)
          values ($1, $2, $3, $4, $5, now())
          on conflict (listing_id, rater_key, dimension_key)
          do update set
            score = excluded.score,
            note = excluded.note,
            updated_at = now()
        `,
        [listingId, entry.raterKey, entry.dimensionKey, entry.score, entry.note ?? null]
      );
    }
  });

  return getListingEvaluation(listingId);
}

export async function getListingRankingScore(listingId: string) {
  const summary = await getListingEvaluation(listingId);
  return summary.rankingScore;
}

export async function getListingRankingScores(listingIds: string[]): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (listingIds.length === 0) {
    return scores;
  }

  const [settings, entries] = await Promise.all([
    getFamilySettings(),
    withDb(async (db) => {
      const result = await db.query<(ScoreRow & { listing_id: string })>(
        `
          select listing_id, rater_key, dimension_key, score, note
          from listing_scores
          where listing_id = any($1::uuid[])
        `,
        [listingIds]
      );
      return result.rows;
    })
  ]);

  const entriesByListingId = new Map<string, ListingEvaluationEntry[]>();
  for (const entry of entries) {
    const listingEntries = entriesByListingId.get(entry.listing_id) ?? [];
    listingEntries.push({
      raterKey: entry.rater_key as EvaluationRaterKey,
      dimensionKey: entry.dimension_key as EvaluationDimensionKey,
      score: entry.score,
      note: entry.note ?? undefined
    });
    entriesByListingId.set(entry.listing_id, listingEntries);
  }

  for (const listingId of listingIds) {
    scores.set(listingId, buildEvaluationSummary(settings, entriesByListingId.get(listingId) ?? []).rankingScore);
  }

  return scores;
}

async function getListingEvaluationEntries(listingId: string): Promise<ListingEvaluationEntry[]> {
  return withDb(async (db) => {
    const result = await db.query<ScoreRow>(
      `
        select rater_key, dimension_key, score, note
        from listing_scores
        where listing_id = $1
      `,
      [listingId]
    );

    return result.rows.map((row) => ({
      raterKey: row.rater_key as EvaluationRaterKey,
      dimensionKey: row.dimension_key as EvaluationDimensionKey,
      score: row.score,
      note: row.note ?? undefined
    }));
  });
}

function buildEvaluationSummary(settings: FamilySettings, entries: ListingEvaluationEntry[]): ListingEvaluationSummary {
  const totals = {
    user: calculateWeightedScore("user", settings, entries),
    spouse: calculateWeightedScore("spouse", settings, entries),
    assistant: 0
  };

  return {
    dimensions: evaluationDimensions,
    settings,
    entries,
    totals,
    rankingScore: Number((((totals.user || 0) + (totals.spouse || 0)) / 2).toFixed(1)),
    assistantSuggestions: buildAssistantSuggestions(entries, settings)
  };
}

function calculateWeightedScore(
  rater: "user" | "spouse",
  settings: FamilySettings,
  entries: ListingEvaluationEntry[]
) {
  const weights = settings.weights[rater];
  const raterEntries = entries.filter((entry) => entry.raterKey === rater);

  let weightedSum = 0;
  let maxWeightedSum = 0;

  for (const dimension of evaluationDimensions) {
    const weight = weights[dimension.key];
    const entry = raterEntries.find((item) => item.dimensionKey === dimension.key);

    maxWeightedSum += weight * 10;
    if (entry) {
      weightedSum += entry.score * weight;
    }
  }

  if (maxWeightedSum === 0) {
    return 0;
  }

  return Number(((weightedSum / maxWeightedSum) * 100).toFixed(1));
}

function buildAssistantSuggestions(entries: ListingEvaluationEntry[], settings: FamilySettings) {
  const suggestions: string[] = [];
  const userEntries = entries.filter((entry) => entry.raterKey === "user");
  const spouseEntries = entries.filter((entry) => entry.raterKey === "spouse");

  for (const dimension of evaluationDimensions) {
    const userScore = userEntries.find((entry) => entry.dimensionKey === dimension.key)?.score;
    const spouseScore = spouseEntries.find((entry) => entry.dimensionKey === dimension.key)?.score;

    if (typeof userScore === "number" && typeof spouseScore === "number" && Math.abs(userScore - spouseScore) >= 4) {
      suggestions.push(`Duza rozbieznosc ocen przy "${dimension.label}" - warto przegadac ten punkt na spokojnie.`);
    }
  }

  const userWeightTotal = Object.values(settings.weights.user).reduce((sum, value) => sum + value, 0);
  if (userWeightTotal >= settings.maxWeightTotal) {
    suggestions.push("Twoj budzet wag jest praktycznie wykorzystany do maksimum. Zastanow sie, czy wszystko ma rownie wysoki priorytet.");
  }

  return suggestions;
}

function validateEntry(entry: ListingEvaluationEntry) {
  if (entry.score < 1 || entry.score > 10) {
    throw new Error(`Invalid score for ${entry.dimensionKey}. Expected 1-10.`);
  }

  if (!evaluationDimensions.find((dimension) => dimension.key === entry.dimensionKey)) {
    throw new Error(`Unknown dimension ${entry.dimensionKey}`);
  }

  if (!["user", "spouse", "assistant"].includes(entry.raterKey)) {
    throw new Error(`Unknown rater ${entry.raterKey}`);
  }
}

export function createEmptyEvaluationSummary(): ListingEvaluationSummary {
  return buildEvaluationSummary(createDefaultFamilySettings(), []);
}
