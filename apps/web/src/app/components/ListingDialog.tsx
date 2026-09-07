import { useLocation, useNavigate } from "react-router-dom";
import { ListingDetailPanel } from "../../features/listings/components/ListingDetailPanel";
import { DEFAULT_DOWN_PAYMENT } from "../../features/mortgage/constants";
import { parseNumericLabel } from "../../shared/lib/format";
import type { WorkspaceState } from "../useWorkspaceController";

export function ListingDialog({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "selectedListing"
    | "selectedListingDuplicateCandidates"
    | "setSelectedListing"
    | "openListing"
    | "reviewDuplicatePair"
    | "toggleShortlist"
    | "dismissListing"
    | "archiveListing"
    | "compareListingIds"
    | "toggleCompareListing"
    | "isUpdatingShortlist"
    | "isDismissingListing"
    | "isArchivingListing"
    | "isLoadingDuplicateCandidates"
    | "isReviewingDuplicatePair"
    | "saveListingManual"
    | "saveListingContactEvent"
    | "scheduleViewing"
    | "deleteViewing"
    | "runListingMediaBackfill"
    | "refreshListingFromSource"
    | "listingRefreshConfirmation"
    | "isBackfillingListingMedia"
    | "isRefreshingListingData"
    | "isSavingListingManual"
    | "isSavingContactEvent"
    | "isLoadingListingInsights"
    | "loadListingInsights"
    | "setMortgageDraft"
    | "setActiveTab"
  >;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    selectedListing,
    selectedListingDuplicateCandidates,
    setSelectedListing,
    openListing,
    reviewDuplicatePair,
    toggleShortlist,
    dismissListing,
    archiveListing,
    compareListingIds,
    toggleCompareListing,
    isUpdatingShortlist,
    isDismissingListing,
    isArchivingListing,
    isLoadingDuplicateCandidates,
    isReviewingDuplicatePair,
    saveListingManual,
    saveListingContactEvent,
    scheduleViewing,
    deleteViewing,
    runListingMediaBackfill,
    refreshListingFromSource,
    listingRefreshConfirmation,
    isBackfillingListingMedia,
    isRefreshingListingData,
    isSavingListingManual,
    isSavingContactEvent,
    isLoadingListingInsights,
    loadListingInsights,
    setMortgageDraft,
    setActiveTab,
  } = model;
  return (
    <>
      {selectedListing ? (
        <ListingDetailPanel
          listing={selectedListing}
          duplicateCandidates={selectedListingDuplicateCandidates}
          onClose={() => {
            void navigate(location.pathname);
            setSelectedListing(null);
          }}
          onOpenRelatedListing={openListing}
          onReviewDuplicate={reviewDuplicatePair}
          onToggleShortlist={toggleShortlist}
          onDismiss={dismissListing}
          onArchive={archiveListing}
          isCompared={compareListingIds.includes(selectedListing.id)}
          onToggleCompare={toggleCompareListing}
          isUpdatingShortlist={isUpdatingShortlist === selectedListing.id}
          isDismissing={isDismissingListing === selectedListing.id}
          isArchiving={isArchivingListing === selectedListing.id}
          isLoadingDuplicateCandidates={isLoadingDuplicateCandidates}
          isReviewingDuplicatePair={isReviewingDuplicatePair}
          onSaveManual={saveListingManual}
          onAddContactEvent={saveListingContactEvent}
          onScheduleViewing={scheduleViewing}
          onDeleteViewing={deleteViewing}
          onBackfillMedia={runListingMediaBackfill}
          onRefreshFromSource={refreshListingFromSource}
          refreshConfirmation={
            listingRefreshConfirmation?.listingId === selectedListing.id
              ? listingRefreshConfirmation
              : null
          }
          isBackfillingMedia={isBackfillingListingMedia === selectedListing.id}
          isRefreshingFromSource={isRefreshingListingData === selectedListing.id}
          isSavingManual={isSavingListingManual}
          isSavingContactEvent={isSavingContactEvent}
          isLoadingInsights={isLoadingListingInsights}
          onRefreshInsights={() => loadListingInsights(selectedListing.id, true)}
          onAddToMortgage={(listing) => {
            const propertyTotal =
              listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0;
            setMortgageDraft({
              propertyTotal,
              principal: Math.max(0, propertyTotal - DEFAULT_DOWN_PAYMENT),
              listingTitle: listing.title,
              listingId: listing.id,
            });
            setActiveTab("mortgage");
            setSelectedListing(null);
          }}
        />
      ) : null}
    </>
  );
}
