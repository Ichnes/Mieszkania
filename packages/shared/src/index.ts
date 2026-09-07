export type DashboardStat = {
  label: string;
  value: string;
  description: string;
  trend?: string;
};

export type MarketStatsResponse = {
  scope?: {
    city: string;
    minArea: number;
    maxArea?: number;
    minPrice: number;
    maxPrice: number;
    roomsMin: number;
  };
  signals?: {
    active: number;
    oldestObserved: number;
    observationDays: number;
    repeatedCuts: number;
    discounted: number;
    medianCutAmount: number | null;
    medianCutPercent: number | null;
    freshLast48Hours: number;
    pressureDistricts: Array<{
      district: string;
      active: number;
      discounted: number;
      sharePercent: number;
    }>;
  };
  totals: {
    active: number;
    archived: number;
    averagePricePerSqm: number;
    medianPricePerSqm: number;
    averageArea: number;
    newLast7Days: number;
    archivedLast30Days: number;
  };
  periodDays: 30 | 90 | 180;
  comparison: {
    newListings: number;
    previousNewListings: number;
    newListingsChangePercent: number | null;
    archivedListings: number;
    previousArchivedListings: number;
    archivedListingsChangePercent: number | null;
    medianNewPricePerSqm: number;
    previousMedianNewPricePerSqm: number;
    medianPriceChangePercent: number | null;
    priceDrops: number;
    priceDropSharePercent: number;
    medianDaysOnMarket: number | null;
  };
  districts: Array<{
    district: string;
    active: number;
    archived: number;
    averagePricePerSqm: number;
    medianPricePerSqm: number;
    pricedListings: number;
    averageArea: number;
    archiveRate: number;
    priceDrops: number;
    priceIncreases: number;
    newLast7Days: number;
    newInPeriod: number;
    archivedInPeriod: number;
    medianDaysOnMarket: number | null;
    geometry?: unknown;
    neighborhoods: Array<{ neighborhood: string; active: number; averagePricePerSqm: number }>;
  }>;
  activity: Array<{
    week: string;
    newListings: number;
    archivedListings: number;
    medianPricePerSqm: number;
  }>;
  priceDistribution: Array<{ label: string; count: number; sharePercent: number }>;
  segments: {
    rooms: Array<{ label: string; count: number; sharePercent: number }>;
    areas: Array<{ label: string; count: number; sharePercent: number }>;
    buildingAge: Array<{ label: string; count: number; sharePercent: number }>;
    sources: Array<{ label: string; count: number; sharePercent: number }>;
    marketTypes: Array<{ label: string; count: number; sharePercent: number }>;
  };
};

export type ParcelGeometry =
  | { type: "Polygon"; coordinates: Array<Array<[number, number]>> }
  | { type: "MultiPolygon"; coordinates: Array<Array<Array<[number, number]>>> };

export type ParcelContextResponse = {
  status: "available" | "missing_location" | "not_found";
  provider: "ULDK GUGiK";
  latitude?: number;
  longitude?: number;
  checkedAt?: string;
  isStale?: boolean;
  parcel?: {
    id: string;
    number?: string;
    commune?: string;
    region?: string;
    datasource?: string;
    geometry: ParcelGeometry;
    geoportalUrl: string;
    urbanRegistryUrl: string;
  };
};

export type PlanningActSummary = {
  id: number;
  title: string;
  planType: string;
  planTypeLabel: string;
  status?: string;
  publishDate?: string;
  validFrom?: string;
  validTo?: string;
  commune?: string;
  district?: string;
  detailsUrl: string;
};

export type ImmediateSurroundingsFinding = {
  osmKey: string;
  category:
    | "industry"
    | "construction"
    | "waste"
    | "power"
    | "fuel"
    | "railway"
    | "major_road"
    | "nightlife"
    | "civic";
  label: string;
  name: string;
  distanceMeters: number;
  severity: "attention" | "information";
  detail: string;
  osmUrl: string;
};

export type ImmediateSurroundingsAnalysis = {
  status: "available" | "unavailable";
  radiusMeters: number;
  checkedAt?: string;
  assessment: "clear" | "attention" | "unknown";
  findings: ImmediateSurroundingsFinding[];
  mapUrl: string;
};

export type PlanningContextResponse = {
  status: "available" | "not_found" | "unavailable" | "missing_parcel";
  provider: "Rejestr Urbanistyczny";
  parcelId?: string;
  checkedAt?: string;
  isStale?: boolean;
  acts: PlanningActSummary[];
  message?: string;
  registryUrl: string;
  immediateSurroundings?: ImmediateSurroundingsAnalysis;
};

