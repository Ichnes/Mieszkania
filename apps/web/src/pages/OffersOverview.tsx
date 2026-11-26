import { useEffect, useRef, useState } from "react";
import { Select } from "../components/Select";
import { ChevronDown, GitCompareArrows, Search } from "lucide-react";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { formatViewingDate } from "../shared/lib/format";
import { LoadError } from "../shared/components/LoadError";
import { OverviewStat } from "../features/listings/components/OverviewStat";

export function OffersOverview({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "activeTab"
    | "applyFilters"
    | "setFilters"
    | "setListingSort"
    | "region"
    | "upcomingViewings"
    | "listingsTotal"
    | "setActiveTab"
    | "listingInsights"
    | "openListing"
    | "dashboardSection"
    | "viewingsSection"
    | "hasLoadedListings"
    | "isLoadingListings"
    | "listingsError"
  >;
}) {
  const marketPanel = useRef<HTMLDivElement>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  useEffect(() => {
    if (!marketOpen) return;
    const closeOnResize = () => {
      if (window.innerWidth > 700) marketPanel.current?.hidePopover();
    };
    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, [marketOpen]);
  const [period, setPeriod] = useState<7 | 30 | 60>(7);
  const {
    activeTab,
    region,
    upcomingViewings,
    listingsTotal,
    setActiveTab,
    listingInsights,
    openListing,
    dashboardSection,
    viewingsSection,
  } = model;
  return (
    <>
      {activeTab === "dashboard" ? (
        <div className="top-dashboard-frame">
          <div className="mobile-market-header">
            <strong>{region.name}</strong>
            <button
              type="button"
              popoverTarget="mobile-market"
              aria-controls="mobile-market"
              aria-expanded={marketOpen}
            >
              Rynek <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          <div
            ref={marketPanel}
            popover="auto"
            id="mobile-market"
            className="market-sheet"
            role="region"
            aria-labelledby="market-title"
            onToggle={(event) => setMarketOpen(event.newState === "open")}
          >
            <div className="market-sheet-body">
              <header>
                <h2 id="market-title">Podsumowanie rynku</h2>

                <button
                  aria-label="Zamknij podsumowanie"
                  onClick={() => marketPanel.current?.hidePopover()}
                >
                  ×
                </button>
              </header>
              <div className="market-periods" role="group" aria-label="Okres podsumowania rynku">
                {([7, 30, 60] as const).map((days) => (
                  <button
                    type="button"
                    key={days}
                    aria-pressed={period === days}
                    onClick={() => setPeriod(days)}
                  >
                    {days} dni
                  </button>
                ))}
              </div>
              <h3>W zakresie poszukiwań</h3>
              {listingInsights.map((stat) => {
                const value = stat.periodValues?.[period] ?? stat;
                const key = stat.listingWindow;
                const label =
                  key === "newWithinDays"
                    ? "Nowe oferty"
                    : key === "priceChangedWithinDays"
                      ? "Zmiany cen"
                      : stat.label;
                const city = /średnia/i.test(label);
                const content = (
                  <>
                    <span>{city ? "Warszawa · średnia za m²" : label}</span>
                    <strong>{value.value}</strong>
                    {value.trend && <small>{value.trend}</small>}
                  </>
                );
                return key ? (
                  <button
                    className="market-stat"
                    key={label}
                    onClick={() => {
                      marketPanel.current?.hidePopover();
                      const next = { [key]: period };
                      model.setFilters(next);
                      model.setListingSort("newest");
                      void model.applyFilters(next, 1, "newest");
                      document.getElementById("oferty-lista")?.scrollIntoView();
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={label} className={city ? "market-stat market-city" : "market-stat"}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
          <section className="hero">
            <div>
              <p className="eyebrow">Wasze poszukiwania · {region.name}</p>
              <h1>Nasze oferty mieszkaniowe</h1>
            </div>

            <div className="hero-card">
              <span>Najbliższy krok</span>
              <strong>
                {viewingsSection.data === null
                  ? viewingsSection.error
                    ? "Kalendarz niedostępny"
                    : "Wczytuję kalendarz…"
                  : upcomingViewings.total > 0
                    ? `${upcomingViewings.total} zaplanowane`
                    : "Przejrzyj nowe oferty"}
              </strong>
              <p>
                {!model.hasLoadedListings
                  ? model.listingsError
                    ? "Lista ofert wymaga ponowienia odczytu."
                    : "Wczytuję oferty…"
                  : model.isLoadingListings
                    ? "Aktualizuję listę ofert…"
                    : `${listingsTotal} ofert w bieżących wynikach.`}
              </p>
              <button
                className="action-button hero-primary-action"
                onClick={() =>
                  document.getElementById("oferty-lista")?.scrollIntoView({ block: "start" })
                }
              >
                <Search size={16} aria-hidden="true" /> Przeglądaj oferty
              </button>
              <button
                className="action-button secondary-button hero-settings"
                onClick={() => setActiveTab("duplicates")}
              >
                <GitCompareArrows size={16} aria-hidden="true" /> Sprawdź duplikaty
              </button>
            </div>
          </section>

          {dashboardSection.error && (
            <LoadError message={dashboardSection.error} onRetry={dashboardSection.reload} />
          )}
          {dashboardSection.status === "loading" || dashboardSection.status === "idle" ? (
            <p className="load-feedback" role="status">
              Wczytuję podsumowanie bazy…
            </p>
          ) : null}
          <div
            className="hero-stats"
            aria-label="Snapshot stanu bazy"
            aria-busy={dashboardSection.status === "loading"}
          >
            {listingInsights.map((stat) => {
              const key = stat.listingWindow;
              return (
                <OverviewStat
                  key={stat.label}
                  stat={stat}
                  period={period}
                  onOpen={
                    key
                      ? () => {
                          const filters = { [key]: period };
                          model.setFilters(filters);
                          model.setListingSort("newest");
                          void model.applyFilters(filters, 1, "newest");
                          document
                            .getElementById("oferty-lista")
                            ?.scrollIntoView({ block: "start" });
                        }
                      : undefined
                  }
                />
              );
            })}
            <div className="overview-period-control">
              <span>
                Okres<span className="overview-period-suffix"> podsumowania</span>
              </span>
              <Select
                label="Okres podsumowania"
                value={String(period)}
                onChange={(value) => setPeriod(Number(value) as 7 | 30 | 60)}
                options={[7, 30, 60].map((days) => ({ value: String(days), label: `${days} dni` }))}
              />
            </div>
          </div>

          {viewingsSection.error && (
            <LoadError message={viewingsSection.error} onRetry={viewingsSection.reload} />
          )}
          {viewingsSection.status === "loading" || viewingsSection.status === "idle" ? (
            <p className="load-feedback" role="status">
              Wczytuję kalendarz…
            </p>
          ) : null}
          {upcomingViewings.items.length > 0 ? (
            <section className="panel compact-panel">
              <div className="panel-header">
                <div className="detail-sidebar">
                  <p className="eyebrow">Kalendarz</p>
                  <h2>Najbliższe wizyty</h2>
                </div>
                <div className="pill">{upcomingViewings.total} zaplanowane</div>
              </div>
              <div className="calendar-grid">
                {upcomingViewings.items.length > 0 ? (
                  upcomingViewings.items.map((viewing) => (
                    <article
                      key={viewing.id}
                      className="calendar-card"
                      onClick={() => void openListing(viewing.listingId)}
                    >
                      <span>{formatViewingDate(viewing.scheduledAt)}</span>
                      <strong>{viewing.listingTitle}</strong>
                      <p>
                        {viewing.city}
                        {viewing.district ? ` / ${viewing.district}` : ""}
                      </p>
                      <p>{viewing.addressText ?? "Brak adresu"}</p>
                      {viewing.notes ? <p className="muted">{viewing.notes}</p> : null}
                    </article>
                  ))
                ) : (
                  <div className="result-box">Brak zaplanowanych oglądań.</div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
