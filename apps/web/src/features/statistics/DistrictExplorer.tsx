import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { MarketStatsResponse } from "@mieszkania/shared";
import { StatsDistrictMap } from "./StatsDistrictMap";
import { SampleSizeIndicator } from "./MarketIndicators";
import { hasActiveMarketFilters, type MarketStatsFilters } from "./types";

export function DistrictExplorer({
  stats,
  baseline,
  filters,
}: {
  stats: MarketStatsResponse;
  baseline: MarketStatsResponse | null;
  filters: MarketStatsFilters;
}) {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [sort, setSort] = useState<"active" | "price" | "archive" | "drops">("active");
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
    row.pricedListings >= 4 ? row.medianPricePerSqm : -1;
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
  const toggleSelected = (name: string) => {
    setSelectedArea(null);
    setSelected((current) => (current === name ? null : name));
  };
  const sortOptions: Array<{ key: typeof sort; label: string }> = [
    { key: "active", label: "Liczba ofert" },
    { key: "price", label: "Cena za m²" },
    { key: "archive", label: "Archiwizacje" },
    { key: "drops", label: "Obniżki" },
  ];

  return (
    <div className="stats-layout" id="lokalizacje" data-rank={sort}>
      <div className="panel stats-map">
        <StatsDistrictMap
          stats={stats}
          selected={selected}
          onSelect={toggleSelected}
          onAreaSelect={setSelectedArea}
          selectedArea={selectedArea}
          metricLabel={sortOptions.find((o) => o.key === sort)!.label}
          metricValue={(row) =>
            sort === "price"
              ? row.pricedListings >= 4
                ? row.medianPricePerSqm
                : null
              : sort === "archive"
                ? row.archivedInPeriod
                : sort === "drops"
                  ? row.priceDrops
                  : row.active
          }
        />
      </div>
      <div className="panel stats-table">
        <div className="stats-table-header">
          <div>
            <p className="eyebrow">Dzielnice Warszawy</p>
            <h3>Ranking lokalizacji</h3>
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
                aria-pressed={sort === option.key}
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
                        expanded
                          ? "district-stats-row is-selected"
                          : `district-stats-row${index >= 5 && !showAll ? " beyond-top-five" : ""}`
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
                            <small>{district.neighborhoods.length} lokalizacji z ogłoszeń</small>
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
                          {district.pricedListings >= 4
                            ? formatPrice(district.medianPricePerSqm)
                            : district.pricedListings
                              ? "Bardzo mała próba"
                              : "Brak cen"}
                        </strong>
                        {hasActiveMarketFilters(filters) &&
                        baseline &&
                        district.pricedListings >= 4 &&
                        (baselineDistrict?.pricedListings ?? 0) >= 4 ? (
                          <small className={`stats-row-delta ${deltaClass(districtDelta)}`}>
                            {formatDelta(districtDelta)} względem zakresu bez filtrów
                          </small>
                        ) : null}
                        <SampleSizeIndicator count={district.pricedListings} unit="cen" />
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
                        <small>
                          {district.active
                            ? offerPercent(district.priceDrops, district.active) + "% ofert"
                            : "Brak aktywnych ofert"}
                        </small>
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
                                <p className="eyebrow">
                                  Lokalizacje z ogłoszeń · {district.district}
                                </p>
                                <h4>Ceny aktywnych mieszkań</h4>
                              </div>
                              <p>
                                Średnia cena za m² aktywnych ofert według nazwy lokalizacji w
                                ogłoszeniu.
                              </p>
                            </div>
                            {district.neighborhoods.length ? (
                              <div className="neighborhood-grid">
                                {district.neighborhoods.map((neighborhood) => {
                                  const baselineNeighborhood = baselineDistrict?.neighborhoods.find(
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
                                      className={`neighborhood-stat-card${selectedArea === neighborhood.neighborhood ? " is-map-selected" : ""}`}
                                      aria-current={
                                        selectedArea === neighborhood.neighborhood
                                          ? "true"
                                          : undefined
                                      }
                                      key={neighborhood.neighborhood}
                                    >
                                      <div className="neighborhood-card-top">
                                        <button
                                          type="button"
                                          className="area-rank-choice"
                                          aria-pressed={selectedArea === neighborhood.neighborhood}
                                          onClick={() => setSelectedArea(neighborhood.neighborhood)}
                                        >
                                          {neighborhood.neighborhood}
                                        </button>
                                        <span>
                                          {neighborhood.active.toLocaleString("pl-PL")} ofert
                                        </span>
                                      </div>
                                      <div className="neighborhood-card-price">
                                        <b>{formatPrice(neighborhood.averagePricePerSqm)}</b>
                                        {hasActiveMarketFilters(filters) &&
                                        baseline &&
                                        hasBaseline &&
                                        neighborhood.averagePricePerSqm > 0 ? (
                                          <span className={deltaClass(delta)}>
                                            ({formatDelta(delta)} względem zakresu bez filtrów)
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
        {sorted.length > 5 && (
          <button
            className="location-rank-toggle ghost-button"
            aria-expanded={showAll}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Pokaż pierwsze 5" : `Pokaż cały ranking (${sorted.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
