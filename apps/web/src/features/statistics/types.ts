import { hasExposureFilter, type ExposureDirection } from "@mieszkania/shared";
export type MarketStatsFilters = {
  minYear: string;
  minArea: string;
  maxArea: string;
  elevator: boolean;
  garage: boolean;
  storage: boolean;
  directions: ExposureDirection[];
};
export function hasActiveMarketFilters(filters: MarketStatsFilters) {
  return Boolean(
    filters.minYear ||
    filters.minArea ||
    filters.maxArea ||
    filters.elevator ||
    filters.garage ||
    filters.storage ||
    hasExposureFilter(filters.directions),
  );
}
