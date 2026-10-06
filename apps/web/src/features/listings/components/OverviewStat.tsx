import type { DashboardStat } from "@mieszkania/shared";

export function OverviewStat({ stat, period }: { stat: DashboardStat; period: 7 | 30 | 60 }) {
  const displayed = stat.periodValues?.[period] ?? stat;
  return (
    <div className="hero-stat" title={displayed.description}>
      <span>{displayed.label}</span>
      <div aria-live={stat.periodValues ? "polite" : undefined} aria-atomic="true">
        <strong>{displayed.value}</strong>
        {displayed.trend ? <small>{displayed.trend}</small> : null}
      </div>
    </div>
  );
}
