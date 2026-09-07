import type { ListingSummary } from "@mieszkania/shared";

export function buildListingPrimaryLocation(listing: ListingSummary) {
  if (listing.street) {
    const details = [listing.neighborhood, listing.district].filter(Boolean).join(" • ");
    return details ? `${listing.street} • ${details}` : listing.street;
  }

  const addressLead = listing.addressText?.split(",")[0]?.trim();
  if (addressLead) {
    const details = [listing.neighborhood, listing.district].filter(Boolean).join(" • ");
    return details ? `${addressLead} • ${details}` : addressLead;
  }

  return [listing.neighborhood, listing.district, listing.city].filter(Boolean).join(" • ");
}
