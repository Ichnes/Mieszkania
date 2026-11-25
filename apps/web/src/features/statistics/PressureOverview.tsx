import { useMemo } from "react";
import { SegmentedLinearGauge, SampleSizeIndicator } from "./MarketIndicators";
import { Select } from "../../components/Select";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buyerMedian,
  buyerPriceCuts,
  calibratedPressure,
  pressureKey,
  type BuyerObservation,
  type PressureFrame,
} from "@mieszkania/shared";
const number = (v: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
const percent = (v: number | null) => (v === null ? "Brak danych" : number(v) + "%");
const ageBands = [
  [0, 14],
  [15, 30],
  [31, 60],
  [61, 90],
  [91, 120],
  [121, Infinity],
];
function observations(rows: BuyerObservation[], today: number, days: number) {
  const active = rows.filter((r) => r.end === null),
    archived = rows.filter((r) => r.end !== null);
  const bands = ageBands.map(() => ({ n: 0, cuts: [] as number[] }));
  const amounts: number[] = [],
    percentages: number[] = [],
    firstDays: number[] = [];
  let down = 0,
    up = 0;
  const shares = [
    { n: 0, cuts: 0 },
    { n: 0, cuts: 0 },
  ];
  for (const r of rows) {
    const end = r.end ?? today,
      age = end - r.start;
    const events = r.history.filter(([d]) => d <= end);
    if (!events.length) continue;
    const first = events[0],
      last = events[events.length - 1];
    let discounted = false;
    for (let i = 1; i < events.length; i++) {
      const [d, v] = events[i];
      if (d <= today - days) continue;
      if (v < events[i - 1][1]) {
        down++;
        discounted = true;
      } else if (v > events[i - 1][1]) up++;
    }
    if (first[0] <= Math.max(today - days, r.start)) {
      const group = shares[r.end === null ? 0 : 1];
      group.n++;
      if (discounted) group.cuts++;
    }
    if (first[0] !== r.start) continue;
    const b = bands[ageBands.findIndex(([min, max]) => age >= min && age <= max)];
    if (!b) continue;
    b.n++;
    const net = 100 * (last[1] / first[1] - 1);
    if (net < 0) {
      b.cuts.push(net);
      if (r.end === null) {
        amounts.push(first[1] - last[1]);
        percentages.push(-net);
      }
    }
    const cut = buyerPriceCuts(r).find(([d]) => d <= end);
    if (cut) firstDays.push(cut[0] - r.start);
  }
  const ages = archived.map((r) => r.end! - r.start).sort((a, b) => a - b);
  return {
    active: active.length,
    archived: archived.length,
    bands,
    amount: buyerMedian(amounts),
    pct: buyerMedian(percentages),
    shares,
    first: buyerMedian(firstDays),
    down,
    up,
    aged: active.length
      ? (100 * active.filter((r) => today - r.start >= 90).length) / active.length
      : null,
    age:
      ages.length >= 5
        ? `${ages[Math.floor((ages.length - 1) * 0.25)]}–${ages[Math.ceil((ages.length - 1) * 0.75)]} dni`
        : "Brak danych",
  };
}
type Props = {
  frames: PressureFrame[];
  rows: BuyerObservation[];
  day: number;
  days: number;
  district: string;
  rooms: string;
  size: number | null;
  districts: string[];
  onDistrict: (d: string) => void;
};
export function PressureOverview({
  frames,
  rows,
  day,
  days,
  district,
  rooms,
  size,
  districts,
  onDistrict,
}: Props) {
  const key = pressureKey(district, rooms, size);
  const model = calibratedPressure(frames, key, day);
  const level =
    model.score === null
      ? null
      : [
          "Bardzo niska presja",
          "Niska presja",
          "Typowa presja",
          "Wysoka presja",
          "Bardzo wysoka presja",
        ][Math.min(4, Math.max(0, Math.ceil(model.score / 20) - 1))];
  const data = useMemo(() => observations(rows, day, days), [rows, day, days]);
  const comparableFrames = frames.filter((f) => Boolean(f.replayed) === model.preliminary);
  const current = comparableFrames.find((f) => f.day === day)?.groups[key],
    supply = current?.values.supply;
  const share = (i: number) =>
    data.shares[i].n ? percent((100 * data.shares[i].cuts) / data.shares[i].n) : "Brak danych";
  const delta = (lag: number) => {
    const earlier = calibratedPressure(frames, key, day - lag);
    return model.score !== null &&
      earlier.score !== null &&
      earlier.preliminary === model.preliminary &&
      earlier.coverage === model.coverage &&
      earlier.components.every(
        (p, i) => (p.points === null) === (model.components[i].points === null),
      )
      ? (model.score - earlier.score).toLocaleString("pl-PL", {
          maximumFractionDigits: 1,
          signDisplay: "exceptZero",
        }) + " pkt"
      : "Brak porównania";
  };
  const series = comparableFrames
    .filter((f) => f.day >= day - 360)
    .map((f) => ({
      date: new Date(f.day * 86400000).toLocaleDateString("pl-PL", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      value: calibratedPressure(frames, key, f.day).score,
    }));
  const ranking = districts
    .map((d) => ({ d, index: calibratedPressure(frames, pressureKey(d, rooms, size), day) }))
    .filter(
      (r) =>
        r.index.score !== null &&
        r.index.preliminary === model.preliminary &&
        r.index.components.every(
          (p, i) => (p.points === null) === (model.components[i].points === null),
        ),
    )
    .sort((a, b) => b.index.score! - a.index.score!);
  const metrics = [
    [
      "Obniżka w historii cen · aktywne",
      share(0),
      `${number(data.shares[0].cuts)} z ${number(data.shares[0].n)} z ceną odniesienia · archiwalne: ${share(1)} (${number(data.shares[1].cuts)} z ${number(data.shares[1].n)})`,
    ],
    [
      "Mediana łącznej przeceny",
      data.amount === null ? "Brak danych" : number(data.amount) + " zł",
      data.pct === null
        ? "Brak pełnej historii przeceny"
        : "Mediana procentowa: " + percent(data.pct),
    ],
    ["Czas ekspozycji", data.age, "Środkowe 50% archiwalnych"],
    [
      "Czas do pierwszej obniżki",
      data.first === null ? "Brak danych" : number(data.first) + " dni",
      "Mediana wśród ofert z obniżką",
    ],
    ["Oferty zalegające 90+ dni", percent(data.aged), "Udział w aktywnych ofertach"],
    [
      "Obniżki do podwyżek",
      data.shares.some((s) => s.n > 0) ? data.down + " : " + data.up : "Brak danych",
      `Zdarzenia cenowe · ${days} dni`,
    ],
    [
      "Zmiana aktywnej podaży",
      percent(supply == null ? null : 100 * supply),
      "Względem zapisu sprzed 30 dni",
    ],
  ];
  const renderMetric = ([label, value, sub]: string[]) => (
    <div key={label}>
      <small>{label}</small>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
  return (
    <>
      <section className="pressure-lead" aria-label="Indeks presji na sprzedających">
        <div>
          <p className="eyebrow">Indeks presji na sprzedających · 30 dni</p>
          <h3>{level ?? "W kalibracji"}</h3>
          <p>
            {model.score === null
              ? "Za mało porównywalnych danych do oceny segmentu."
              : "Względem wcześniejszych obserwacji tego samego segmentu."}
          </p>
          <SampleSizeIndicator
            count={current?.active}
            unit={model.preliminary ? "publikacji" : "mieszkań"}
          />
          <small>
            {model.preliminary ? "Wynik wstępny · " : ""}pokrycie wag {model.coverage}%
          </small>
        </div>
        <div>
          <SegmentedLinearGauge score={model.score} />
          <div className="pressure-deltas">
            <span>
              W ciągu 30 dni <b>{delta(30)}</b>
            </span>
            <span>
              W ciągu 90 dni <b>{delta(90)}</b>
            </span>
          </div>
        </div>
      </section>
      <div className="buyer-summary">{metrics.slice(0, 3).map(renderMetric)}</div>
      <details className="buyer-method">
        <summary>Więcej wskaźników · ekspozycja, ceny i podaż</summary>
        <div className="buyer-summary">{metrics.slice(3).map(renderMetric)}</div>
      </details>
      <details className="buyer-method">
        <summary>Jak liczymy indeks i jaki jest zakres obserwacji?</summary>
        <section>
          <p>
            Udziały w monitorze liczymy dla ofert ze znaną ceną na początku okresu lub obserwacji.
            Zliczamy spadek między kolejnymi zapisami cen. W podsumowaniu rynku mianownikiem są
            wszystkie aktywne oferty, a licznikiem oferty z zapisanym zdarzeniem obniżki.
          </p>
          <h3>Eksperymentalny indeks presji na sprzedających</h3>
          <p>
            Wynik wstępny wykorzystuje co najmniej dwa wcześniejsze okresy z zapisanych wersji
            ogłoszeń portali. Porównujemy stan znany w każdym dniu pomiaru. W tej serii ten sam
            lokal na dwóch portalach może wystąpić dwukrotnie. Pomijamy niepotwierdzone historyczne
            powroty. Docelowy wynik wykorzystuje zapisy po usunięciu duplikatów.
          </p>
          <p>
            {data.active} aktywnych i {data.archived} zarchiwizowanych w wybranym okresie. Poziom 50
            oznacza środek historycznych obserwacji tego segmentu. Wyższy wynik oznacza więcej
            presji widocznej w ogłoszeniach. Indeks nie mierzy popytu transakcyjnego.
          </p>
          <p>
            Porównujemy ostatnie 30 dni z maksymalnie 12 wcześniejszymi zapisami co 30 dni. W serii
            docelowej każda składowa wymaga sześciu historycznych porównań i co najmniej 5 aktywnych
            ofert w segmencie. Przy pokryciu co najmniej 70% skalujemy dostępne wagi do 100%.
            Poniżej progu wynik pozostaje niepełny. Wagi są robocze, a część sygnałów może być
            skorelowana.
          </p>
          <dl>
            {model.components.map((p) => (
              <div key={p.key}>
                <dt>
                  {p.label} · {p.weight}%
                </dt>
                <dd>
                  {p.points === null
                    ? "Brak oceny"
                    : p.points.toLocaleString("pl-PL", {
                        maximumFractionDigits: 1,
                        signDisplay: "exceptZero",
                      }) + " pkt"}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Zmiana przez 30 dni · {delta(30)}　|　90 dni · {delta(90)}
          </p>
          {series.some((p) => p.value !== null) && (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} width={32} />
                <ReferenceLine y={50} strokeDasharray="4 4" />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="market-chart-tooltip">
                        <strong>{payload[0].payload.date}</strong>
                        <span>{number(Number(payload[0].value))} / 100</span>
                      </div>
                    ) : null
                  }
                />
                <Area
                  dataKey="value"
                  name="Indeks"
                  stroke="#287b68"
                  fill="#86b8a3"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </section>
      </details>
      <div className="buyer-plot-grid">
        <article className="buyer-card">
          <h3>Presja cenowa według wieku ogłoszenia</h3>
          <p className="muted">
            Ostatnia znana cena względem pierwszej. Wiek liczymy do dziś lub do archiwizacji.
          </p>
          <table className="pressure-age">
            <thead>
              <tr>
                <th>Wiek</th>
                <th>Oferta tańsza niż na początku</th>
                <th>Mediana przeceny</th>
              </tr>
            </thead>
            <tbody>
              {data.bands.map((b, i) => (
                <tr key={i}>
                  <th>
                    {i === 5 ? "Ponad 120" : ageBands[i].join("–")} dni<small>n = {b.n}</small>
                  </th>
                  <td>{b.n ? percent((100 * b.cuts.length) / b.n) : "—"}</td>
                  <td>{b.cuts.length ? percent(buyerMedian(b.cuts)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <small>
            Udział wśród ofert z historią od pierwszego dnia. Mediana dotyczy wyłącznie
            przecenionych.
          </small>
        </article>
        <article className="buyer-card">
          <h3>Presja na sprzedających według dzielnicy</h3>
          {ranking.length ? (
            ranking.map((r) => (
              <button className="pressure-rank" key={r.d} onClick={() => onDistrict(r.d)}>
                {r.d}
                <b>{number(r.index.score!)} / 100</b>
              </button>
            ))
          ) : (
            <p>
              Ranking wymaga wspólnego zestawu dostępnych składowych dla porównywanych dzielnic. Już
              teraz możesz sprawdzić sygnały negocjacyjne konkretnych ofert.
            </p>
          )}
          {!ranking.length && (
            <label>
              Sprawdź dzielnicę{" "}
              <Select
                label="Dzielnica do analizy negocjacji"
                value={district}
                onChange={onDistrict}
              >
                <option value="">Cała Warszawa</option>
                {districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </label>
          )}
        </article>
      </div>
    </>
  );
}
