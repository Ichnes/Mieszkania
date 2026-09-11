/** Search attribution is not part of an offer's identity and can trigger CDN rejection. */
export function normalizeOlxListingUrl(value: string): string {
  const url = new URL(value);
  if (
    (url.hostname === "olx.pl" || url.hostname.endsWith(".olx.pl")) &&
    url.pathname.startsWith("/d/oferta/")
  ) {
    url.searchParams.delete("search_reason");
    url.hash = "";
  }
  return url.toString();
}
