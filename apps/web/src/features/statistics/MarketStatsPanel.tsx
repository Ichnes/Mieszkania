import type { MarketStatsResponse } from "@mieszkania/shared";
import { LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { DistrictExplorer } from "./DistrictExplorer";
import { type MarketStatsFilters } from "./types";

export const MarketActivityChart = lazy(() => import("./MarketActivityChart"));
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
            data={stats.buyerMarket}
            days={stats.periodDays}
            locations={locations}
          />
        </Suspense>
      ) : (
        locations
      )}
      <div className="stats-analysis-grid">
        <Suspense fallback={<div className="panel">Ładowanie wykresu…</div>}>
          <MarketActivityChart stats={stats} />
        </Suspense>
        <div className="panel stats-distribution">
          <div className="stats-card-heading">
            <div>
              <p className="eyebrow">Poziom cen · {stats.periodDays} dni</p>
              <h3>Wykryte oferty według zł/m²</h3>
            </div>
            <span>
              {stats.priceDistribution
                .reduce((sum, band) => sum + band.count, 0)
                .toLocaleString("pl-PL")}{" "}
              z ceną
            </span>
          </div>
          <div className="price-distribution-list">
            {stats.priceDistribution.map((band) => (
              <div className="price-distribution-row" key={band.label}>
                <div>
                  <span>{band.label}</span>
                  <strong>
                    {band.count.toLocaleString("pl-PL")} ·{" "}
                    {band.sharePercent.toLocaleString("pl-PL")}%
                  </strong>
                </div>
                <i>
                  <b style={{ width: `${band.sharePercent}%` }} />
                </i>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="stats-segments-grid">
        {[
          { title: "Liczba pokoi", items: stats.segments.rooms },
          { title: "Metraż", items: stats.segments.areas },
          { title: "Rok budowy", items: stats.segments.buildingAge },
          { title: "Rynek", items: stats.segments.marketTypes },
          { title: "Stan wykończenia", items: stats.segments.finishing ?? [] },
          { title: "Czynsz miesięczny", items: stats.segments.monthlyFees ?? [] },
          { title: "Źródła ofert", items: stats.segments.sources },
        ].map((segment) => (
          <div className="panel stats-segment-card" key={segment.title}>
            <div className="stats-card-heading">
              <div>
                <p className="eyebrow">Struktura wykrytych · {stats.periodDays} dni</p>
                <h3>{segment.title}</h3>
                {segment.title === "Stan wykończenia" && (
                  <p className="stats-segment-hint">
                    Stan podany w ogłoszeniu lub rozpoznany z opisu. Ceny zakupu za m².
                  </p>
                )}
                {segment.title === "Czynsz miesięczny" && (
                  <p className="stats-segment-hint">
                    Aktywne i archiwalne oferty wykryte w wybranym okresie. Czynsz może pochodzić z
                    połączonego ogłoszenia. Mediana i zakres pokazują ceny zakupu za m².
                  </p>
                )}
                {segment.title === "Metraż" && (
                  <p className="stats-segment-hint">
                    Dolna granica włącznie, górna wyłącznie. Bez zaokrąglania metrażu.
                  </p>
                )}
              </div>
            </div>
            <div className="stats-segment-list">
              {segment.items.map((item) => (
                <div className="stats-segment-item" key={item.label}>
                  <div className="stats-segment-item-heading">
                    <span>{item.label}</span>
                    <strong
                      title={`${item.count.toLocaleString("pl-PL")} ofert w grupie; ${item.pricedListings.toLocaleString("pl-PL")} z ceną i metrażem`}
                    >
                      <span>Oferty: {item.count.toLocaleString("pl-PL")}</span>
                      <small>{item.sharePercent.toLocaleString("pl-PL")}%</small>
                    </strong>
                  </div>
                  <i aria-hidden="true">
                    <b style={{ width: `${item.sharePercent}%` }} />
                  </i>
                  <dl className="stats-segment-sample">
                    {item.sufficientSample && item.medianPricePerSqm != null ? (
                      <>
                        <div className="stats-segment-median">
                          <dt>Mediana</dt>
                          <dd>{formatPrice(item.medianPricePerSqm)}</dd>
                        </div>
                        <div className="stats-segment-range">
                          <dt>Środkowe 50%</dt>
                          <dd>
                            {Math.round(item.lowerQuartilePricePerSqm!).toLocaleString("pl-PL")}–
                            {Math.round(item.upperQuartilePricePerSqm!).toLocaleString("pl-PL")}{" "}
                            zł/m²
                          </dd>
                        </div>
                      </>
                    ) : (
                      <div className="stats-segment-range">
                        <dt>Za mało danych</dt>
                        <dd>Potrzeba co najmniej {stats.minimumSampleSize ?? 5} ofert z ceną</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
