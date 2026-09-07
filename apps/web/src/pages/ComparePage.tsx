import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { CompareBoard } from "../features/compare/CompareBoard";

export function ComparePage({
  model,
}: {
  model: Pick<WorkspaceState, "compareListings" | "openListing" | "removeFromCompare">;
}) {
  return (
    <section className="comparison-page">
      <header className="comparison-heading">
        <div>
          <p className="eyebrow">Decyzja bez przełączania kart</p>
          <h1>Porównaj mieszkania</h1>
          <p>Cena, przestrzeń i codzienna wygoda — wszystko obok siebie.</p>
        </div>
        <Link className="action-button secondary-button" to="/oferty">
          <Plus size={18} />
          Dodaj oferty
        </Link>
      </header>
      <CompareBoard
        listings={model.compareListings}
        onOpen={model.openListing}
        onRemove={model.removeFromCompare}
      />
    </section>
  );
}
