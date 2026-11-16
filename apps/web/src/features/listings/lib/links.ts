export function listingHref(
  listingId: string | null,
  location: Pick<Location, "pathname" | "search" | "hash"> = window.location,
) {
  const params = new URLSearchParams(location.search);
  if (listingId) params.set("listing", listingId);
  else params.delete("listing");
  const search = params.toString();
  return `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
}
