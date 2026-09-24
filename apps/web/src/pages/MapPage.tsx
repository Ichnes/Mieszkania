import type { WorkspaceState } from "../app/useWorkspaceController";
import { MapView } from "../features/map/MapView";
import { LoadError } from "../shared/components/LoadError";

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
    | "mapListingsError"
    | "loadMapListings"
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
          {model.mapListingsError ? (
            <LoadError
              message={model.mapListingsError}
              onRetry={model.loadMapListings}
              busy={isLoadingMapListings}
            />
          ) : null}
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
