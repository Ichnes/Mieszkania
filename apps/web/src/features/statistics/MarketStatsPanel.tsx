import type { MarketStatsResponse } from "@mieszkania/shared";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { Fragment, lazy, Suspense, useState } from "react";
import { StatsDistrictMap } from "./StatsDistrictMap";
import { MarketStatsFilters } from "./types";

export const MarketActivityChart = lazy(() => import("./MarketActivityChart"));

export function MarketStatsPanel({
  stats,
  loading,
  baseline,
}: {
  stats: MarketStatsResponse | null;
  loading: boolean;
  filters: MarketStatsFilters;
  baseline: MarketStatsResponse | null;
  onFiltersChange: (filters: MarketStatsFilters) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<"active" | "price" | "archive" | "drops">("active");
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

  const names = [
    "Bemowo",
    "Białołęka",
    "Bielany",
    "Mokotów",
    "Ochota",
    "Praga-Północ",
    "Praga-Południe",
    "Rembertów",
    "Śródmieście",
    "Targówek",
    "Ursus",
    "Ursynów",
    "Wawer",
    "Wesoła",
    "Wilanów",
    "Włochy",
    "Wola",
    "Żoliborz",
    "Bez dzielnicy",
  ];
  const districtRows = (input: MarketStatsResponse | null) =>
    names.map(
      (name) =>
        input?.districts.find((row) => row.district === name) ?? {
          district: name,
          active: 0,
          archived: 0,
          averagePricePerSqm: 0,
          medianPricePerSqm: 0,
          pricedListings: 0,
          averageArea: 0,
          archiveRate: 0,
          priceDrops: 0,
          priceIncreases: 0,
          newLast7Days: 0,
          newInPeriod: 0,
          archivedInPeriod: 0,
          medianDaysOnMarket: null,
          neighborhoods: [],
        },
    );
  const rows = districtRows(stats);
  const baselineRows = districtRows(baseline);
  const reliablePrice = (row: MarketStatsResponse["districts"][number]) =>
    row.pricedListings >= (stats.minimumSampleSize ?? 10) ? row.medianPricePerSqm : -1;
  const sorted = [...rows].sort((left, right) =>
    sort === "price"
      ? reliablePrice(right) - reliablePrice(left)
      : sort === "archive"
        ? right.archivedInPeriod - left.archivedInPeriod
        : sort === "drops"
          ? right.priceDrops - left.priceDrops
          : right.active - left.active,
  );
  const formatPrice = (value: number) =>
    value > 0 ? `${Math.round(value).toLocaleString("pl-PL")} zł/m²` : "Brak danych";
  const formatDelta = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(Math.round(value)).toLocaleString("pl-PL")} zł/m²`;
  const deltaClass = (value: number) =>
    value > 0 ? "is-positive" : value < 0 ? "is-negative" : "is-neutral";
  const offerPercent = (count: number, active: number) =>
    active > 0 ? Math.round((count / active) * 100) : 0;
  const formatPercentDelta = (value: number | null) =>
    value === null ? "brak porównania" : `${value > 0 ? "+" : ""}${value.toLocaleString("pl-PL")}%`;
  const toggleSelected = (name: string) =>
    setSelected((current) => (current === name ? null : name));
  const sortOptions: Array<{ key: typeof sort; label: string }> = [
    { key: "active", label: "Liczba ofert" },
    { key: "price", label: "Cena za m²" },
    { key: "archive", label: "Archiwizacje" },
    { key: "drops", label: "Obniżki" },
  ];

  return (
    <section className="stats-panel">
      <div className="section-topline">
        <div>
          <p className="eyebrow">Rynek warszawski · ostatnie {stats.periodDays} dni</p>
          <h2>Co dzieje się teraz na rynku</h2>
          <p className="muted">
            Bieżący okres porównujemy z bezpośrednio poprzednimi {stats.periodDays} dniami. Ceny
            dzielnic pokazujemy jako medianę ofert wykrytych w wybranym okresie. Porównania cen
            wymagają co najmniej {stats.minimumSampleSize ?? 10} ofert z ceną. Zakres środkowych 50%
            cen w segmentach to kwartyle 25–75%, nie prognoza ani przedział ufności.
          </p>
        </div>
      </div>
      <div className="stats-kpi-grid stats-kpi-grid-insight">
        <div className="stats-kpi">
          <span>Aktywne teraz</span>
          <strong>{stats.totals.active.toLocaleString("pl-PL")}</strong>
          <small>w zakresie pobierania i filtrów statystyk, bez duplikatów</small>
        </div>
        <div className="stats-kpi">
          <span>Mediana aktywnych</span>
          <strong>
            {Math.round(stats.totals.medianPricePerSqm).toLocaleString("pl-PL")} zł/m²
          </strong>
          <small>zamiast podatnej na skrajności średniej</small>
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
          <strong>{stats.comparison.priceDrops.toLocaleString("pl-PL")}</strong>
          <span>aktywnych ofert miało obniżkę</span>
        </div>
        <div>
          <strong>{stats.comparison.priceDropSharePercent.toLocaleString("pl-PL")}%</strong>
          <span>aktywnych ofert przeceniono w okresie</span>
        </div>
        <div>
          <strong>
            {stats.comparison.newListings - stats.comparison.archivedListings >= 0 ? "+" : ""}
            {(stats.comparison.newListings - stats.comparison.archivedListings).toLocaleString(
              "pl-PL",
            )}
          </strong>
          <span>bilans nowych i archiwizowanych</span>
        </div>
      </div>
      <div className="stats-layout">
        <div className="panel stats-map">
          <StatsDistrictMap stats={stats} selected={selected} onSelect={toggleSelected} />
        </div>
        <div className="panel stats-table">
          <div className="stats-table-header">
            <div>
              <p className="eyebrow">Ranking lokalizacji</p>
              <h3>Dzielnice</h3>
              <span>
                {rows.filter((row) => row.active > 0).length} dzielnic · mediana i przepływ dla{" "}
                {stats.periodDays} dni
              </span>
            </div>
            <div className="stats-sort-buttons" aria-label="Sortowanie dzielnic">
              {sortOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={sort === option.key ? "is-active" : ""}
                  onClick={() => setSort(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="stats-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Dzielnica</th>
                  <th>Aktywne teraz</th>
                  <th>Mediana zł/m²</th>
                  <th className="stats-col-secondary">Wykryte / zniknęły</th>
                  <th className="stats-col-secondary">Obniżki</th>
                  <th className="stats-col-secondary">Mediana dni</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((district, index) => {
                  const expanded = selected === district.district;
                  const baselineDistrict = baselineRows.find(
                    (row) => row.district === district.district,
                  );
                  const districtDelta =
                    district.medianPricePerSqm -
                    (baselineDistrict?.medianPricePerSqm ?? district.medianPricePerSqm);
                  return (
                    <Fragment key={district.district}>
                      <tr
                        className={
                          expanded ? "district-stats-row is-selected" : "district-stats-row"
                        }
                        onClick={() => toggleSelected(district.district)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleSelected(district.district);
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={expanded}
                      >
                        <td>
                          <div className="district-name-cell">
                            <span className="district-rank">{index + 1}</span>
                            <div>
                              <strong>{district.district}</strong>
                              <small>{district.neighborhoods.length} poddzielnic</small>
                            </div>
                            <ChevronRight
                              className="district-expand-icon"
                              size={18}
                              aria-hidden="true"
                            />
                          </div>
                        </td>
                        <td data-label="Aktywne teraz" className="stats-mobile-active">
                          <span className="stats-count-pill">
                            {district.active.toLocaleString("pl-PL")}
                          </span>
                        </td>
                        <td data-label="Mediana ceny za m²" className="stats-mobile-price">
                          <strong className="stats-price-value">
                            {district.pricedListings >= (stats.minimumSampleSize ?? 10)
                              ? formatPrice(district.medianPricePerSqm)
                              : "Mała próba"}
                          </strong>
                          {baseline &&
                          district.pricedListings >= (stats.minimumSampleSize ?? 10) &&
                          (baselineDistrict?.pricedListings ?? 0) >=
                            (stats.minimumSampleSize ?? 10) ? (
                            <small className={`stats-row-delta ${deltaClass(districtDelta)}`}>
                              {formatDelta(districtDelta)}
                            </small>
                          ) : null}
                          <small>{district.pricedListings} ofert z ceną</small>
                        </td>
                        <td
                          data-label={`Ruch ofert · ${stats.periodDays} dni`}
                          className="stats-col-secondary stats-mobile-flow"
                        >
                          <span className="stats-flow-pair">
                            <b>+{district.newInPeriod} wykrytych</b>
                            <b>−{district.archivedInPeriod} zniknęło</b>
                          </span>
                        </td>
                        <td
                          data-label={`Obniżki · ${stats.periodDays} dni`}
                          className="stats-col-secondary stats-mobile-drops"
                        >
                          <span className="change-pill is-drop">↓ {district.priceDrops}</span>
                          <small>{offerPercent(district.priceDrops, district.active)}% ofert</small>
                        </td>
                        <td data-label="Mediana ekspozycji" className="stats-mobile-days">
                          <strong>
                            {district.medianDaysOnMarket === null
                              ? "—"
                              : `${district.medianDaysOnMarket} dni`}
                          </strong>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="neighborhood-expansion-row">
                          <td colSpan={6}>
                            <div className="neighborhood-expansion">
                              <div className="neighborhood-expansion-heading">
                                <div>
                                  <p className="eyebrow">Poddzielnice · {district.district}</p>
                                  <h4>Dokładniejszy obraz lokalnego rynku</h4>
                                </div>
                                <p>
                                  Różnica ceny jest liczona względem tej samej poddzielnicy bez
                                  żadnych filtrów.
                                </p>
                              </div>
                              {district.neighborhoods.length ? (
                                <div className="neighborhood-grid">
                                  {district.neighborhoods.map((neighborhood) => {
                                    const baselineNeighborhood =
                                      baselineDistrict?.neighborhoods.find(
                                        (item) => item.neighborhood === neighborhood.neighborhood,
                                      );
                                    const hasBaseline = Boolean(
                                      baselineNeighborhood?.averagePricePerSqm,
                                    );
                                    const delta = hasBaseline
                                      ? neighborhood.averagePricePerSqm -
                                        (baselineNeighborhood?.averagePricePerSqm ?? 0)
                                      : 0;
                                    return (
                                      <article
                                        className="neighborhood-stat-card"
                                        key={neighborhood.neighborhood}
                                      >
                                        <div className="neighborhood-card-top">
                                          <strong>{neighborhood.neighborhood}</strong>
                                          <span>
                                            {neighborhood.active.toLocaleString("pl-PL")} ofert
                                          </span>
                                        </div>
                                        <div className="neighborhood-card-price">
                                          <b>{formatPrice(neighborhood.averagePricePerSqm)}</b>
                                          {baseline && hasBaseline ? (
                                            <span className={deltaClass(delta)}>
                                              ({formatDelta(delta)})
                                            </span>
                                          ) : (
                                            <span className="is-neutral">
                                              brak punktu odniesienia
                                            </span>
                                          )}
                                        </div>
                                      </article>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="neighborhood-empty">
                                  <strong>Brak poddzielnic do pokazania</strong>
                                  <span>
                                    Nowy estymator uzupełni je przy kolejnym zapisie lub migracji
                                    danych.
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
                    Deklarowane opłaty miesięczne. Mediana i zakres poniżej to ceny zakupu za m².
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
                      {item.count.toLocaleString("pl-PL")}{" "}
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
                        <dd>Potrzeba co najmniej {stats.minimumSampleSize ?? 10} ofert z ceną</dd>
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
