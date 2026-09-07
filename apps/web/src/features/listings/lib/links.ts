export function listingHref(listingId: string) {
  return `${window.location.pathname}?listing=${encodeURIComponent(listingId)}`;
}
