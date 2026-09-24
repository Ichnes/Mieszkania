import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { CompareBoard } from "../features/compare/CompareBoard";

export function ComparePage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "compareListings"
    | "openListing"
    | "removeFromCompare"
    | "compareIssues"
    | "compareListingIds"
    | "isLoadingCompare"
    | "refreshComparison"
    | "comparisonStorageAvailable"
    | "settings"
    | "setSettingsOpen"
  >;
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
      {!model.comparisonStorageAvailable ? (
        <p className="load-feedback" role="status">
          Przeglądarka nie pozwala zapisać wyboru. Porównanie działa do odświeżenia strony.
        </p>
      ) : null}
      {model.isLoadingCompare ? (
        <p className="load-feedback" role="status">
          Wczytuję aktualne dane wybranych ofert…
        </p>
      ) : (
        <>
          {model.compareIssues.length > 0 ? (
            <div className="load-feedback comparison-issues" role="alert">
              <p>Części ofert nie można teraz pokazać. Twój wybór został zachowany.</p>
              <ul>
                {model.compareIssues.map((issue) => (
                  <li key={issue.id}>
                    <span>
                      Wybrana oferta {model.compareListingIds.indexOf(issue.id) + 1}:{" "}
                      {issue.reason === "missing"
                        ? "nie istnieje już w bazie"
                        : "nie udało się pobrać aktualnych danych"}
                      .
                    </span>
                    <button
                      className="action-button secondary-button"
                      type="button"
                      onClick={() => model.removeFromCompare(issue.id)}
                    >
                      Usuń z porównania
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="action-button secondary-button"
                type="button"
                onClick={() => void model.refreshComparison()}
              >
                Ponów odczyt
              </button>
            </div>
          ) : null}
          {model.compareListings.length > 0 || model.compareIssues.length === 0 ? (
            <CompareBoard
              listings={model.compareListings}
              workplaces={model.settings.workplaces}
              onSettings={() => model.setSettingsOpen(true)}
              onOpen={model.openListing}
              onRemove={model.removeFromCompare}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
