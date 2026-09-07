import { ListingLoadingDialog } from "./components/ListingLoadingDialog";
import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { WorkspaceState } from "./useWorkspaceController";

import { AppHeader } from "./components/AppHeader";
import { AppNavigation } from "./components/AppNavigation";
const OffersOverview = lazy(() =>
  import("../pages/OffersOverview").then((module) => ({ default: module.OffersOverview })),
);
const StatisticsPage = lazy(() =>
  import("../pages/StatisticsPage").then((module) => ({ default: module.StatisticsPage })),
);
const ComparePage = lazy(() =>
  import("../pages/ComparePage").then((module) => ({ default: module.ComparePage })),
);
const MortgagePage = lazy(() =>
  import("../pages/MortgagePage").then((module) => ({ default: module.MortgagePage })),
);
const DuplicatesPage = lazy(() =>
  import("../pages/DuplicatesPage").then((module) => ({ default: module.DuplicatesPage })),
);
const ImportPage = lazy(() =>
  import("../pages/ImportPage").then((module) => ({ default: module.ImportPage })),
);
const UpdatesPage = lazy(() =>
  import("../pages/UpdatesPage").then((module) => ({ default: module.UpdatesPage })),
);
const OffersPage = lazy(() =>
  import("../pages/OffersPage").then((module) => ({ default: module.OffersPage })),
);
const MapPage = lazy(() =>
  import("../pages/MapPage").then((module) => ({ default: module.MapPage })),
);
const ListingDialog = lazy(() =>
  import("./components/ListingDialog").then((module) => ({ default: module.ListingDialog })),
);
const SettingsDialog = lazy(() =>
  import("./components/SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

export function Workspace({ model }: { model: WorkspaceState }) {
  const { isOpeningListing, selectedListing, settingsOpen } = model;
  const location = useLocation();
  return (
    <main className="app-shell">
      <AppHeader model={model} />
      <AppNavigation />
      {model.listingOpenError && (
        <section className="panel" role="alert">
          <h2>Nie można otworzyć oferty</h2>
          <p>{model.listingOpenError}</p>
          <Link to="/oferty">Wróć do ofert</Link>
        </section>
      )}
      <Suspense
        fallback={
          <div className="panel" role="status">
            Ładowanie widoku…
          </div>
        }
      >
        {location.pathname === "/oferty" || location.pathname === "/" ? (
          <OffersOverview model={model} />
        ) : null}

        <Routes>
          <Route path="/" element={<Navigate to={"/oferty" + location.search} replace />} />
          <Route path="/statystyki" element={<StatisticsPage model={model} />} />

          <Route path="/porownanie" element={<ComparePage model={model} />} />

          <Route path="/kredyt" element={<MortgagePage model={model} />} />

          <Route path="/duplikaty" element={<DuplicatesPage model={model} />} />

          <Route path="/import" element={<ImportPage model={model} />} />

          <Route path="/aktualizacja" element={<UpdatesPage model={model} />} />

          <Route path="/oferty" element={<OffersPage model={model} />} />

          <Route path="/mapa" element={<MapPage model={model} />} />
          <Route
            path="*"
            element={
              <section className="panel">
                <h1>Nie ma takiej strony</h1>
                <Link to="/oferty">Wróć do ofert</Link>
              </section>
            }
          />
        </Routes>
      </Suspense>
      {selectedListing ? (
        <Suspense fallback={<ListingLoadingDialog onClose={model.closeListing} />}>
          <ListingDialog model={model} />
        </Suspense>
      ) : null}
      {isOpeningListing && !selectedListing ? (
        <ListingLoadingDialog onClose={model.closeListing} />
      ) : null}
      <Suspense fallback={null}>{settingsOpen ? <SettingsDialog model={model} /> : null}</Suspense>
    </main>
  );
}
