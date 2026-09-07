import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppTab } from "./types";

export const routePaths = {
  dashboard: "/oferty",
  stats: "/statystyki",
  compare: "/porownanie",
  map: "/mapa",
  mortgage: "/kredyt",
  duplicates: "/duplikaty",
  backfill: "/aktualizacja",
  operations: "/import",
} as const satisfies Record<AppTab, string>;

export function tabFromPath(pathname: string): AppTab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    (Object.entries(routePaths).find(([, value]) => value === path)?.[0] as AppTab | undefined) ??
    "dashboard"
  );
}

export function useAppRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  const setActiveTab = useCallback(
    (tab: AppTab) => {
      void navigate(routePaths[tab]);
    },
    [navigate],
  );
  return { activeTab: tabFromPath(location.pathname), setActiveTab, location, navigate };
}
