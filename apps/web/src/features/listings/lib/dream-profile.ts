import type { FamilySettings, ListingSummary } from "@mieszkania/shared";
import { computeDreamScore } from "@mieszkania/shared";
export { computeDreamScore } from "@mieszkania/shared";

export function applyDreamProfile<T extends ListingSummary>(
  listings: T[],
  settings: FamilySettings,
) {
  return listings.map((listing) => ({
    ...listing,
    dreamScore: computeDreamScore(
      listing,
      settings.dreamProfile,
      settings.workplaces,
      undefined,
      settings.financing,
    ),
  }));
}
