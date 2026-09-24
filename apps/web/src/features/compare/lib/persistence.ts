import type { ComparisonListing } from "./types";

export const comparisonStorageKey = "mieszkania-comparison-v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readComparisonIds(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(comparisonStorageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(value.filter((id): id is string => typeof id === "string" && uuid.test(id))),
    ].slice(0, 5);
  } catch {
    return [];
  }
}

export function writeComparisonIds(ids: string[]): boolean {
  try {
    window.localStorage.setItem(comparisonStorageKey, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

export type ComparisonIssue = { id: string; reason: "missing" | "unavailable" };

export async function fetchComparison(
  ids: string[],
  fetchListing: (id: string) => Promise<Response>,
) {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetchListing(id);
        if (response.status === 404) return { id, reason: "missing" as const };
        if (!response.ok) throw new Error(String(response.status));
        const listing = (await response.json()) as ComparisonListing;
        if (listing.id !== id) throw new Error("Unexpected listing");
        return listing;
      } catch {
        return { id, reason: "unavailable" as const };
      }
    }),
  );
  return {
    listings: results.filter((result): result is ComparisonListing => !("reason" in result)),
    issues: results.filter((result): result is ComparisonIssue => "reason" in result),
  };
}
