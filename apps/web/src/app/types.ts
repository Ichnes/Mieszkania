import type { FamilySettings, ListingFilters, SupportedRegion } from "@mieszkania/shared";

export type AppTab =
  | "dashboard"
  | "compare"
  | "map"
  | "operations"
  | "backfill"
  | "mortgage"
  | "duplicates"
  | "stats";

export type ListingSortKey =
  | "newest"
  | "oldest"
  | "price_desc"
  | "price_asc"
  | "price_per_sqm_desc"
  | "price_per_sqm_asc"
  | "area_desc"
  | "area_asc"
  | "dream_desc";

export type ListingsSession = {
  activeTab: AppTab;
  filters: ListingFilters;
  listingSort: ListingSortKey;
  currentListingsPage: number;
};

export type ReadyState = {
  status: "ready";
  region: SupportedRegion;
  settings: FamilySettings;
};

export type LoadState = { status: "loading" } | { status: "error"; message: string } | ReadyState;
