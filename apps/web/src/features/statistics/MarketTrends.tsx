import { lazy, Suspense, useState, type ReactNode } from "react";
import type { MarketStatsResponse } from "@mieszkania/shared";
import { Select } from "../../components/Select";
const MarketActivityChart = lazy(() => import("./MarketActivityChart"));
export function MarketTrends({
  stats,
  matched,
  exposure,
  segment,
}: {
  stats: MarketStatsResponse;
  matched?: ReactNode;
  exposure?: ReactNode;
  segment?: string;
}) {
  const [view, setView] = useState("prices");
  return (
    <section className="market-trends" id="trendy">
      <div className="stats-card-heading">
        <h2>Rynek w czasie</h2>
        <label className="analysis-selector">
          Wykres
          <Select label="Wykres rynku" value={view} onChange={setView}>
            <option value="prices">Ceny i liczba ofert</option>
            <option value="balance">Bilans ofert</option>
            <option value="moves">Obniżki i podwyżki</option>
            {matched && <option value="matched">Ceny tych samych mieszkań</option>}
            {exposure && <option value="exposure">Czas ekspozycji</option>}
            <option value="histogram">Rozkład cen za m²</option>
          </Select>
        </label>
      </div>
      <p className="muted">
        {stats.periodDays} dni ·{" "}
        {view === "matched" || view === "exposure" ? segment : "Cały zakres filtrów strony"}
      </p>
      {view === "histogram" ? (
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
      ) : view === "matched" ? (
        matched
      ) : view === "exposure" ? (
        exposure
      ) : (
        <Suspense fallback={<p>Wczytywanie wykresu…</p>}>
          <MarketActivityChart stats={stats} view={view} />
        </Suspense>
      )}
    </section>
  );
}