export { warsawMetropolitanRegion } from "./region";
export type { SupportedRegion } from "./region";

export type CommuteSummary = {
  key: string;
  label: string;
  durationMinutes?: number;
  distanceKm?: number;
};

export type NearbyAmenitySummary = {
  key: string;
  label: string;
  count: number;
  nearestDistanceMeters?: number;
  within500m?: number;
  within1000m?: number;
  nearestPlaces?: Array<{
    name: string;
    distanceMeters: number;
    latitude: number;
    longitude: number;
  }>;
};

export type PlannedFacilitySummary = {
  osmKey: string;
  categoryKey: string;
  categoryLabel: string;
  name: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  stage: "proposed" | "construction";
};

export type AmenityAnalysis = {
  status: "available" | "unavailable" | "missing_location";
  source: "OpenStreetMap";
  radiusMeters: number;
  checkedAt?: string;
  mapUrl?: string;
  partial?: boolean;
  plannedFacilities: PlannedFacilitySummary[];
};

export type ListingFeature = {
  key: string;
  label: string;
  value: string;
  source?: "payload" | "description" | "derived";
};

export type EvaluationDimensionKey =
  | "location"
  | "layout"
  | "condition"
  | "price"
  | "fees"
  | "balcony_garden"
  | "noise"
  | "sunlight"
  | "garage"
  | "building_standard"
  | "shops"
  | "neighborhood"
  | "potential"
  | "resale"
  | "child_friendly"
  | "healthcare"
  | "amount_to_change";

export type EvaluationDimension = {
  key: EvaluationDimensionKey;
  label: string;
};

export type EvaluationRaterKey = "user" | "spouse" | "assistant";

export type ListingEvaluationEntry = {
  raterKey: EvaluationRaterKey;
  dimensionKey: EvaluationDimensionKey;
  score: number;
  note?: string;
};

export type EvaluationWeights = Record<EvaluationDimensionKey, number>;
export type ListingContactStatus =
  | "new"
  | "contacted"
  | "negotiating"
  | "viewing_scheduled"
  | "rejected"
  | "closed";
export type ListingDecisionStage =
  | "new"
  | "to_call"
  | "after_call"
  | "to_viewing"
  | "after_viewing"
  | "to_offer"
  | "rejected"
  | "bought";
export type ListingContactEventType =
  | "call"
  | "message"
  | "email"
  | "meeting"
  | "viewing_note"
  | "negotiation"
  | "status_change"
  | "other";

export type SearchContract = {
  city: string;
  minPrice: number;
  maxPrice: number;
  minArea: number;
  roomsMin: number;
};

export type DreamListingProfile = {
  label: string;
  preferredDistricts: string[];
  minArea: number;
  maxArea: number;
  minRooms: number;
  maxPrice: number;
  maxPricePerSqm: number;
  maxMetroDistanceMeters: number;
  requiresGarage: boolean;
  prefersBalcony: boolean;
};

export const defaultDownPayment = 430_000;

export type FamilySettings = {
  financing?: { downPayment: number };
  workplaces: Array<{
    key: string;
    label: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }>;
  searchContract: SearchContract;
  dreamProfile: DreamListingProfile;
  weights: Record<"user" | "spouse", EvaluationWeights>;
  maxWeightTotal: number;
};

export type ListingEvaluationSummary = {
  dimensions: EvaluationDimension[];
  settings: FamilySettings;
  entries: ListingEvaluationEntry[];
  totals: Record<EvaluationRaterKey, number>;
  rankingScore: number;
  assistantSuggestions: string[];
};

export type ListingViewingStatus = "scheduled" | "completed" | "cancelled";

export type ListingViewing = {
  id: string;
  listingId: string;
  scheduledAt: string;
  status: ListingViewingStatus;
  notes?: string;
};

export type ListingContactEvent = {
  id: string;
  listingId: string;
  eventType: ListingContactEventType;
  occurredAt: string;
  title?: string;
  notes?: string;
  contactName?: string;
  amount?: number;
  createdAt: string;
};

