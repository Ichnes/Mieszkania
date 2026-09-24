import { GitCompareArrows, Search } from "lucide-react";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { formatViewingDate } from "../shared/lib/format";
import { LoadError } from "../shared/components/LoadError";

export function OffersOverview({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "activeTab"
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
          <section className="hero">
            <div>
              <p className="eyebrow">Wasze poszukiwania · {region.name}</p>
              <h1>Nasze oferty mieszkaniowe</h1>
              <p className="lead">Ceny, dojazdy i zapisane oferty w jednym miejscu.</p>
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
            {listingInsights.map((stat) => (
              <div key={stat.label} className="hero-stat" title={stat.description}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.trend ? <small>{stat.trend}</small> : null}
              </div>
            ))}
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
          ) : viewingsSection.status === "ready" ? (
            <p className="empty-viewings-note">
              Brak zaplanowanych oglądań. Termin dodasz w szczegółach oferty.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
