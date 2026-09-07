import type {
  AlertsResponse,
  DashboardResponse,
  FamilySettings,
  ListingFilters,
  SupportedRegion,
  UpcomingViewingsResponse,
} from "@mieszkania/shared";

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
  dashboard: DashboardResponse;
  alerts: AlertsResponse;
  region: SupportedRegion;
  settings: FamilySettings;
  upcomingViewings: UpcomingViewingsResponse;
};

export type LoadState = { status: "loading" } | { status: "error"; message: string } | ReadyState;