export type ListingSummary = {
  id: string;
  title: string;
  description?: string;
  canonicalUrl?: string;
  sourceLabel?: string;
  isActive?: boolean;
  publishedAt?: string;
  firstSeenAt?: string;
  city: string;
  district: string;
  neighborhood?: string;
  street?: string;
  addressText?: string;
  priceLabel: string;
  areaLabel: string;
  pricePerSqmLabel?: string;
  roomsCount?: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  hasGarage?: boolean;
  hasOutdoorParking?: boolean;
  hasStorage?: boolean;
  hasLift?: boolean;
  hasBalcony?: boolean;
  hasAirConditioning?: boolean;
  finishQuality?: "ready" | "to_finish" | "unknown";
  additionalPurchaseCosts?: { garage?: number; storage?: number; total: number };
  totalAcquisitionPrice?: number;
  rcnDeltaLabel: string;
  priceChangePercent: number;
  relisting?: {
    previousListingId: string;
    previousPriceAmount?: number;
    relistedPriceAmount?: number;
    priceChange: "same" | "higher" | "lower";
  };
  summary: string;
  thumbnailUrl?: string;
  imageCount: number;
  imageUrls: string[];
  badges: string[];
  latitude?: number;
  longitude?: number;
  coordinateAccuracy?: "exact" | "approximate";
  isShortlisted: boolean;
  contactStatus?: ListingContactStatus;
  decisionStage?: ListingDecisionStage;
  rankingScore?: number;
  dreamScore?: number;
  viewingScheduledAt?: string;
  viewingStatus?: ListingViewingStatus;
  relatedCount?: number;
  potentialDuplicateCount?: number;
};

export type RelatedListingSummary = {
  id: string;
  title: string;
  canonicalUrl?: string;
  sourceLabel?: string;
  priceLabel: string;
  areaLabel: string;
  relationNote?: string;
};

export type RcnComparableTransaction = {
  id: string;
  transactionDate: string;
  street?: string;
  areaSqm: number;
  priceAmount: number;
  pricePerSqm: number;
  distanceMeters: number;
  marketType: "primary" | "secondary";
};

export type ListingDetail = ListingSummary & {
  canonicalUrl?: string;
  sourceContactPhone?: string;
  description?: string;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  features: ListingFeature[];
  rcnTransactions: RcnComparableTransaction[];
  priceHistory: Array<{
    eventType: string;
    changedAt: string;
    previousPriceAmount?: number;
    newPriceAmount?: number;
  }>;
  viewing?: ListingViewing;
  commutes: CommuteSummary[];
  amenities: NearbyAmenitySummary[];
  amenityAnalysis?: AmenityAnalysis;
  manual: {
    contactStatus?: ListingContactStatus;
    decisionStage?: ListingDecisionStage;
    contactName?: string;
    contactPhone?: string;
    contactRole?: string;
    negotiatedPriceAmount?: number;
    askingPriceOverride?: number;
    notes?: string;
    sourceNotes?: string;
    lastContactAt?: string;
    /** Ręczne korekty mają pierwszeństwo przed automatycznym odczytem ogłoszenia. */
    hasLiftOverride?: boolean;
    hasGarageOverride?: boolean;
    hasStorageOverride?: boolean;
    garageCostOverride?: number;
    storageCostOverride?: number;
  };
  contactHistory: ListingContactEvent[];
  relatedListings: RelatedListingSummary[];
};

export type DuplicateReviewStatus = "pending" | "same_listing" | "different_listing";

export type DuplicateListingPreview = {
  id: string;
  title: string;
  canonicalUrl?: string;
  sourceLabel?: string;
  city: string;
  district: string;
  neighborhood?: string;
  street?: string;
  addressText?: string;
  priceLabel: string;
  areaLabel: string;
  pricePerSqmLabel?: string;
  roomsLabel?: string;
  badges: string[];
  relatedCount?: number;
};

export type DuplicateCandidate = {
  pairKey: string;
  confidenceScore: number;
  reasons: string[];
  status: DuplicateReviewStatus;
  left: DuplicateListingPreview;
  right: DuplicateListingPreview;
};

export type DuplicateCandidatesResponse = {
  total: number;
  items: DuplicateCandidate[];
};

export type RelistedListingPreview = {
  id: string;
  title: string;
  sourceLabel: string;
  canonicalUrl?: string;
  priceAmount?: number;
  eventAt: string;
};

export type RelistedListingMatch = {
  previous: RelistedListingPreview;
  current: RelistedListingPreview;
  priceDifferenceAmount?: number;
  priceDifferencePercent?: number;
  confidenceScore: number;
  reasons: string[];
};

