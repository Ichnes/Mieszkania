import type { MarketStatsResponse } from "@mieszkania/shared";
import { MapPin, Grid2X2, TrendingUp, LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { DistrictExplorer } from "./DistrictExplorer";
import { type MarketStatsFilters } from "./types";

import { SegmentExplorer } from "./SegmentExplorer";
import { MarketTrends } from "./MarketTrends";
const BuyerMarketPanel = lazy(() => import("./BuyerMarketPanel"));

export function MarketStatsPanel({
  stats,
  loading,
  baseline,
  filters,
}: {
  stats: MarketStatsResponse | null;
  loading: boolean;
  filters: MarketStatsFilters;
  baseline: MarketStatsResponse | null;
  onFiltersChange: (filters: MarketStatsFilters) => void;
}) {
  if (loading || !stats)
    return (
      <section className="panel stats-loading" aria-busy="true" aria-live="polite">
        <div className="stats-loading-copy">
          <span className="stats-loading-icon">
            <LoaderCircle className="icon-spin" size={24} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Statystyki rynku</p>
            <h2>Liczymy obraz rynku</h2>
            <p className="muted">
              Porównujemy ceny, przepływ ofert i segmenty mieszkań dla wybranego okresu.
            </p>
          </div>
        </div>
        <div className="stats-loading-progress">
          <i />
          <span>Agregowanie ofert i dzielnic…</span>
        </div>
        <div className="stats-loading-kpis" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <i />
              <b />
              <small />
            </div>
          ))}
        </div>
        <div className="stats-loading-body" aria-hidden="true">
          <div />
          <div />
        </div>
      </section>
    );

  const formatPrice = (value: number) =>
    value > 0 ? `${Math.round(value).toLocaleString("pl-PL")} zł/m²` : "Brak danych";
  const deltaClass = (value: number) =>
    value > 0 ? "is-positive" : value < 0 ? "is-negative" : "is-neutral";
  const formatPercentDelta = (value: number | null) =>
    value === null ? "brak porównania" : `${value > 0 ? "+" : ""}${value.toLocaleString("pl-PL")}%`;
  const locations = <DistrictExplorer stats={stats} baseline={baseline} filters={filters} />;

  return (
    <section className="stats-panel">
      <nav className="stats-jumps" aria-label="Przejdź do analizy">
        <a href="#lokalizacje">
          <MapPin size={16} aria-hidden="true" /> Lokalizacje
        </a>
        {stats.buyerMarket && (
          <a href="#segmenty">
            <Grid2X2 size={16} aria-hidden="true" /> Segmenty
          </a>
        )}
        <a href="#trendy">
          <TrendingUp size={16} aria-hidden="true" /> Trendy
        </a>
      </nav>
      <div className="section-topline">
        <div>
          <p className="eyebrow">
            Monitorowany segment rynku warszawskiego · ostatnie {stats.periodDays} dni
          </p>
          <h2>Co dzieje się teraz na rynku</h2>
          <p className="muted">Zmiany względem poprzednich {stats.periodDays} dni.</p>
        </div>
      </div>
      <div className="stats-kpi-grid stats-kpi-grid-insight">
        <div className="stats-kpi">
          <span>Aktywne teraz</span>
          <strong>{stats.totals.active.toLocaleString("pl-PL")}</strong>
          <small>
            {stats.scope
              ? `od ${stats.scope.roomsMin} pokoi, od ${stats.scope.minArea} m², ${stats.scope.minPrice.toLocaleString("pl-PL")}–${stats.scope.maxPrice.toLocaleString("pl-PL")} zł · z uwzględnieniem filtrów`
              : "W zakresie filtrów statystyk"}
          </small>
        </div>
        <div className="stats-kpi">
          <span>Mediana aktywnych</span>
          <strong>
            {stats.totals.medianPricePerSqm > 0
              ? formatPrice(Math.round(stats.totals.medianPricePerSqm))
              : "Brak danych"}
          </strong>
          <small>cena ofertowa za m²</small>
        </div>
        <div className="stats-kpi">
          <span>Nowo wykryte</span>
          <strong>{stats.comparison.newListings.toLocaleString("pl-PL")}</strong>
          <small className={deltaClass(stats.comparison.newListingsChangePercent ?? 0)}>
            {formatPercentDelta(stats.comparison.newListingsChangePercent)} vs poprzedni okres
          </small>
        </div>
        <div className="stats-kpi">
          <span>Zniknęły z portali</span>
          <strong>{stats.comparison.archivedListings.toLocaleString("pl-PL")}</strong>
          <small className={deltaClass(stats.comparison.archivedListingsChangePercent ?? 0)}>
            {formatPercentDelta(stats.comparison.archivedListingsChangePercent)} vs poprzedni okres
          </small>
        </div>
        <div className="stats-kpi">
          <span>Mediana nowych</span>
          <strong>
            {stats.comparison.medianNewPricePerSqm
              ? `${Math.round(stats.comparison.medianNewPricePerSqm).toLocaleString("pl-PL")} zł/m²`
              : "—"}
          </strong>
          <small className={deltaClass(stats.comparison.medianPriceChangePercent ?? 0)}>
            {formatPercentDelta(stats.comparison.medianPriceChangePercent)} vs poprzedni okres
          </small>
        </div>
        <div className="stats-kpi">
          <span>Czas ekspozycji</span>
          <strong>
            {stats.comparison.medianDaysOnMarket === null
              ? "—"
              : `${stats.comparison.medianDaysOnMarket} dni`}
          </strong>
          <small>mediana ofert zarchiwizowanych w okresie</small>
        </div>
      </div>
      <div className="stats-signal-strip">
        <div>
          <strong>
            {stats.totals.active
              ? stats.comparison.priceDropSharePercent.toLocaleString("pl-PL") + "%"
              : "Brak danych"}
          </strong>
          <span>
            {stats.comparison.priceDrops.toLocaleString("pl-PL")} z{" "}
            {stats.totals.active.toLocaleString("pl-PL")} aktywnych ofert z zapisanym zdarzeniem
            obniżki w okresie
          </span>
        </div>
        <div>
          <strong>
            {stats.comparison.newListings - stats.comparison.archivedListings >= 0 ? "+" : ""}
            {(stats.comparison.newListings - stats.comparison.archivedListings).toLocaleString(
              "pl-PL",
            )}
          </strong>
          <span>bilans wykryć i archiwizacji, łącznie z pierwszym zapełnieniem bazy</span>
        </div>
      </div>
      {stats.buyerMarket ? (
        <Suspense fallback={<p>Wczytywanie analizy kupującego…</p>}>
          <BuyerMarketPanel
            stats={stats}
            data={stats.buyerMarket}
            days={stats.periodDays}
            locations={locations}
          />
        </Suspense>
      ) : (
        <>
          {locations}
          <MarketTrends stats={stats} />
        </>
      )}
      <SegmentExplorer stats={stats} />
    </section>
  );
}
