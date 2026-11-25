import { SampleSizeIndicator } from "../../statistics/MarketIndicators";
import type { ImmediateSurroundingsFinding, MarketStatsResponse } from "@mieszkania/shared";
import { groupSurroundings } from "../lib/analysis-insights";

export function SurroundingsSummary({ findings }: { findings: ImmediateSurroundingsFinding[] }) {
  const groups = groupSurroundings(findings);
  return (
    <div className="surroundings-categories">
      <p className="muted">
        {groups.length} kategorii · odległość od punktu lokalizacji oferty. Odcinki tej samej
        infrastruktury pokazujemy łącznie.
      </p>
      {groups.map((group) => (
        <section className="insight-category" key={group.label}>
          <div className="section-topline">
            <h4>{group.label}</h4>
            <span className="pill">najbliżej {group.nearest} m</span>
          </div>
          {group.items.map((item) => (
            <details className="surroundings-category-details" key={item.category}>
              <summary>
                <strong>{item.label}</strong>
                <span>
                  {item.nearest} m · {item.members.length} oznaczeń OSM
                </span>
              </summary>
              <div className="surroundings-source-links">
                {item.members.map((finding) => (
                  <a key={finding.osmKey} href={finding.osmUrl} target="_blank" rel="noreferrer">
                    {finding.name} · {finding.distanceMeters} m
                  </a>
                ))}
              </div>
            </details>
          ))}
        </section>
      ))}
      <p className="parcel-card-note">
        Oznaczenie urzędu lub infrastruktury nie potwierdza uciążliwości. OSM może dzielić jedną
        linię kolejową na wiele odcinków.
      </p>
    </div>
  );
}

export function MarketPulse({ stats }: { stats: MarketStatsResponse }) {
  const signals = stats.signals;
  const number = (value: number) => value.toLocaleString("pl-PL");
  const share = (value: number) =>
    signals?.active ? Math.round((value / signals.active) * 100) : 0;
  return (
    <section className="panel market-pulse">
      <div className="section-topline">
        <div>
          <p className="eyebrow">Sygnały rynku · {stats.periodDays} dni</p>
          <h3>Co zdradza historia ogłoszeń</h3>
        </div>
        <span className="pill">
          {number(signals?.active ?? stats.totals.active)} aktywnych ofert
        </span>
      </div>
      {stats.scope ? (
        <p className="market-scope">
          {stats.scope.city} · od {stats.scope.minArea} m²
          {stats.scope.maxArea ? ` do ${stats.scope.maxArea} m²` : ""} · {stats.scope.roomsMin}+
          pokoi · {number(stats.scope.minPrice)}–{number(stats.scope.maxPrice)} zł.
        </p>
      ) : null}
      {signals ? (
        <div className="market-signal-grid">
          <article className="insight-category">
            <span className="eyebrow">Rzeczywiste przeceny</span>
            <strong className="insight-number">
              {signals.medianCutAmount == null
                ? "Brak obniżek"
                : `−${number(Math.round(signals.medianCutAmount))} zł`}
            </strong>
            <p>
              Mediana ostatniej obniżki w okresie
              {signals.medianCutPercent == null
                ? "."
                : ` · ${number(signals.medianCutPercent)}%.`}{" "}
              Dotyczy {number(signals.discounted)} aktywnych ofert z {number(signals.active)}.
            </p>
          </article>
          <article className="insight-category">
            <span className="eyebrow">Kolejna obniżka</span>
            <strong className="insight-number">{number(signals.repeatedCuts)}</strong>
            <p>Ofert z co najmniej dwiema obniżkami w ciągu {stats.periodDays} dni.</p>
          </article>
          <article className="insight-category">
            <span className="eyebrow">Najdłużej obserwowane</span>
            <strong className="insight-number">
              {signals.active ? share(signals.oldestObserved) + "%" : "Brak danych"}{" "}
              <small>· {number(signals.oldestObserved)} ofert</small>
            </strong>
            <p>
              {signals.active === 0
                ? "Brak aktywnych ofert w tej próbie."
                : signals.observationDays === 0
                  ? "Historia krótsza niż jeden dzień — pokazujemy oferty z pierwszego dnia obserwacji."
                  : `Aktywne i obserwowane od co najmniej ${signals.observationDays} dni — najdłuższa dostępna historia w tej próbie.`}
            </p>
          </article>
          <article className="insight-category market-pressure">
            <span className="eyebrow">Gdzie częściej obniżają ceny</span>
            {signals.pressureDistricts.length ? (
              signals.pressureDistricts.map((district) => (
                <div className="market-pressure-row" key={district.district}>
                  <div>
                    <strong>{district.district}</strong>
                    <span>{district.sharePercent}%</span>
                  </div>
                  <progress max="100" value={district.sharePercent} />
                  <small>
                    {district.discounted} z {district.active} aktywnych miało obniżkę
                  </small>
                  <SampleSizeIndicator count={district.active} unit="ofert" />
                </div>
              ))
            ) : (
              <p>Brak dzielnic z obniżką i próbą co najmniej 5 aktywnych ofert.</p>
            )}
          </article>
        </div>
      ) : (
        <p>Brak danych do analizy historii cen.</p>
      )}
      {signals && (
        <details className="market-signal-detail">
          <summary>Zakres i aktualność sygnałów</summary>
          <p className="muted market-signal-note">
            Dla połączonych publikacji śledzimy najniższą dostępną cenę. Wiek liczymy od pierwszej
            obserwacji. Aktualność próby: {number(signals?.freshLast48Hours ?? 0)} z{" "}
            {number(signals?.active ?? 0)} aktywnych ofert sprawdzonych przez ostatnie 48 godzin. To
            ceny ofertowe; obniżka ani archiwizacja nie potwierdza ceny sprzedaży.
          </p>
        </details>
      )}
    </section>
  );
}
