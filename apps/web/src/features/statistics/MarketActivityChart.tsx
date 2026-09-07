import type { MarketStatsResponse } from "@mieszkania/shared";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function MarketActivityChart({ stats }: { stats: MarketStatsResponse }) {
  return (
    <div className="panel stats-activity">
      <div className="stats-card-heading">
        <div>
          <p className="eyebrow">Przepływ ofert</p>
          <h3>Wykryte i zarchiwizowane tygodniowo</h3>
        </div>
        <span>{stats.periodDays} dni</span>
      </div>
      <div className="stats-chart-legend">
        <span className="is-new">Wykryte przez aplikację</span>
        <span className="is-archived">Zarchiwizowane</span>
        <span className="is-price">Mediana ceny wykrytych</span>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={stats.activity}>
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
            labelFormatter={(value) =>
              `Tydzień od ${new Date(`${value}T12:00:00`).toLocaleDateString("pl-PL")}`
            }
            formatter={(value, name) => [
              Number(value).toLocaleString("pl-PL"),
              name === "newListings"
                ? "Wykryte"
                : name === "archivedListings"
                  ? "Zarchiwizowane"
                  : "Mediana zł/m²",
            ]}
          />
          <Line
            yAxisId="offers"
            type="monotone"
            dataKey="newListings"
            stroke="#287b68"
            strokeWidth={3}
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
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
