import type { AiAssessment } from "@mieszkania/shared";
import { withDb } from "../../db";
export const AI_ASSESSMENT_SCHEMA = `
  create table if not exists listing_ai_assessments (
    listing_id uuid primary key references listings(id) on delete cascade,
    assessment jsonb not null,
    saved_at timestamptz not null default now()
  );
`;
export async function getAiAssessments(listingIds: string[]): Promise<Map<string, AiAssessment>> {
  if (!listingIds.length) return new Map();
  return withDb(async (db) => {
    const result = await db.query<{ listing_id: string; assessment: AiAssessment }>(
      `select listing_id, assessment from listing_ai_assessments where listing_id = any($1::uuid[])`,
      [listingIds],
    );
    return new Map(result.rows.map((row) => [row.listing_id, row.assessment]));
  });
}
