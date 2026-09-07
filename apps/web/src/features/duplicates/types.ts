export type DuplicateGroupOverview = {
  groupId: string;
  primaryListingId: string;
  primaryTitle: string;
  members: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    canonicalUrl?: string;
    thumbnailUrl?: string;
    priceLabel: string;
    areaLabel: string;
    isPrimary: boolean;
  }>;
};
