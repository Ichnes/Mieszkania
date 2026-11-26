// Image URLs also identify the photo when the portal reorders its gallery.
const cardPhotoByListing = new Map<string, string>();
const photoListeners = new Set<() => void>();

export function getSelectedPhoto(id: string) {
  if (cardPhotoByListing.has(id)) return cardPhotoByListing.get(id);
  try {
    const url = sessionStorage.getItem("listing-photo:" + id);
    if (url) cardPhotoByListing.set(id, url);
  } catch {}
  return cardPhotoByListing.get(id);
}

export function selectListingPhoto(id: string, url: string) {
  if (getSelectedPhoto(id) === url) return;
  cardPhotoByListing.set(id, url);
  try {
    sessionStorage.setItem("listing-photo:" + id, url);
  } catch {}
  for (const listener of photoListeners) listener();
}

export function subscribeToPhotoChanges(listener: () => void) {
  photoListeners.add(listener);
  return () => {
    photoListeners.delete(listener);
  };
}
