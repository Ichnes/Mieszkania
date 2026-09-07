import type { ImmediateSurroundingsFinding, MarketStatsResponse } from "@mieszkania/shared";
import { analyzeDescription, groupSurroundings } from "../lib/analysis-insights";

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

export function DescriptionReview({
  description,
  floor,
}: {
  description?: string;
  floor?: number;
}) {
  const insights = analyzeDescription(description ?? "", floor);
  if (!insights.length) return null;
  return (
    <section className="description-review">
      <p className="eyebrow">Przygotuj się do rozmowy</p>
      <h3>Co sprawdzić w tej ofercie</h3>
      <p className="muted">Konkretne warunki z opisu, ich znaczenie i pytania do sprzedającego.</p>
      <div className="insight-card-grid">
        {insights.map((insight) => (
          <article className="insight-category" key={insight.key}>
            <h4>{insight.label}</h4>
            <blockquote>{insight.evidence}</blockquote>
            <p className="review-reason">{insight.reason}</p>
            <p>
              <strong>Zapytaj: </strong>
              {insight.question}
            </p>
          </article>
        ))}
      </div>
    </section>
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
          pokoi · {number(stats.scope.minPrice)}–{number(stats.scope.maxPrice)} zł. Zakres zgodny z
          Waszymi kryteriami i filtrami.
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
                : ` · ${signals.medianCutPercent.toFixed(1)}%.`}{" "}
              Dotyczy {number(signals.discounted)} aktywnych ofert ({share(signals.discounted)}%).
            </p>
            <small>
              Porównujemy kolejne ceny tego samego ogłoszenia, więc wyniku nie zmienia sam napływ
              droższych mieszkań.
            </small>
          </article>
          <article className="insight-category">
            <span className="eyebrow">Kolejna obniżka</span>
            <strong className="insight-number">{number(signals.repeatedCuts)}</strong>
            <p>Ofert z co najmniej dwiema obniżkami w ciągu {stats.periodDays} dni.</p>
            <small>
              Powtarzające się korekty są powodem, żeby przyjrzeć się historii ceny przed rozmową o
              budżecie.
            </small>
          </article>
          <article className="insight-category">
            <span className="eyebrow">Najdłużej obserwowane</span>
            <strong className="insight-number">
              {share(signals.oldestObserved)}%{" "}
              <small>· {number(signals.oldestObserved)} ofert</small>
            </strong>
            <p>
              {signals.active === 0
                ? "Brak aktywnych ofert w tej próbie."
                : signals.observationDays === 0
                  ? "Historia krótsza niż jeden dzień — pokazujemy oferty z pierwszego dnia obserwacji."
                  : `Aktywne i obserwowane od co najmniej ${signals.observationDays} dni — najdłuższa dostępna historia w tej próbie.`}
            </p>
            <small>
              Czas liczymy od pierwszej obserwacji. Ponowne wystawienie lub późne wykrycie może
              skrócić tę historię.
            </small>
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
                    {district.discounted} przecenionych / {district.active} aktywnych ofert
                  </small>
                </div>
              ))
            ) : (
              <p>Za mało danych: minimum 20 aktywnych ofert i 3 przecenione w dzielnicy.</p>
            )}
          </article>
        </div>
      ) : (
        <p>Brak danych do analizy historii cen.</p>
      )}
      <p className="muted market-signal-note">
        Aktualność próby: {number(signals?.freshLast48Hours ?? 0)} z {number(signals?.active ?? 0)}{" "}
        aktywnych ofert sprawdzonych przez ostatnie 48 godzin. To ceny ofertowe; obniżka ani
        archiwizacja nie potwierdza ceny sprzedaży.
      </p>
    </section>
  );
}
