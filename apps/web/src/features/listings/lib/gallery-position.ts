// Image URLs also identify the photo when the portal reorders its gallery.
const cardPhotoByListing = new Map<string, string>();
const photoListeners = new Set<() => void>();

export function getSelectedPhoto(id: string) {
  return cardPhotoByListing.get(id);
}

export function selectListingPhoto(id: string, url: string) {
  if (getSelectedPhoto(id) === url) return;
  cardPhotoByListing.set(id, url);
  for (const listener of photoListeners) listener();
}

export function subscribeToPhotoChanges(listener: () => void) {
  photoListeners.add(listener);
  return () => {
    photoListeners.delete(listener);
  };
}

let requestedPlan: string | undefined;
export function requestFloorPlan(listingId: string) {
  requestedPlan = listingId;
}
export function takeFloorPlanRequest(listingId: string) {
  const requested = requestedPlan === listingId;
  requestedPlan = undefined;
  return requested;
}
