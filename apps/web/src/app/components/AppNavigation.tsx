import {
  Calculator,
  Columns3,
  DatabaseZap,
  GitCompareArrows,
  LayoutDashboard,
  Map,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { routePaths } from "../routes";

const navigation = [
  { to: routePaths.dashboard, label: "Oferty", Icon: LayoutDashboard },
  { to: routePaths.stats, label: "Statystyki", Icon: Columns3 },
  { to: routePaths.compare, label: "Porównanie", Icon: GitCompareArrows },
  { to: routePaths.map, label: "Mapa", Icon: Map },
  { to: routePaths.mortgage, label: "Kredyt", Icon: Calculator },
  { to: routePaths.duplicates, label: "Duplikaty", Icon: GitCompareArrows },
  { to: routePaths.backfill, label: "Aktualizacja", Icon: DatabaseZap },
];

export function AppNavigation() {
  return (
    <nav className="workspace-navigation" aria-label="Widoki aplikacji">
      <div className="tabs-row">
        {navigation.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "tab-button active" : "tab-button")}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
