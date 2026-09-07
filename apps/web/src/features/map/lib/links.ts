import type { ListingSummary } from "@mieszkania/shared";

export function buildOsmSearchHref(
  listing: Pick<ListingSummary, "street" | "district" | "city" | "addressText">,
  fallbackQuery?: string,
) {
  const query =
    [listing.addressText, listing.street, listing.district, listing.city, "Polska"]
      .filter(Boolean)
      .join(", ") ||
    fallbackQuery ||
    "Warszawa, Polska";

  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}