export type RelistedListingsScanResponse = {
  checkedActive: number;
  checkedArchived: number;
  matched: number;
  items: RelistedListingMatch[];
};

export type ListingCard = ListingSummary;

export type AlertSummary = {
  id: string;
  name: string;
  city: string;
  district?: string;
  trigger: string;
  deliveryChannel: "email" | "telegram" | "web";
  status: "active" | "paused";
  listingId?: string;
  severity?: "high" | "medium" | "low";
};

export type DashboardResponse = {
  market: string;
  stats: DashboardStat[];
  listings: ListingSummary[];
};

export type ListingsResponse = {
  total: number;
  items: ListingSummary[];
};

export type AlertsResponse = {
  total: number;
  items: AlertSummary[];
};

export type CollectorRunResponse = {
  listingId: string;
  snapshotId: string;
  action: "created" | "updated" | "unchanged";
  parsed: {
    externalId: string;
    title: string;
    city: string;
    district?: string;
    neighborhood?: string;
    imageCount: number;
  };
  archivedArtifacts: {
    basePath: string;
    rawHtmlPath: string;
    parsedJsonPath: string;
  };
  mediaResults: Array<{
    assetId: string;
    status: string;
    outputPath?: string;
    reason?: string;
  }>;
};

export type RcnImportResponse = {
  scope: string;
  checkedPowiatCount: number;
  importedTransactions: number;
  powiats: Array<{
    key: string;
    label: string;
    wfsCapabilitiesUrl: string;
    status: "planned" | "checked" | "imported" | "failed";
    featureTypes?: string[];
    importedCount?: number;
    error?: string;
  }>;
};

export type OtodomDiscoverAllResponse = {
  city: string;
  startPage: number;
  scannedPages: number;
  discovered: number;
  queued: number;
  stoppedBecause: "empty_batches" | "max_pages" | "error";
  error?: string;
};

export type OtodomQueueProcessResponse = {
  claimed: number;
  completed: number;
  failed: number;
  deferred?: number;
  pausedUntil?: string;
  failures: Array<{
    externalId: string;
    url: string;
    error: string;
  }>;
};

export type OtodomQueueStatusResponse = {
  sourceKey: string;
  counts: Record<"pending" | "processing" | "completed" | "failed", number>;
  pendingNew: number;
  pendingPriceUpdates: number;
  readyPending?: number;
  delayedPending?: number;
  nextAttemptAt?: string;
  recentFailures: Array<{
    external_id: string;
    canonical_url: string;
    last_error: string | null;
  }>;
};

export type OtodomRunAllResponse = {
  discoverAll: OtodomDiscoverAllResponse;
  processedRounds: number;
  totalClaimed: number;
  totalCompleted: number;
  totalFailed: number;
  finalQueueStatus: OtodomQueueStatusResponse;
  stoppedBecause: "queue_empty" | "max_rounds" | "no_progress";
};

export type MediaBackfillResponse = {
  requested: number;
  downloaded: number;
  failed: number;
  skipped: number;
  results: Array<{
    assetId: string;
    status: string;
    outputPath?: string;
    reason?: string;
  }>;
};

export type RecentOffersResponse = {
  total: number;
  items: ListingSummary[];
};

export type UpcomingViewingsResponse = {
  total: number;
  items: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    scheduledAt: string;
    status: ListingViewingStatus;
    city: string;
    district?: string;
    addressText?: string;
    notes?: string;
  }>;
};

export type ListingFilters = {
  city?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minPricePerSqm?: number;
  maxPricePerSqm?: number;
  roomsMin?: number;
  roomsMax?: number;
  search?: string;
  shortlistedOnly?: boolean;
  priceChangedOnly?: boolean;
  archivedOnly?: boolean;
  hiddenOnly?: boolean;
  includeAllCities?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "price_desc" | "price_asc" | "area_desc" | "area_asc" | "dream_desc";
};

export const evaluationDimensions: EvaluationDimension[] = [
  { key: "location", label: "Lokalizacja" },
  { key: "layout", label: "Układ" },
  { key: "condition", label: "Stan techniczny" },
  { key: "price", label: "Cena" },
  { key: "fees", label: "Czynsz" },
  { key: "balcony_garden", label: "Balkon/ogródek" },
  { key: "noise", label: "Hałas" },
  { key: "sunlight", label: "Nasłonecznienie" },
  { key: "garage", label: "Garaż" },
  { key: "building_standard", label: "Standard budynku" },
  { key: "shops", label: "Sklepy" },
  { key: "neighborhood", label: "Okolica" },
  { key: "potential", label: "Potencjał" },
  { key: "resale", label: "Późniejsza sprzedaż" },
  { key: "child_friendly", label: "Oferta dla dziecka" },
  { key: "healthcare", label: "Apteka/szpital" },
  { key: "amount_to_change", label: "Zakres zmian" },
];

