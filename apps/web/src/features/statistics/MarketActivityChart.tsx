import type { MarketStatsResponse } from "@mieszkania/shared";
import { useState } from "react";
import { Select } from "../../components/Select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const shortDate = (week: string) =>
  new Date(week + "T12:00:00").toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
const money = (value: number | null | undefined) =>
  value == null ? "Brak danych" : Math.round(value).toLocaleString("pl-PL") + " zł/m²";

export default function MarketActivityChart({ stats }: { stats: MarketStatsResponse }) {
  const [week, setWeek] = useState("");
  const selected = stats.activity.find((row) => row.week === week);
  const balance = stats.activity.map((row) => ({
    ...row,
    balance: row.newListings - row.archivedListings,
  }));
  const moves = stats.districts
    .filter((d) => d.priceDrops + d.priceIncreases > 0)
    .sort((a, b) => b.priceDrops + b.priceIncreases - a.priceDrops - a.priceIncreases)
    .slice(0, 6);
  return (
    <>
      <div className="panel stats-activity">
        <div className="stats-card-heading">
          <div>
            <p className="eyebrow">Rynek w czasie</p>
            <h3>Ceny i liczba ofert — tygodniowo</h3>
          </div>
          <span>{stats.periodDays} dni</span>
        </div>
        <div className="stats-chart-legend">
          <span className="is-new">Wykryte przez aplikację</span>
          <span className="is-archived">Zarchiwizowane</span>
          <span className="is-price">Mediana cen wykrytych</span>
          <span className="is-average">Średnia cen wszystkich aktywnych</span>
          <span>Mediana aktywnych</span>
        </div>
        <ResponsiveContainer width="100%" height={325}>
          <LineChart
            data={stats.activity}
            onClick={(state) => {
              if (typeof state.activeLabel === "string") setWeek(state.activeLabel);
            }}
          >
            <XAxis
              dataKey="week"
              tickFormatter={(value) =>
                new Date(`${value}T12:00:00`).toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "2-digit",
                })
              }
              minTickGap={24}
            />
            <YAxis yAxisId="offers" width={36} />
            <YAxis
              yAxisId="price"
              orientation="right"
              width={56}
              tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
            />
            <Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const row = stats.activity.find((point) => point.week === label);
                if (!row) return null;
                const values = [
                  ["Wykryte", row.newListings.toLocaleString("pl-PL"), "#287b68"],
                  ["Zarchiwizowane", row.archivedListings.toLocaleString("pl-PL"), "#b75d4a"],
                  ["Mediana wykrytych", money(row.medianPricePerSqm), "#df9a3f"],
                  ["Średnia aktywnych", money(row.averagePricePerSqm), "#6e72cd"],
                  ["Mediana aktywnych", money(row.activeMedianPricePerSqm), "#197c96"],
                ];
                return (
                  <div className="market-chart-tooltip">
                    <strong>
                      Tydzień od {new Date(row.week + "T12:00:00").toLocaleDateString("pl-PL")}
                    </strong>
                    {values.map(([name, value, color]) => (
                      <div key={name}>
                        <span>
                          <i aria-hidden="true" style={{ backgroundColor: color }} />
                          {name}
                        </span>
                        <b>{value}</b>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Line
              yAxisId="offers"
              type="monotone"
              dataKey="newListings"
              stroke="#287b68"
              strokeWidth={3}
              dot={false}
            />
            {selected && (
              <ReferenceLine
                x={selected.week}
                yAxisId="offers"
                stroke="currentColor"
                strokeDasharray="4 4"
              />
            )}
            <Line
              yAxisId="price"
              dataKey="activeMedianPricePerSqm"
              stroke="#197c96"
              strokeDasharray="6 3"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="offers"
              type="monotone"
              dataKey="archivedListings"
              stroke="#b75d4a"
              strokeWidth={3}
              dot={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="medianPricePerSqm"
              stroke="#df9a3f"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="averagePricePerSqm"
              stroke="#6e72cd"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {stats.activity.length > 0 && (
          <div className="stats-week-selection">
            <label>
              Wybrany tydzień{" "}
              <Select label="Wybrany tydzień" value={selected?.week ?? ""} onChange={setWeek}>
                <option value="">Wybierz na wykresie lub z listy</option>
                {stats.activity.map((row) => (
                  <option key={row.week} value={row.week}>
                    {row.week}
                  </option>
                ))}
              </Select>
            </label>
            {selected && (
              <p role="status">
                Wykryte: {selected.newListings} · Zarchiwizowane: {selected.archivedListings} ·
                Mediana wykrytych: {money(selected.medianPricePerSqm)} · Średnia aktywnych:{" "}
                {money(selected.averagePricePerSqm)} · Mediana aktywnych:{" "}
                {money(selected.activeMedianPricePerSqm)}
              </p>
            )}
          </div>
        )}
        <p className="muted">
          Ceny za m². Średnia obejmuje oferty aktywne na koniec tygodnia (w bieżącym — do teraz), w
          wybranym zakresie filtrów. Obie miary wymagają potwierdzonej ceny z danego okresu. Mediana
          dotyczy ofert wykrytych w danym tygodniu.
        </p>
      </div>
      <section className="panel stats-activity stats-weekly-balance">
        <h3>Bilans ofert w tygodniu</h3>
        <p className="muted">Liczba wykrytych ofert pomniejszona o liczbę zarchiwizowanych.</p>
        {balance.length ? (
          <div className="weekly-balance-plot">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balance}>
                <XAxis dataKey="week" tickFormatter={shortDate} minTickGap={24} />
                <YAxis width={38} allowDecimals={false} />
                <ReferenceLine y={0} stroke="currentColor" />
                <Tooltip
                  cursor={{ fill: "currentColor", fillOpacity: 0.08 }}
                  content={({ active, label }) => {
                    const row = active && balance.find((point) => point.week === label);
                    if (!row) return null;
                    return (
                      <div className="market-chart-tooltip">
                        <strong>
                          Tydzień od {new Date(row.week + "T12:00:00").toLocaleDateString("pl-PL")}
                        </strong>
                        <div>
                          <span>Wykryte</span>
                          <b>{row.newListings.toLocaleString("pl-PL")}</b>
                        </div>
                        <div>
                          <span>Zarchiwizowane</span>
                          <b>{row.archivedListings.toLocaleString("pl-PL")}</b>
                        </div>
                        <div className="weekly-balance-total">
                          <strong>Bilans</strong>
                          <b>
                            {row.balance.toLocaleString("pl-PL", { signDisplay: "exceptZero" })}
                          </b>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="balance" name="Bilans ofert" fill="#287b68" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>Brak danych dla wybranego okresu.</p>
        )}
      </section>
      <section className="panel stats-activity">
        <h3>Obniżki i podwyżki według dzielnicy</h3>
        <p className="muted">
          Aktywne oferty z obniżką lub podwyżką w wybranym okresie. Każda oferta liczy się raz w
          danym kierunku. Pokazujemy do sześciu dzielnic.
        </p>
        {moves.length ? (
          <>
            <div className="stats-chart-legend">
              <span className="is-new">Obniżki</span>
              <span className="is-archived">Podwyżki</span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(150, moves.length * 59 + 35)}>
              <BarChart data={moves} layout="vertical" barGap={5} margin={{ right: 36, left: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--ink)", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="district"
                  width={110}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--ink)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--ink)", fillOpacity: 0.06 }}
                  content={({ active, label, payload }) =>
                    active && payload?.length ? (
                      <div className="market-chart-tooltip">
                        <strong>{label}</strong>
                        {payload.map((item) => (
                          <div key={String(item.dataKey)}>
                            <span>{item.name}</span>
                            <b>{item.value?.toLocaleString("pl-PL")}</b>
                          </div>
                        ))}
                      </div>
                    ) : null
                  }
                />
                <Bar
                  dataKey="priceDrops"
                  name="Obniżki"
                  fill="#287b68"
                  barSize={12}
                  radius={[0, 5, 5, 0]}
                >
                  <LabelList
                    dataKey="priceDrops"
                    position="right"
                    fill="var(--ink)"
                    fontSize={12}
                  />
                </Bar>
                <Bar
                  dataKey="priceIncreases"
                  name="Podwyżki"
                  fill="#b75d4a"
                  barSize={12}
                  radius={[0, 5, 5, 0]}
                >
                  <LabelList
                    dataKey="priceIncreases"
                    position="right"
                    fill="var(--ink)"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p>Brak zmian cen dla wybranych filtrów.</p>
        )}
      </section>
    </>
  );
}
