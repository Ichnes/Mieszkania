import { ListingDetailPanel } from "../../features/listings/components/ListingDetailPanel";
import { DEFAULT_DOWN_PAYMENT } from "../../features/mortgage/constants";
import { parseNumericLabel } from "../../shared/lib/format";
import type { WorkspaceState } from "../useWorkspaceController";

export function ListingDialog({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "settings"
    | "selectedListing"
    | "offerNavigation"
    | "navigateOffer"
    | "selectedListingDuplicateCandidates"
    | "closeListing"
    | "openListing"
    | "reviewDuplicatePair"
    | "unmergeDuplicate"
    | "duplicateAction"
    | "duplicateError"
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
  const {
    selectedListing,
    selectedListingDuplicateCandidates,
    closeListing,
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
          settings={model.settings}
          downPayment={model.settings.financing?.downPayment ?? DEFAULT_DOWN_PAYMENT}
          listing={selectedListing}
          offerNavigation={model.offerNavigation}
          onNavigateOffer={model.navigateOffer}
          duplicateCandidates={selectedListingDuplicateCandidates}
          onClose={closeListing}
          onOpenRelatedListing={openListing}
          onReviewDuplicate={reviewDuplicatePair}
          onUnmergeDuplicate={model.unmergeDuplicate}
          isUnmergingDuplicate={Boolean(model.duplicateAction)}
          duplicateError={model.duplicateError}
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
              principal: Math.max(
                0,
                propertyTotal - (model.settings.financing?.downPayment ?? DEFAULT_DOWN_PAYMENT),
              ),
              listingTitle: listing.title,
              listingId: listing.id,
            });
            closeListing();
            setActiveTab("mortgage");
          }}
        />
      ) : null}
    </>
  );
}