export function createDefaultSearchContract(): SearchContract {
  return {
    city: "Warszawa",
    minPrice: 900000,
    maxPrice: 2200000,
    minArea: 56,
    roomsMin: 3,
  };
}

export function createDefaultWeights(): EvaluationWeights {
  return Object.fromEntries(
    evaluationDimensions.map((dimension) => [dimension.key, 4]),
  ) as EvaluationWeights;
}

export function createDefaultDreamListingProfile(): DreamListingProfile {
  return {
    label: "Mieszkanie docelowe",
    preferredDistricts: [
      "Mokotów",
      "Żoliborz",
      "Saska Kępa",
      "Ochota",
      "Praga-Północ",
      "Wola",
      "Śródmieście",
      "Ursynów",
      "Wilanów",
    ],
    minArea: 70,
    maxArea: 110,
    minRooms: 3,
    maxPrice: 1800000,
    maxPricePerSqm: 22000,
    maxMetroDistanceMeters: 1200,
    requiresGarage: true,
    prefersBalcony: true,
  };
}

export type MetroStation = {
  name: string;
  latitude: number;
  longitude: number;
};

export const warsawMetroStations: MetroStation[] = [
  { name: "Kabaty", latitude: 52.1309, longitude: 21.0651 },
  { name: "Natolin", latitude: 52.1411, longitude: 21.0566 },
  { name: "Imielin", latitude: 52.1493, longitude: 21.0454 },
  { name: "Stokłosy", latitude: 52.1561, longitude: 21.0347 },
  { name: "Ursynów", latitude: 52.1618, longitude: 21.0279 },
  { name: "Służew", latitude: 52.1727, longitude: 21.026 },
  { name: "Wilanowska", latitude: 52.1817, longitude: 21.0225 },
  { name: "Wierzbno", latitude: 52.1895, longitude: 21.0177 },
  { name: "Racławicka", latitude: 52.1984, longitude: 21.012 },
  { name: "Pole Mokotowskie", latitude: 52.2088, longitude: 21.0078 },
  { name: "Politechnika", latitude: 52.2175, longitude: 21.015 },
  { name: "Centrum", latitude: 52.23, longitude: 21.0107 },
  { name: "Świętokrzyska", latitude: 52.235, longitude: 21.0089 },
  { name: "Ratusz Arsenał", latitude: 52.2441, longitude: 21.001 },
  { name: "Dworzec Gdański", latitude: 52.2577, longitude: 20.9946 },
  { name: "Plac Wilsona", latitude: 52.2691, longitude: 20.9846 },
  { name: "Marymont", latitude: 52.2719, longitude: 20.9729 },
  { name: "Słodowiec", latitude: 52.2767, longitude: 20.9602 },
  { name: "Stare Bielany", latitude: 52.2815, longitude: 20.9494 },
  { name: "Wawrzyszew", latitude: 52.2868, longitude: 20.9398 },
  { name: "Młociny", latitude: 52.2907, longitude: 20.929 },
  { name: "Bemowo", latitude: 52.2372, longitude: 20.9131 },
  { name: "Ulrychów", latitude: 52.2404, longitude: 20.929 },
  { name: "Księcia Janusza", latitude: 52.2394, longitude: 20.9434 },
  { name: "Młynów", latitude: 52.2379, longitude: 20.9608 },
  { name: "Płocka", latitude: 52.233, longitude: 20.9669 },
  { name: "Rondo Daszyńskiego", latitude: 52.2303, longitude: 20.9847 },
  { name: "Rondo ONZ", latitude: 52.2331, longitude: 20.9988 },
  { name: "Nowy Świat-Uniwersytet", latitude: 52.2368, longitude: 21.0179 },
  { name: "Centrum Nauki Kopernik", latitude: 52.2393, longitude: 21.0302 },
  { name: "Stadion Narodowy", latitude: 52.2466, longitude: 21.0436 },
  { name: "Dworzec Wileński", latitude: 52.2548, longitude: 21.0356 },
  { name: "Szwedzka", latitude: 52.2634, longitude: 21.044 },
  { name: "Targówek Mieszkaniowy", latitude: 52.269, longitude: 21.051 },
  { name: "Trocka", latitude: 52.2756, longitude: 21.055 },
  { name: "Zacisze", latitude: 52.2832, longitude: 21.0648 },
  { name: "Kondratowicza", latitude: 52.2919, longitude: 21.0488 },
  { name: "Bródno", latitude: 52.2953, longitude: 21.0297 },
];

