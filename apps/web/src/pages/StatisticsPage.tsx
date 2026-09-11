import type { WorkspaceState } from "../app/useWorkspaceController";
import { hasExposureFilter } from "@mieszkania/shared";
import { MarketPulse } from "../features/listings/components/AnalysisInsights";
import { MarketStatsPanel } from "../features/statistics/MarketStatsPanel";
import { StatsControls } from "../features/statistics/StatsControls";
import { MarketStatsFilters } from "../features/statistics/types";

export function StatisticsPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "activeTab"
    | "marketStatsPeriod"
    | "marketStatsDraftFilters"
    | "setMarketStatsPeriod"
    | "setMarketStatsDraftFilters"
    | "setMarketStats"
    | "setMarketStatsFilters"
    | "marketStatsError"
    | "marketStatsFilters"
    | "marketStats"
    | "marketStatsLoading"
    | "marketStatsBaseline"
    | "statsPriceDelta"
  >;
}) {
  const {
    activeTab,
    marketStatsPeriod,
    marketStatsDraftFilters,
    setMarketStatsPeriod,
    setMarketStatsDraftFilters,
    setMarketStats,
    setMarketStatsFilters,
    marketStatsError,
    marketStatsFilters,
    marketStats,
    marketStatsLoading,
    marketStatsBaseline,
    statsPriceDelta,
  } = model;
  return (
    <>
      {activeTab === "stats" ? (
        <>
          <StatsControls
            period={marketStatsPeriod}
            draft={marketStatsDraftFilters}
            onPeriodChange={setMarketStatsPeriod}
            onDraftChange={setMarketStatsDraftFilters}
            onApply={() => {
              setMarketStats(null);
              setMarketStatsFilters(marketStatsDraftFilters);
            }}
            onClear={() => {
              const empty: MarketStatsFilters = {
                minYear: "",
                minArea: "",
                maxArea: "",
                elevator: false,
                garage: false,
                storage: false,
                directions: [],
              };
              setMarketStatsDraftFilters(empty);
              setMarketStats(null);
              setMarketStatsFilters(empty);
            }}
          />
          {marketStatsError ? (
            <p className="panel" role="alert">
              {marketStatsError}{" "}
              <button
                className="action-button secondary-button"
                onClick={() => setMarketStatsFilters({ ...marketStatsFilters })}
              >
                Spróbuj ponownie
              </button>
            </p>
          ) : null}
          {marketStats && !marketStatsLoading ? <MarketPulse stats={marketStats} /> : null}
          <MarketStatsPanel
            stats={marketStats}
            loading={marketStatsLoading}
            filters={marketStatsFilters}
            baseline={marketStatsBaseline}
            onFiltersChange={setMarketStatsFilters}
          />
        </>
      ) : null}
      {activeTab === "stats" && statsPriceDelta !== 0 ? (
        <div className="stats-delta-banner">
          Średnia cena za m² względem zapisanych kryteriów bez dodatkowych filtrów:{" "}
          <strong>
            {statsPriceDelta > 0 ? "↑" : "↓"} {Math.abs(statsPriceDelta).toLocaleString("pl-PL")}{" "}
            zł/m²
          </strong>
        </div>
      ) : null}
      {activeTab === "stats" &&
      marketStats &&
      marketStatsBaseline &&
      (marketStatsFilters.minYear ||
        marketStatsFilters.minArea ||
        marketStatsFilters.maxArea ||
        marketStatsFilters.elevator ||
        marketStatsFilters.garage ||
        marketStatsFilters.storage ||
        hasExposureFilter(marketStatsFilters.directions)) ? (
        <div className="panel stats-filter-diff">
          <strong>
            Cena za m² — różnica względem zapisanych kryteriów bez dodatkowych filtrów
          </strong>
          <span>
            {Math.round(marketStats.totals.averagePricePerSqm).toLocaleString("pl-PL")} zł/m² (
            {statsPriceDelta >= 0 ? "+" : "-"}
            {Math.abs(statsPriceDelta).toLocaleString("pl-PL")} zł/m²)
          </span>
        </div>
      ) : null}
    </>
  );
}
