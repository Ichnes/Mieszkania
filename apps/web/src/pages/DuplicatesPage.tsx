import type { WorkspaceState } from "../app/useWorkspaceController";
import { DuplicateGroupsPanel } from "../features/duplicates/DuplicateGroupsPanel";

export function DuplicatesPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
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
  return (
    <>
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
  );
}
