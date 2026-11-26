// Image URLs also identify the photo when the portal reorders its gallery.
export const cardPhotoByListing = new Map<string, string>();
let requestedPlan: string | undefined;
export function requestFloorPlan(listingId: string) {
  requestedPlan = listingId;
}
export function takeFloorPlanRequest(listingId: string) {
  const requested = requestedPlan === listingId;
  requestedPlan = undefined;
  return requested;
}
