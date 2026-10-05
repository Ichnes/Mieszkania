import { useState } from "react";
import type { DashboardStat } from "@mieszkania/shared";

export function OverviewStat({ stat }: { stat: DashboardStat }) {
  const [period, setPeriod] = useState<7 | 30 | 180>(7);
  const displayed = stat.periodValues?.[period] ?? stat;
  return (
    <div className="hero-stat" title={displayed.description}>
      <span>{displayed.label}</span>
      <div aria-live={stat.periodValues ? "polite" : undefined} aria-atomic="true">
        <strong>{displayed.value}</strong>
        {displayed.trend ? <small>{displayed.trend}</small> : null}
      </div>
      {stat.periodValues && (
        <div
          className="stats-period-bar overview-period-bar"
          role="group"
          aria-label={`Okres: ${stat.label.replace(/ \/ 7 dni$/, "")}`}
        >
          {([7, 30, 180] as const).map((days) => (
            <button
              key={days}
              type="button"
              className={period === days ? "is-active" : ""}
              aria-pressed={period === days}
              onClick={() => setPeriod(days)}
            >
              {days} dni
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
