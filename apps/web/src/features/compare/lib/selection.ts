import type { ListingSummary } from "@mieszkania/shared";

export function resolveCompareListings(compareIds: string[], ...sources: ListingSummary[][]) {
  const byId = new Map<string, ListingSummary>();

  for (const source of sources) {
    for (const listing of source) {
      if (!byId.has(listing.id)) {
        byId.set(listing.id, listing);
      }
    }
  }

  return compareIds
    .map((id) => byId.get(id))
    .filter((listing): listing is ListingSummary => Boolean(listing));
}
