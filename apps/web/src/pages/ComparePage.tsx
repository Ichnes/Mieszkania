import type { WorkspaceState } from "../app/useWorkspaceController";
import { CompareBoard } from "../features/compare/CompareBoard";

export function ComparePage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    "activeTab" | "compareListings" | "openListing" | "removeFromCompare"
  >;
}) {
  const { activeTab, compareListings, openListing, removeFromCompare } = model;
  return (
    <>
      {activeTab === "compare" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Compare</p>
              <h2>Porównanie ofert 2-5</h2>
            </div>
            <div className="pill">{compareListings.length} wybrane</div>
          </div>
          <CompareBoard
            listings={compareListings}
            onOpen={openListing}
            onRemove={removeFromCompare}
          />
        </section>
      ) : null}
    </>
  );
}
