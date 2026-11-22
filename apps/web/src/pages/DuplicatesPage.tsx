import { Link, useSearchParams } from "react-router-dom";
import { GitCompareArrows, History } from "lucide-react";
import { RelistingsPanel } from "../features/relistings/RelistingsPanel";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { DuplicateGroupsPanel } from "../features/duplicates/DuplicateGroupsPanel";
import { DuplicateCandidatesPanel } from "../features/duplicates/DuplicateCandidatesPanel";

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
    | "duplicateGroupData"
    | "duplicateGroupQuery"
    | "setDuplicateGroupQuery"
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
    duplicateGroupData,
    duplicateGroupQuery,
    setDuplicateGroupQuery,
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
  const candidatesView = params.get("view") === "candidates";
  return (
    <div className="duplicate-workspace">
      <Link className="duplicate-back-link" to="/oferty">
        ← Wróć do ofert
      </Link>
      <header className="duplicate-navigation">
        <h1>Powiązania ofert</h1>
        <nav className="duplicate-navigation-types" aria-label="Rodzaj powiązania ofert">
          <button
            type="button"
            aria-current={!relistings ? "page" : undefined}
            onClick={() => setParams({})}
          >
            <GitCompareArrows size={19} aria-hidden="true" /> Duplikaty
          </button>
          <button
            type="button"
            aria-current={relistings ? "page" : undefined}
            onClick={() => setParams({ tab: "relistings" })}
          >
            <History size={19} aria-hidden="true" /> Ponowne wystawienia
          </button>
        </nav>
        <nav className="duplicate-navigation-views" aria-label="Stan powiązań">
          <button
            type="button"
            aria-current={!candidatesView ? "page" : undefined}
            onClick={() => setParams(relistings ? { tab: "relistings" } : {})}
          >
            {relistings ? "Połączone" : "Do weryfikacji"}
          </button>
          <button
            type="button"
            aria-current={candidatesView ? "page" : undefined}
            onClick={() =>
              setParams(
                relistings ? { tab: "relistings", view: "candidates" } : { view: "candidates" },
              )
            }
          >
            Propozycje
          </button>
        </nav>
      </header>
      {relistings ? (
        <RelistingsPanel
          potential={candidatesView}
          onOpenListing={openListing}
          runScan={runRelistingScan}
          scanning={isScanningRelistedListings}
          scanError={relistingScanError}
          scanResult={relistingScanResult}
        />
      ) : (
        <>
          {!candidatesView && (
            <details className="panel duplicate-scan-menu">
              <summary>
                <GitCompareArrows size={16} aria-hidden="true" /> Skan i automatyczne łączenie
              </summary>
              <p className="muted">
                Łączy oferty z identycznym początkiem opisu i zgodnym metrażem.
              </p>
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
            </details>
          )}
          {!candidatesView && duplicateAutoMergeError && (
            <p className="error-text" role="alert">
              {duplicateAutoMergeError}
            </p>
          )}
          {candidatesView ? (
            <DuplicateCandidatesPanel onOpen={(id) => void openListing(id)} />
          ) : activeTab === "duplicates" ? (
            <DuplicateGroupsPanel
              data={duplicateGroupData}
              query={duplicateGroupQuery}
              onQueryChange={setDuplicateGroupQuery}
              error={duplicateError}
              busy={duplicateAction}
              onReload={() => void loadDuplicateGroups()}
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
