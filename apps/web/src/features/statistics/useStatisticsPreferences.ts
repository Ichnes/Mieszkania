import { useEffect, useState } from "react";
import type { MarketStatsFilters } from "./types";

export const statisticsStorageKey = "mieszkania-statistics-v1";
const emptyFilters: MarketStatsFilters = {
  minYear: "",
  minArea: "",
  maxArea: "",
  elevator: false,
  garage: false,
};
export function readStatisticsPreferences(raw: string | null) {
  const clean = (value: unknown): MarketStatsFilters => {
    const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const number = (key: string) =>
      typeof input[key] === "string" && (input[key] === "" || Number.isFinite(Number(input[key])))
        ? (input[key] as string)
        : "";
    return {
      minYear: number("minYear"),
      minArea: number("minArea"),
      maxArea: number("maxArea"),
      elevator: input.elevator === true,
      garage: input.garage === true,
    };
  };
  try {
    const saved = JSON.parse(raw ?? "null");
    return {
      filters: clean(saved?.filters),
      draft: clean(saved?.draft ?? saved?.filters),
      period: ([30, 90, 180].includes(saved?.period) ? saved.period : 30) as 30 | 90 | 180,
    };
  } catch {
    return { filters: { ...emptyFilters }, draft: { ...emptyFilters }, period: 30 as const };
  }
}
export function useStatisticsPreferences() {
  const [saved] = useState(() => {
    try {
      return readStatisticsPreferences(localStorage.getItem(statisticsStorageKey));
    } catch {
      return readStatisticsPreferences(null);
    }
  });
  const [marketStatsFilters, setMarketStatsFilters] = useState(saved.filters);
  const [marketStatsDraftFilters, setMarketStatsDraftFilters] = useState(saved.draft);
  const [marketStatsPeriod, setMarketStatsPeriod] = useState(saved.period);
  useEffect(() => {
    try {
      localStorage.setItem(
        statisticsStorageKey,
        JSON.stringify({
          filters: marketStatsFilters,
          draft: marketStatsDraftFilters,
          period: marketStatsPeriod,
        }),
      );
    } catch {
      /* Storage can be disabled. */
    }
  }, [marketStatsFilters, marketStatsDraftFilters, marketStatsPeriod]);
  return {
    marketStatsFilters,
    setMarketStatsFilters,
    marketStatsDraftFilters,
    setMarketStatsDraftFilters,
    marketStatsPeriod,
    setMarketStatsPeriod,
  };
}
