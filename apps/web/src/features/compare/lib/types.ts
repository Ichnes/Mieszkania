import type { ListingDetail, ListingSummary } from "@mieszkania/shared";

// Cards supply summaries; the comparison refresh supplies the complete detail.
export type ComparisonListing = ListingSummary & Partial<Pick<ListingDetail, "manual">>;
