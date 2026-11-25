import type { DashboardStat } from "@mieszkania/shared";
import { ArrowRight } from "lucide-react";

export function OverviewStat({
  stat,
  period,
  onOpen,
}: {
  stat: DashboardStat;
  period: 7 | 30 | 60;
  onOpen?: () => void;
}) {
  const displayed = stat.periodValues?.[period] ?? stat;
  const Tile = onOpen ? "button" : "div";
  return (
    <Tile
      className="hero-stat"
      title={displayed.description}
      onClick={onOpen}
      type={onOpen ? "button" : undefined}
    >
      <span>
        {displayed.label}
        {onOpen && <ArrowRight className="stat-link-arrow" size={14} aria-hidden="true" />}
      </span>
      <span aria-live={stat.periodValues ? "polite" : undefined} aria-atomic="true">
        <strong>{displayed.value}</strong>
        {displayed.trend ? <small>{displayed.trend}</small> : null}
      </span>
    </Tile>
  );
}
