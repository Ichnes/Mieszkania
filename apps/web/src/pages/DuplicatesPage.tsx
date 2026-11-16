import { Link, useSearchParams } from "react-router-dom";
import { GitCompareArrows } from "lucide-react";
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
    | "duplicateGroups"
    | "duplicateGroupSort"
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
  const candidatesView = params.get("view") === "candidates";
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
      <nav className="duplicate-tabs" aria-label="Stan powiązań">
        <button
          type="button"
          aria-current={!candidatesView ? "page" : undefined}
          onClick={() => setParams(relistings ? { tab: "relistings" } : {})}
        >
          {relistings ? "Połączone oferty" : "Połączone grupy do sprawdzenia"}
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
          Potencjalne powiązania
        </button>
      </nav>
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
          )}
          {!candidatesView && duplicateAutoMergeError && (
            <p className="error-text" role="alert">
              {duplicateAutoMergeError}
            </p>
          )}
          {candidatesView ? (
            <DuplicateCandidatesPanel
              onOpen={(id) => void openListing(id)}
              onChanged={() => void loadDuplicateGroups()}
            />
          ) : activeTab === "duplicates" ? (
            <DuplicateGroupsPanel
              groups={duplicateGroups}
              sort={model.duplicateGroupSort}
              onSortChange={(sort) => void loadDuplicateGroups(100, sort)}
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