export function distanceMetersBetween(
  latitude: number,
  longitude: number,
  targetLatitude: number,
  targetLongitude: number,
) {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(targetLatitude - latitude);
  const dLon = toRadians(targetLongitude - longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(targetLatitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export function findNearestWarsawMetroStation(latitude?: number, longitude?: number) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return (
    warsawMetroStations
      .map((station) => ({
        ...station,
        distanceMeters: Math.round(
          distanceMetersBetween(latitude, longitude, station.latitude, station.longitude),
        ),
      }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters)[0] ?? null
  );
}

export function createDefaultFamilySettings(): FamilySettings {
  return {
    financing: { downPayment: defaultDownPayment },
    workplaces: [],
    searchContract: createDefaultSearchContract(),
    dreamProfile: createDefaultDreamListingProfile(),
    weights: {
      user: createDefaultWeights(),
      spouse: createDefaultWeights(),
    },
    maxWeightTotal: 80,
  };
}

export const sampleStats: DashboardStat[] = [
  {
    label: "Aktywne oferty",
    value: "1 284",
    description: "po normalizacji i deduplikacji w miescie pilotażowym",
  },
  {
    label: "Zmiany cen / 7 dni",
    value: "173",
    description: "snapshoty wykryte przez warstwe monitoringu",
  },
  {
    label: "Średnia cena / m²",
    value: "18 420 zł",
    description: "średnia cena ofertowa w aktywnych ofertach",
  },
];

export const sampleListings: ListingCard[] = [
  {
    id: "listing-1",
    title: "Mokotow, 3 pokoje, blisko metra",
    city: "Warszawa",
    district: "Mokotow",
    priceLabel: "1 185 000 PLN",
    areaLabel: "62.4 m2",
    pricePerSqmLabel: "18 990 PLN/m2",
    rcnDeltaLabel: "+8.7% vs RCN",
    priceChangePercent: -4.2,
    summary: "Cena spadla drugi raz w ciagu 12 dni. Oferta nadal powyzej mediany transakcyjnej.",
    imageCount: 2,
    imageUrls: [],
    badges: [],
    isShortlisted: true,
    rankingScore: 74,
  },
  {
    id: "listing-2",
    title: "Praga Poludnie, 2 pokoje po remoncie",
    city: "Warszawa",
    district: "Praga Poludnie",
    priceLabel: "789 000 PLN",
    areaLabel: "44.9 m2",
    pricePerSqmLabel: "17 573 PLN/m2",
    rcnDeltaLabel: "-2.1% vs RCN",
    priceChangePercent: -6.8,
    summary: "Oferta ponizej mediany RCN. Kandydat do alertu 'okazja'.",
    imageCount: 1,
    imageUrls: [],
    badges: [],
    isShortlisted: false,
    rankingScore: 68,
  },
  {
    id: "listing-3",
    title: "Wola, 4 pokoje, inwestycja deweloperska",
    city: "Warszawa",
    district: "Wola",
    priceLabel: "1 420 000 PLN",
    areaLabel: "71.1 m2",
    pricePerSqmLabel: "19 972 PLN/m2",
    rcnDeltaLabel: "+1.9% vs RCN",
    priceChangePercent: 0,
    summary: "Nowa oferta wprowadzona do watchlisty. Brak jeszcze historii zmian.",
    imageCount: 1,
    imageUrls: [],
    badges: [],
    isShortlisted: false,
    rankingScore: 63,
  },
];

export const sampleAlerts: AlertSummary[] = [
  {
    id: "alert-1",
    name: "Mokotow do 1.2 mln",
    city: "Warszawa",
    district: "Mokotow",
    trigger: "Spadek ceny o min. 3% lub nowa oferta 2-3 pokoje",
    deliveryChannel: "telegram",
    status: "active",
  },
  {
    id: "alert-2",
    name: "Oferty ponizej mediany RCN",
    city: "Warszawa",
    trigger: "Cena ofertowa co najmniej 2% ponizej mediany transakcyjnej",
    deliveryChannel: "email",
    status: "active",
  },
];
