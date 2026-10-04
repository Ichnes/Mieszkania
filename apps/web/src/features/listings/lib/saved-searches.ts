import type { ListingFilters } from "@mieszkania/shared";
import type { ListingSortKey } from "../../../app/types";
import { isListingSortKey, sanitizeListingFilters } from "../../../app/session";

export const savedSearchesKey = "mieszkania-saved-searches-v1";
export const maxSavedSearches = 12;
export type SavedSearch = {
  id: string;
  name: string;
  filters: ListingFilters;
  sort: ListingSortKey;
};

export function parseSavedSearches(raw: string | null): SavedSearch[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    const used = new Set<string>();
    return data
      .flatMap((value): SavedSearch[] => {
        if (
          !value ||
          typeof value !== "object" ||
          typeof value.id !== "string" ||
          !value.id ||
          value.id.length > 80 ||
          used.has(value.id) ||
          typeof value.name !== "string" ||
          !value.name.trim() ||
          !isListingSortKey(value.sort)
        )
          return [];
        used.add(value.id);
        return [
          {
            id: value.id,
            name: value.name.trim().slice(0, 60),
            filters: sanitizeListingFilters(value.filters),
            sort: value.sort,
          },
        ];
      })
      .slice(0, maxSavedSearches);
  } catch {
    return [];
  }
}
