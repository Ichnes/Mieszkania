import type { ListingFilters } from "@mieszkania/shared";
import { AppTab, ListingSortKey, ListingsSession } from "./types";

export const listingsPerPage = 30;

export const listingsSessionStorageKey = "mieszkania-listings-session-v1";

export const defaultFilters: ListingFilters = {};

export function createListingsQuery(filters: ListingFilters, page: number, sort: ListingSortKey) {
  const query = new URLSearchParams();
  const requestFilters: ListingFilters = {
    ...filters,
    page,
    pageSize: listingsPerPage,
    sort,
  };

  for (const [key, value] of Object.entries(requestFilters)) {
    if (value !== undefined && value !== "" && value !== false) query.set(key, String(value));
  }
  return query.toString();
}

export function readListingsSession(): ListingsSession {
  const fallback: ListingsSession = {
    activeTab: "dashboard",
    filters: defaultFilters,
    listingSort: "newest",
    currentListingsPage: 1,
  };

  try {
    const saved = window.sessionStorage.getItem(listingsSessionStorageKey);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      activeTab: isAppTab(parsed.activeTab) ? parsed.activeTab : fallback.activeTab,
      filters: sanitizeListingFilters(parsed.filters),
      listingSort: isListingSortKey(parsed.listingSort) ? parsed.listingSort : fallback.listingSort,
      currentListingsPage:
        typeof parsed.currentListingsPage === "number" &&
        Number.isInteger(parsed.currentListingsPage) &&
        parsed.currentListingsPage > 0
          ? parsed.currentListingsPage
          : fallback.currentListingsPage,
    };
  } catch {
    return fallback;
  }
}

export function writeListingsSession(value: ListingsSession) {
  try {
    window.sessionStorage.setItem(listingsSessionStorageKey, JSON.stringify(value));
  } catch {
    // The application remains usable when storage is disabled by the browser.
  }
}

export function sanitizeListingFilters(value: unknown): ListingFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultFilters;
  const input = value as Record<string, unknown>;
  const output: ListingFilters = {};
  const stringKeys = ["district", "search"] as const;
  const numberKeys = [
    "minPrice",
    "maxPrice",
    "minArea",
    "maxArea",
    "minYearBuilt",
    "maxYearBuilt",
    "minPricePerSqm",
    "maxPricePerSqm",
    "roomsMin",
    "roomsMax",
  ] as const;
  const booleanKeys = [
    "shortlistedOnly",
    "priceChangedOnly",
    "archivedOnly",
    "hiddenOnly",
    "includeAllCities",
  ] as const;

  for (const key of stringKeys) {
    if (typeof input[key] === "string" && input[key]) output[key] = input[key];
  }
  for (const key of numberKeys) {
    if (typeof input[key] === "number" && Number.isFinite(input[key])) output[key] = input[key];
  }
  for (const key of booleanKeys) {
    if (input[key] === true) output[key] = true;
  }
  return output;
}

export function isAppTab(value: unknown): value is AppTab {
  return (
    typeof value === "string" &&
    [
      "dashboard",
      "compare",
      "map",
      "operations",
      "backfill",
      "mortgage",
      "duplicates",
      "stats",
    ].includes(value)
  );
}

export function isListingSortKey(value: unknown): value is ListingSortKey {
  return (
    typeof value === "string" &&
    ["newest", "oldest", "price_desc", "price_asc", "area_desc", "area_asc", "dream_desc"].includes(
      value,
    )
  );
}
