import { Link, useSearchParams } from "react-router-dom";
import { GitCompareArrows } from "lucide-react";
import { RelistingMatches } from "../features/relistings/RelistingMatches";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { DuplicateGroupsPanel } from "../features/duplicates/DuplicateGroupsPanel";

export function DuplicatesPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "runDuplicateAutoMerge"
    | "isRunningDuplicateAutoMerge"
    | "duplicateAutoMergeResult"
    | "runRelistingScan"
    | "isScanningRelistedListings"
    | "relistingScanResult"
    | "duplicateAutoMergeError"
    | "relistingScanError"
    | "activeTab"
    | "duplicateGroups"
    | "duplicateTotal"
    | "duplicateTotals"
    | "duplicateError"
    | "duplicateAction"
    | "loadDuplicateGroups"
    | "isLoadingDuplicateGroups"
    | "openListing"
    | "unmergeDuplicate"
    | "confirmDuplicateGroup"
  >;
}) {
  const {
    runDuplicateAutoMerge,
    isRunningDuplicateAutoMerge,
    duplicateAutoMergeResult,
    runRelistingScan,
    isScanningRelistedListings,
    relistingScanResult,
    duplicateAutoMergeError,
    relistingScanError,
    activeTab,
    duplicateGroups,
    duplicateTotal,
    duplicateTotals,
    duplicateError,
    duplicateAction,
    loadDuplicateGroups,
    isLoadingDuplicateGroups,
    openListing,
    unmergeDuplicate,
    confirmDuplicateGroup,
  } = model;
  const [params, setParams] = useSearchParams();
  const relistings = params.get("tab") === "relistings";
  return (
    <div className="duplicate-workspace">
      <Link className="duplicate-back-link" to="/oferty">
        ← Wróć do ofert
      </Link>
      <nav className="duplicate-tabs" aria-label="Rodzaj powiązania ofert">
        <button
          type="button"
          aria-current={!relistings ? "page" : undefined}
          onClick={() => setParams({})}
        >
          Duplikaty
        </button>
        <button
          type="button"
          aria-current={relistings ? "page" : undefined}
          onClick={() => setParams({ tab: "relistings" })}
        >
          Oferty wystawione ponownie
        </button>
      </nav>
      {relistings ? (
        <section className="panel">
          <div className="section-topline">
            <div>
              <h2>Oferty wystawione ponownie</h2>
              <p className="muted">
                Porównaj aktywne ogłoszenia z archiwum i sprawdź wcześniejsze ceny.
              </p>
            </div>
            <button
              className="action-button"
              type="button"
              onClick={() => void runRelistingScan()}
              disabled={isScanningRelistedListings}
            >
              {isScanningRelistedListings ? "Sprawdzam…" : "Sprawdź oferty"}
            </button>
          </div>
          {relistingScanError && (
            <p className="error-text" role="alert">
              {relistingScanError}
            </p>
          )}
          {isScanningRelistedListings && <p role="status">Porównywanie ofert z archiwum…</p>}
          {!relistingScanResult && !isScanningRelistedListings && (
            <p className="muted">
              Wybierz „Sprawdź oferty”, aby zobaczyć dopasowania i propozycje do weryfikacji.
            </p>
          )}
          {relistingScanResult ? (
            <section className="relisting-results" aria-live="polite">
              <div className="relisting-results-heading">
                <div>
                  <h3>Rozpoznane ponowne wystawienia</h3>
                  <p className="muted">
                    Sprawdzono {relistingScanResult.checkedActive} aktywnych i{" "}
                    {relistingScanResult.checkedArchived} archiwalnych ofert.
                  </p>
                </div>
                <span>Dopasowania: {relistingScanResult.matched}</span>
              </div>
              {relistingScanResult.items.length > 0 ? (
                <RelistingMatches items={relistingScanResult.items} onOpenListing={openListing} />
              ) : (
                <p className="muted relisting-empty">
                  Nie znaleziono mocnych dopasowań do wcześniejszych ofert.
                </p>
              )}
              <div className="relisting-results-heading">
                <div>
                  <h3>Potencjalne wcześniejsze oferty</h3>
                  <p className="muted">
                    Te oferty mogły już być w naszej bazie. Porównaj je z archiwum — podobieństwo
                    nie potwierdza ponownego wystawienia.
                  </p>
                </div>
                <span>Propozycje: {relistingScanResult.potentialCount}</span>
              </div>
              {relistingScanResult.potentialItems.length > 0 ? (
                <>
                  <RelistingMatches
                    items={relistingScanResult.potentialItems}
                    potential
                    onOpenListing={openListing}
                  />
                  {relistingScanResult.potentialCount >
                    relistingScanResult.potentialItems.length && (
                    <p className="muted">
                      Pokazano {relistingScanResult.potentialItems.length} z{" "}
                      {relistingScanResult.potentialCount} propozycji. Pozostałe są dostępne w
                      szczegółach odpowiednich ofert.
                    </p>
                  )}
                </>
              ) : (
                <p className="muted relisting-empty">Brak dodatkowych propozycji z archiwum.</p>
              )}
            </section>
          ) : null}
        </section>
      ) : (
        <>
          <section className="panel duplicate-scan-actions">
            <GitCompareArrows size={20} aria-hidden="true" />
            <div>
              <h3>Połącz duplikaty</h3>
              <p>
                Łączy oferty z identycznymi pierwszymi 25 słowami opisu, także z jednego portalu.
              </p>
            </div>
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => void runDuplicateAutoMerge()}
              disabled={isRunningDuplicateAutoMerge}
            >
              {isRunningDuplicateAutoMerge ? "Porównuję…" : "Znajdź i połącz"}
            </button>
            {duplicateAutoMergeResult ? (
              <small>
                {duplicateAutoMergeResult.merged} połączonych z {duplicateAutoMergeResult.checked}{" "}
                sprawdzonych
              </small>
            ) : null}
          </section>
          {duplicateAutoMergeError && (
            <p className="error-text" role="alert">
              {duplicateAutoMergeError}
            </p>
          )}
          {activeTab === "duplicates" ? (
            <DuplicateGroupsPanel
              groups={duplicateGroups}
              total={duplicateTotal}
              totalMembers={duplicateTotals.members}
              totalCopies={duplicateTotals.copies}
              error={duplicateError}
              busy={duplicateAction}
              onReload={() => void loadDuplicateGroups()}
              onLoadMore={() => void loadDuplicateGroups(duplicateGroups.length + 100)}
              isLoading={isLoadingDuplicateGroups}
              onOpen={(id) => void openListing(id)}
              onUnmerge={(primaryListingId, duplicateListingId) =>
                void unmergeDuplicate(primaryListingId, duplicateListingId)
              }
              onConfirm={(primaryListingId) => void confirmDuplicateGroup(primaryListingId)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
