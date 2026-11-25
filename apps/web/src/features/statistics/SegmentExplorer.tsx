import { useState } from "react";
import type { MarketStatsResponse } from "@mieszkania/shared";
import { Select } from "../../components/Select";
export function SegmentExplorer({ stats }: { stats: MarketStatsResponse }) {
  const [dimension, setDimension] = useState("Liczba pokoi");
  const groups = [
    { title: "Liczba pokoi", items: stats.segments.rooms },
    { title: "Metraż", items: stats.segments.areas },
    { title: "Rok budowy", items: stats.segments.buildingAge },
    { title: "Rynek", items: stats.segments.marketTypes },
    { title: "Stan wykończenia", items: stats.segments.finishing ?? [] },
    { title: "Czynsz miesięczny", items: stats.segments.monthlyFees ?? [] },
    { title: "Źródła ofert", items: stats.segments.sources },
  ];
  const segment = groups.find((g) => g.title === dimension)!;
  const valid = segment.items.filter(
    (i) =>
      i.sufficientSample &&
      i.lowerQuartilePricePerSqm != null &&
      i.upperQuartilePricePerSqm != null,
  );
  const low = Math.min(...valid.map((i) => i.lowerQuartilePricePerSqm!)),
    high = Math.max(...valid.map((i) => i.upperQuartilePricePerSqm!));
  const position = (n: number) => (high === low ? 50 : (100 * (n - low)) / (high - low));
  const formatPrice = (n: number) => Math.round(n).toLocaleString("pl-PL") + " zł/m²";
  return (
    <div className="panel stats-segment-card">
      <div className="stats-card-heading">
        <div>
          <p className="eyebrow">Struktura wykrytych · {stats.periodDays} dni</p>
          <h3>Struktura ofert</h3>
          {segment.title === "Stan wykończenia" && (
            <p className="stats-segment-hint">
              Stan podany w ogłoszeniu lub rozpoznany z opisu. Ceny ofertowe za m².
            </p>
          )}
          {segment.title === "Czynsz miesięczny" && (
            <p className="stats-segment-hint">
              Aktywne i archiwalne oferty wykryte w wybranym okresie. Czynsz może pochodzić z
              połączonego ogłoszenia. Mediana i zakres pokazują ceny ofertowe za m².
            </p>
          )}
          {segment.title === "Metraż" && (
            <p className="stats-segment-hint">
              Dolna granica włącznie, górna wyłącznie. Bez zaokrąglania metrażu.
            </p>
          )}
        </div>
      </div>
      <label className="analysis-selector">
        Podział ofert
        <Select label="Podział ofert" value={dimension} onChange={setDimension}>
          {groups.map((g) => (
            <option key={g.title}>{g.title}</option>
          ))}
        </Select>
      </label>
      {valid.length > 0 && (
        <small className="quartile-key">
          Odcinek pokazuje środkowe 50% cen za m², kreska oznacza medianę. Skala jest wspólna dla
          widocznych grup.
        </small>
      )}
      {!segment.items.length && <p>Brak ofert w tym podziale.</p>}
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
            {item.sufficientSample &&
              item.medianPricePerSqm != null &&
              item.lowerQuartilePricePerSqm != null &&
              item.upperQuartilePricePerSqm != null && (
                <div className="quartile-track" aria-hidden="true">
                  <i
                    style={{
                      left: position(item.lowerQuartilePricePerSqm) + "%",
                      width:
                        position(item.upperQuartilePricePerSqm) -
                        position(item.lowerQuartilePricePerSqm) +
                        "%",
                    }}
                  />
                  <b style={{ left: position(item.medianPricePerSqm) + "%" }} />
                </div>
              )}
            {item.sufficientSample && valid.length > 0 && (
              <div className="quartile-axis">
                <span>{formatPrice(low)}</span>
                <span>{formatPrice(high)}</span>
              </div>
            )}
            <small className="priced-sample">
              {item.pricedListings.toLocaleString("pl-PL")} ofert z ceną i metrażem
            </small>
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
                      {Math.round(item.upperQuartilePricePerSqm!).toLocaleString("pl-PL")} zł/m²
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
  );
}
