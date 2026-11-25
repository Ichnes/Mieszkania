import { PressureOverview } from "./PressureOverview";
import { BuyerBudget } from "./BuyerBudget";
import { useMemo, useState } from "react";
import { Select } from "../../components/Select";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buyerExposure,
  buyerTrend,
  compareListings,
  buyerMedian,
  buyerPriceCuts,
  type MarketStatsResponse,
  type BuyerObservation,
} from "@mieszkania/shared";

const fmt = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
const date = (day: number) =>
  new Date(day * 86400000).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
const areaBands = ["<60", "60–<80", "80–<100", "100+"];
const band = (area: number) => (area < 60 ? 0 : area < 80 ? 1 : area < 100 ? 2 : 3);
type Data = NonNullable<MarketStatsResponse["buyerMarket"]>;
export default function BuyerMarketPanel({ data, days }: { data: Data; days: number }) {
  const [district, setDistrict] = useState(""),
    [rooms, setRooms] = useState(""),
    [size, setSize] = useState<number | null>(null);
  const [ranking, setRanking] = useState("value"),
    [metric, setMetric] = useState("price");
  const { observations, today } = data;
  const districts = useMemo(
    () =>
      [...new Set(observations.map((r) => r.district))].sort((a, b) => a.localeCompare(b, "pl")),
    [observations],
  );
  const base = useMemo(
    () =>
      observations.filter(
        (r) => !rooms || (rooms === "5+" ? r.rooms >= 5 : r.rooms === Number(rooms)),
      ),
    [observations, rooms],
  );
  const rows = useMemo(
    () =>
      base.filter(
        (r) => (!district || r.district === district) && (size === null || band(r.area) === size),
      ),
    [base, district, size],
  );
  const weekly = useMemo(() => buyerTrend(rows, today, days), [rows, today, days]);
  const curve = useMemo(() => buyerExposure(rows, today, days), [rows, today, days]);
  const compared = useMemo(() => compareListings(rows, today), [rows, today]);
  const [limit, setLimit] = useState(8);
  const ranked = useMemo(
    () =>
      compared
        .filter(
          (v) =>
            ranking === "all" ||
            (ranking === "value" ? v.delta !== null && v.delta < 0 : v.signals.length > 0),
        )
        .sort((a, b) =>
          ranking === "all"
            ? a.row.price - b.row.price
            : ranking === "value"
              ? a.delta! - b.delta!
              : b.signals.length - a.signals.length || (a.net ?? 0) - (b.net ?? 0),
        ),
    [compared, ranking],
  );
  const heat = useMemo(() => {
    const groups = new Map<string, BuyerObservation[]>();
    for (const r of base)
      if (r.end === null) {
        const key = r.district + band(r.area);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
    return districts.map((d) => ({
      district: d,
      cells: areaBands.map((_, i) => {
        const g = groups.get(d + i) ?? [];
        const v =
          metric === "price"
            ? buyerMedian(g.map((r) => r.price / r.area))
            : metric === "age"
              ? buyerMedian(g.map((r) => today - r.start))
              : (100 *
                  g.filter((r) => buyerPriceCuts(r).some(([day]) => day > today - days)).length) /
                g.length;
        return { n: g.length, v: g.length >= 5 ? v : null };
      }),
    }));
  }, [base, districts, metric, today, days]);
  const values = heat.flatMap((r) => r.cells.flatMap((c) => (c.v === null ? [] : [c.v])));
  const min = Math.min(...values),
    max = Math.max(...values);
  const active = rows.filter((r) => r.end === null);
  const portals = new Map<string, { any: number; exclusive: number }>();
  for (const r of active)
    for (const name of r.portals ?? []) {
      const entry = portals.get(name) ?? { any: 0, exclusive: 0 };
      entry.any++;
      if (r.portals?.length === 1) entry.exclusive++;
      portals.set(name, entry);
    }
  return (
    <section className="buyer-monitor">
      <div className="buyer-monitor-head">
        <div>
          <p className="eyebrow">Monitor kupującego</p>
          <h2>Cena, czas i pole do negocjacji</h2>
        </div>
        <div className="buyer-control">
          <label>
            Dzielnica
            <Select label="Dzielnica w monitorze" value={district} onChange={setDistrict}>
              <option value="">Cała Warszawa</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </label>
          <label>
            Pokoje
            <Select label="Liczba pokoi w monitorze" value={rooms} onChange={setRooms}>
              <option value="">Wszystkie</option>
              {[...new Set(observations.map((r) => (r.rooms >= 5 ? "5+" : String(r.rooms))))]
                .sort()
                .map((r) => (
                  <option key={r}>{r}</option>
                ))}
            </Select>
          </label>
          {size !== null && (
            <button onClick={() => setSize(null)}>Metraż {areaBands[size]} m² ×</button>
          )}
        </div>
      </div>
      <PressureOverview
        frames={data.pressureFrames ?? []}
        rows={rows}
        day={today}
        days={days}
        district={district}
        rooms={rooms}
        size={size}
        districts={districts}
        onDistrict={(d) => {
          setDistrict(d);
          setRanking("signals");
          setLimit(8);
          document
            .getElementById("buyer-negotiations")
            ?.scrollIntoView({ behavior: "instant", block: "center" });
        }}
      />
      <div className="buyer-plot-grid">
        <article className="buyer-card">
          <p className="eyebrow">Ceny ofertowe</p>
          <h3>Indeks tych samych mieszkań</h3>
          <p className="muted">Cotygodniowe pary · początek serii = 100</p>
          {weekly.some((p) => p.index !== null) ? (
            <ResponsiveContainer width="100%" height={245}>
              <AreaChart data={weekly} margin={{ top: 16, right: 14, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="buyer-index-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#428a75" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#428a75" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 5" />
                <XAxis dataKey="day" tickFormatter={date} minTickGap={28} />
                <YAxis
                  domain={["auto", "auto"]}
                  width={50}
                  tickFormatter={(n) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const r = payload?.[0]?.payload;
                    return active && r ? (
                      <div className="market-chart-tooltip">
                        <strong>
                          {date(r.day)} · indeks {fmt(r.index)}
                        </strong>
                        <span>{r.pairs} dopasowanych par</span>
                        <span>
                          {r.stock} aktywnych · {r.drops} obniżek w tygodniu
                        </span>
                      </div>
                    ) : null;
                  }}
                />
                <Area
                  dataKey="index"
                  stroke="#2e8973"
                  strokeWidth={3}
                  fill="url(#buyer-index-gradient)"
                  isAnimationActive={false}
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p>Za mało par z ceną znaną na oba końce tygodnia.</p>
          )}
          <small>
            Średnia geometryczna zmian cen tych samych ogłoszeń, w tym bez zmian. Luka kończy serię.
            Każdy odcinek wymaga 5 par.
          </small>
        </article>
        <article className="buyer-card">
          <p className="eyebrow">Od pierwszej obserwacji</p>
          <h3>Jak długo oferta pozostaje na rynku?</h3>
          <div className="buyer-chart-key">
            <span>● Nadal aktywna</span>
            <span className="buyer-cut-key">● Pierwsza obniżka</span>
          </div>
          {curve.length ? (
            <ResponsiveContainer width="100%" height={245}>
              <ComposedChart data={curve} margin={{ top: 16, right: 14, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 5" />
                <XAxis dataKey="day" minTickGap={25} tickFormatter={(n) => n + " d"} />
                <YAxis domain={[0, 100]} width={44} tickFormatter={(n) => n + "%"} />
                <Tooltip
                  content={({ active, payload }) => {
                    const r = payload?.[0]?.payload;
                    return active && r ? (
                      <div className="market-chart-tooltip">
                        <strong>
                          Dzień {r.day} · {r.risk} w obserwacji
                        </strong>
                        <span>Nadal aktywne · {fmt(r.active)}%</span>
                        <span>Po pierwszej obniżce · {fmt(r.cut)}%</span>
                      </div>
                    ) : null;
                  }}
                />
                {[
                  ["active", "#2e8973"],
                  ["cut", "#c67b36"],
                ].map(([key, color]) => (
                  <Line
                    key={key}
                    dataKey={key}
                    stroke={color}
                    type="stepAfter"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p>Za mało ofert z obserwacją od dnia pierwszej ceny.</p>
          )}
          <small>
            Kohorta wykryta w wybranym okresie. Aktywne oferty są obserwacjami otwartymi.
            Archiwizacja kończy ekspozycję. Przy pierwszej obniżce uwzględniamy wycofania bez
            przeceny.
          </small>
        </article>
      </div>
      <div className="buyer-plot-grid">
        <article className="buyer-card">
          <p className="eyebrow">Dzielnica × metraż</p>
          <h3>Mapa segmentów</h3>
          <label>
            Miara{" "}
            <Select label="Miara na mapie segmentów" value={metric} onChange={setMetric}>
              <option value="price">Cena za m²</option>
              <option value="cuts">Oferty z obniżką</option>
              <option value="age">Wiek aktywnych ofert</option>
            </Select>
          </label>
          <div className="buyer-heat-scroll">
            <table className="buyer-heat">
              <thead>
                <tr>
                  <th>Dzielnica</th>
                  {areaBands.map((v) => (
                    <th key={v}>{v} m²</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat
                  .filter((r) => r.cells.some((c) => c.n))
                  .map((r) => (
                    <tr key={r.district}>
                      <th>{r.district}</th>
                      {r.cells.map((c, i) => (
                        <td key={i}>
                          <button
                            disabled={!c.n}
                            aria-pressed={r.district === district && size === i}
                            onClick={() => {
                              setDistrict(r.district);
                              setSize(i);
                              setRanking("all");
                              setLimit(8);
                            }}
                            style={{
                              backgroundColor:
                                c.v === null
                                  ? "var(--surface-muted)"
                                  : `color-mix(in srgb, #32967a ${12 + (42 * (c.v - min)) / (max - min || 1)}%, var(--surface))`,
                            }}
                          >
                            {c.v === null
                              ? "—"
                              : metric === "price"
                                ? fmt(c.v / 1000) + "k"
                                : fmt(c.v) + (metric === "cuts" ? "%" : " d")}
                            <small>n = {c.n}</small>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <small>
            Kliknij komórkę, aby zawęzić wykresy i listę mieszkań. Minimum 5 aktywnych ofert na
            wynik.
          </small>
        </article>
        <article className="buyer-card">
          <p className="eyebrow">Aktywne ogłoszenia</p>
          <h3>Mieszkania do sprawdzenia</h3>
          <label>
            Sortowanie{" "}
            <Select
              label="Sortowanie mieszkań do sprawdzenia"
              value={ranking}
              onChange={setRanking}
            >
              <option value="value">Najtaniej na tle podobnych</option>
              <option value="signals">Najwięcej przesłanek do negocjacji</option>
              <option value="all">Wszystkie w segmencie · od najtańszych</option>
            </Select>
          </label>
          <div className="buyer-list" id="buyer-negotiations">
            {ranked.slice(0, limit).map(({ row, delta, count, signals }) => (
              <a key={row.id} href={`/oferty?listing=${row.id}`}>
                <span>
                  <b>
                    {row.district} · {fmt(row.area)} m² · {row.rooms} pok.
                  </b>
                  <small>
                    {ranking === "all"
                      ? `${fmt(row.price / row.area)} zł/m²`
                      : ranking === "value"
                        ? `${count} porównań · ${fmt(row.price)} zł`
                        : signals.join(" · ")}
                  </small>
                </span>
                <strong>
                  {ranking === "all"
                    ? fmt(row.price) + " zł"
                    : ranking === "value"
                      ? fmt(delta!) + "%"
                      : signals.length + " sygn."}
                </strong>
              </a>
            ))}
          </div>
          {ranked.length > limit && (
            <button onClick={() => setLimit((n) => n + 12)}>
              Pokaż kolejne ({Math.min(limit, ranked.length)} z {ranked.length})
            </button>
          )}
          {!ranked.length && <p>Brak ofert spełniających warunki tego rankingu.</p>}
          <small>Otwórz mieszkanie, aby zobaczyć jego grupę porównawczą i historię.</small>
        </article>
      </div>
      <div className="buyer-plot-grid">
        <BuyerBudget active={active} today={today} />
        <article className="buyer-card">
          <p className="eyebrow">Zasięg portali</p>
          <h3>Gdzie występują te mieszkania?</h3>
          <div className="buyer-portal-bars">
            {[...portals]
              .sort((a, b) => b[1].any - a[1].any)
              .map(([name, n]) => (
                <div key={name}>
                  <b>{name}</b>
                  <span>
                    {fmt((100 * n.any) / active.length)}% · {n.any} mieszkań, w tym {n.exclusive}{" "}
                    wyłącznie tutaj
                  </span>
                  <progress value={n.any} max={active.length} />
                </div>
              ))}
          </div>
          <small>
            Aktywne mieszkania i zapisane źródła ich połączonych ogłoszeń. Jedno mieszkanie może
            wystąpić w kilku portalach.
          </small>
        </article>
      </div>
    </section>
  );
}
