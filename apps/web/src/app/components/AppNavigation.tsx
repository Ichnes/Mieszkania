import { useEffect, useState } from "react";
import {
  Calculator,
  Columns3,
  DatabaseZap,
  GitCompareArrows,
  LayoutDashboard,
  Map,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (pathname !== routePaths.dashboard) return;
    let anchor = window.scrollY;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      if (y < 60 || y < anchor - 8) {
        setHidden(false);
        anchor = y;
      } else if (y > anchor + 60) {
        setHidden(true);
        anchor = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
  return (
    <nav
      className={hidden ? "workspace-navigation hide-on-scroll" : "workspace-navigation"}
      aria-label="Widoki aplikacji"
    >
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
