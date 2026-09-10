export type SourceListingReference = {
  externalId: string;
  url: string;
};

export type ListingImageInput = {
  sourceUrl: string;
  position: number;
  caption?: string;
  isPrimary: boolean;
};

export type ParsedListing = {
  externalId: string;
  canonicalUrl: string;
  title: string;
  description?: string;
  city: string;
  district?: string;
  neighborhood?: string;
  street?: string;
  addressText?: string;
  latitude?: number;
  longitude?: number;
  sourceContactPhone?: string;
  priceAmount?: number;
  areaSqm?: number;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  publishedAt?: string;
  marketType: "primary" | "secondary";
  offerType: "sale" | "rent";
  status: "active" | "reserved" | "sold" | "removed" | "unknown";
  images: ListingImageInput[];
  rawPayload: Record<string, unknown>;
};

export type FetchedListingDocument = {
  responseHeaders?: Record<string, string>;
  url: string;
  html: string;
  statusCode: number;
  finalUrl?: string;
};

export interface SourceDiscovery {
  discoverListingUrls(input: { city: string; page?: number }): Promise<SourceListingReference[]>;
}

export interface ListingFetcher {
  fetchListing(url: string): Promise<FetchedListingDocument>;
}

export interface ListingParser {
  parse(document: FetchedListingDocument): Promise<ParsedListing>;
}

export interface CollectorStorage {
  upsertListingSnapshot(input: {
    sourceKey: string;
    listing: ParsedListing;
    refreshMode?: "full" | "price_only";
    rawArtifact: {
      type: "html" | "json" | "image_manifest";
      storageKey: string;
      payload: Record<string, unknown>;
    };
  }): Promise<{
    listingId: string;
    snapshotId: string;
    action: "created" | "updated" | "unchanged";
    mediaAssets: Array<{
      assetId: string;
      storageKey: string;
      sourceUrl: string;
    }>;
  }>;
}
