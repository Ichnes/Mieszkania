import type { WorkspaceState } from "../app/useWorkspaceController";
import { MapView } from "../features/map/MapView";

export function MapPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "activeTab"
    | "mapListings"
    | "selectedListing"
    | "openListing"
    | "settings"
    | "isLoadingMapListings"
  >;
}) {
  const { activeTab, mapListings, selectedListing, openListing, settings, isLoadingMapListings } =
    model;
  return (
    <>
      {activeTab === "map" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Mapa</p>
              <h2>Oferty naniesione na mapie</h2>
            </div>
          </div>
          <MapView
            listings={mapListings}
            selectedListingId={selectedListing?.id}
            onOpen={openListing}
            workplaces={settings.workplaces}
            isLoading={isLoadingMapListings}
          />
        </section>
      ) : null}
    </>
  );
}
