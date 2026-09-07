import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DescriptionReview, SurroundingsSummary, MarketPulse } from "./AnalysisInsights";
import { FullscreenFrame, useMapResize } from "./FullscreenFrame";
import { DuplicateGroupsPanel } from "./DuplicateGroupsPanel";
import { StatsDistrictMap } from "./StatsDistrictMap";
import { calculateMortgage } from "./mortgage-simulation";
import { Building2, WifiOff, Archive, Calculator, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Columns3, DatabaseZap, GitCompareArrows, ImageDown, LayoutDashboard, LoaderCircle, Map as MapIcon, MapPin, Maximize2, Minimize2, Moon, NotebookPen, PanelLeftClose, PanelLeftOpen, Phone, Play, RefreshCw, RotateCcw, Search, Settings2, SlidersHorizontal, Star, Sun, Trash2, X } from "lucide-react";
import { findNearestWarsawMetroStation, warsawMetroStations } from "@mieszkania/shared";
import { getDescriptionHighlightParts, getSunExposure, normalizeListingText, type ExposureDirection } from "./listing-language";
import { calculateBankCosts, calculatePurchaseCosts, mortgageInsurancePresets, type MortgageInsurancePreset } from "./mortgage-costs";
import type {
  AlertsResponse,
  CollectorRunResponse,
  DashboardStat,
  DashboardResponse,
  DuplicateCandidate,
  DuplicateCandidatesResponse,
  FamilySettings,
  ListingContactEventType,
  ListingContactStatus,
  ListingDetail,
  ListingFilters,
  ListingsResponse,
  ListingSummary,
  MediaBackfillResponse,
  OtodomDiscoverAllResponse,
  OtodomQueueProcessResponse,
  OtodomQueueStatusResponse,
  OtodomRunAllResponse,
  ParcelGeometry,
  ParcelContextResponse,
  PlanningContextResponse,
  RcnImportResponse,
  RelistedListingsScanResponse,
  SupportedRegion,
  UpcomingViewingsResponse
  , MarketStatsResponse
} from "@mieszkania/shared";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";
const DEFAULT_DOWN_PAYMENT = 430_000;
const PremiumMortgageVisuals = lazy(() => import("./MortgageVisuals"));
const MarketActivityChart = lazy(() => import("./MarketActivityChart"));
type AppTab = "dashboard" | "compare" | "map" | "operations" | "backfill" | "mortgage" | "duplicates" | "stats";
type MortgageDraft = { principal: number; propertyTotal: number; listingTitle?: string; listingId?: string };
type DuplicateGroupOverview = { groupId: string; primaryListingId: string; primaryTitle: string; members: Array<{ id: string; title: string; sourceLabel: string; canonicalUrl?: string; thumbnailUrl?: string; priceLabel: string; areaLabel: string; isPrimary: boolean }> };
type ListingSortKey = "newest" | "oldest" | "price_desc" | "price_asc" | "area_desc" | "area_asc" | "dream_desc";
type MarketStatsFilters = { minYear: string; minArea: string; maxArea: string; elevator: boolean; garage: boolean };
type ListingsSession = { activeTab: AppTab; filters: ListingFilters; listingSort: ListingSortKey; currentListingsPage: number };
const listingsPerPage = 30;
const listingsSessionStorageKey = "mieszkania-listings-session-v1";
type ReadyState = {
  status: "ready";
  dashboard: DashboardResponse;
  alerts: AlertsResponse;
  region: SupportedRegion;
  settings: FamilySettings;
  upcomingViewings: UpcomingViewingsResponse;
};
type LoadState = { status: "loading" } | { status: "error"; message: string } | ReadyState;
type DuplicateAutoMergeResult = { checked: number; merged: number };
type StaleListingRefreshStatus = {
  due: number;
  started?: boolean;
  running: boolean;
  refreshedLast24Hours?: number;
  nextDueAt?: string;
  lastCheckedAt?: string;
  automationPaused?: boolean;
};

declare global {
  interface Window {
    L?: any;
  }
}

const defaultFilters: ListingFilters = {};
type MapCoordinate = { name: string; latitude: number; longitude: number };
type MetroMapLine = { code: "M1" | "M2" | "M3" | "M4" | "M5"; planned?: boolean; stations: MapCoordinate[] };
const metroLineColors = { M1: "#ca2839", M2: "#f0bd32", M3: "#2563b8", M4: "#167451", M5: "#8545ac" };

const warsawDistrictCoordinates: MapCoordinate[] = [
  { name: "Bemowo", latitude: 52.2382, longitude: 20.9134 }, { name: "Białołęka", latitude: 52.3202, longitude: 21.0106 },
  { name: "Bielany", latitude: 52.2921, longitude: 20.9347 }, { name: "Mokotów", latitude: 52.1937, longitude: 21.0340 },
  { name: "Ochota", latitude: 52.2122, longitude: 20.9727 }, { name: "Praga-Północ", latitude: 52.2601, longitude: 21.0292 },
  { name: "Praga-Południe", latitude: 52.2380, longitude: 21.0838 }, { name: "Śródmieście", latitude: 52.2319, longitude: 21.0067 },
  { name: "Targówek", latitude: 52.2751, longitude: 21.0587 }, { name: "Ursus", latitude: 52.1952, longitude: 20.8842 },
  { name: "Ursynów", latitude: 52.1410, longitude: 21.0323 }, { name: "Wawer", latitude: 52.2084, longitude: 21.1604 },
  { name: "Wesoła", latitude: 52.2540, longitude: 21.2241 }, { name: "Wilanów", latitude: 52.1637, longitude: 21.0876 },
  { name: "Włochy", latitude: 52.1862, longitude: 20.9489 }, { name: "Wola", latitude: 52.2326, longitude: 20.9521 },
  { name: "Żoliborz", latitude: 52.2680, longitude: 20.9864 }
];
const warsawMetroLines: MetroMapLine[] = [
  { code: "M1", stations: warsawMetroStations.slice(0, 21) },
  { code: "M2", stations: [...warsawMetroStations.slice(21, 28), { name: "Świętokrzyska", latitude: 52.2350, longitude: 21.0089 }, ...warsawMetroStations.slice(28)] },
  { code: "M3", planned: true, stations: [
    { name: "Stadion Narodowy", latitude: 52.2466, longitude: 21.0436 }, { name: "Dworzec Wschodni", latitude: 52.2525501, longitude: 21.05125 },
    { name: "Mińska", latitude: 52.251368, longitude: 21.074192 }, { name: "Rondo Wiatraczna", latitude: 52.2451407, longitude: 21.0857703 },
    { name: "Ostrobramska", latitude: 52.234885, longitude: 21.097483 }, { name: "Jana Nowaka-Jeziorańskiego", latitude: 52.231057, longitude: 21.095580 },
    { name: "Gocław", latitude: 52.224858, longitude: 21.092423 }
  ] },
  { code: "M4", planned: true, stations: [
    { name: "Myśliborska", latitude: 52.3132324, longitude: 20.9643612 }, { name: "Obrazkowa", latitude: 52.3130295, longitude: 20.967339 },
    { name: "Płochocińska", latitude: 52.3135506, longitude: 21.0018842 }, { name: "Ruda", latitude: 52.2835019, longitude: 20.9767459 },
    { name: "Marymont", latitude: 52.2715768, longitude: 20.9719399 }, { name: "Rydygiera", latitude: 52.2582766, longitude: 20.9704965 },
    { name: "Rondo Radosława", latitude: 52.2548555, longitude: 20.9832393 }, { name: "Cmentarz Żydowski", latitude: 52.2478236, longitude: 20.9744027 },
    { name: "Okopowa", latitude: 52.239102, longitude: 20.9796764 }, { name: "Rondo Daszyńskiego", latitude: 52.2300827, longitude: 20.9828946 },
    { name: "Plac Zawiszy", latitude: 52.2247888, longitude: 20.9886965 }, { name: "Plac Narutowicza", latitude: 52.2190384, longitude: 20.985049 },
    { name: "Bitwy Warszawskiej 1920", latitude: 52.2160552, longitude: 20.9623309 }, { name: "Wiślicka", latitude: 52.2035987, longitude: 20.9775282 },
    { name: "Żwirki i Wigury", latitude: 52.2155423, longitude: 20.9882034 }, { name: "Służewiec", latitude: 52.1805647, longitude: 20.9937829 },
    { name: "Rondo Unii Europejskiej", latitude: 52.1781621, longitude: 21.001861 }, { name: "Smoluchowskiego", latitude: 52.1791432, longitude: 21.0111472 },
    { name: "Wilanowska", latitude: 52.1818168, longitude: 21.0231452 }, { name: "Dolina Służewiecka", latitude: 52.167642, longitude: 21.0357124 },
    { name: "Patkowskiego", latitude: 52.1726949, longitude: 21.0545545 }, { name: "Sobieskiego", latitude: 52.1767, longitude: 21.0605 },
    { name: "Wilanów", latitude: 52.1661431, longitude: 21.0902262 }
  ] },
  { code: "M2", planned: true, stations: [
    { name: "Bemowo", latitude: 52.2372, longitude: 20.9131 }, { name: "Lazurowa", latitude: 52.2270021, longitude: 20.8967806 },
    { name: "Chrzanów", latitude: 52.2166113, longitude: 20.8955248 }, { name: "Karolin", latitude: 52.212901, longitude: 20.8862282 }
  ] },
  { code: "M2", planned: true, stations: [
    { name: "Karolin (kierunek Ursus)", latitude: 52.212901, longitude: 20.8862282 }, { name: "Ursus Północny", latitude: 52.2057501, longitude: 20.889622 },
    { name: "Posag 7 Panien", latitude: 52.2062959, longitude: 20.8863659 }, { name: "Ursus-Niedźwiadek", latitude: 52.1951289, longitude: 20.8698961 }
  ] },
  { code: "M5", planned: true, stations: [
    { name: "Ursus-Niedźwiadek (korytarz)", latitude: 52.1951289, longitude: 20.8698961 }, { name: "Szamoty (korytarz)", latitude: 52.2020867, longitude: 20.8868026 },
    { name: "Skorosze (korytarz)", latitude: 52.192016, longitude: 20.899866 }, { name: "Wiktoryn (korytarz)", latitude: 52.1964511, longitude: 20.9349821 },
    { name: "Aleje Jerozolimskie (korytarz)", latitude: 52.1879322, longitude: 20.9121723 }, { name: "Śmigłowca (korytarz)", latitude: 52.209226, longitude: 20.9494832 },
    { name: "Plac Narutowicza (korytarz)", latitude: 52.2190384, longitude: 20.985049 }, { name: "Plac Konstytucji (korytarz)", latitude: 52.2216901, longitude: 21.0164613 },
    { name: "Saska Kępa (korytarz)", latitude: 52.2329941, longitude: 21.0571754 }, { name: "Ostrobramska (korytarz)", latitude: 52.2332018, longitude: 21.1125727 },
    { name: "Gocławek (korytarz)", latitude: 52.2383574, longitude: 21.1265486 }
  ] }
];
const warsawRailLines: Array<{ name: string; stations: MapCoordinate[] }> = [
  { name: "PKP – linia średnicowa", stations: [
    { name: "Warszawa Zachodnia", latitude: 52.2206, longitude: 20.9670 }, { name: "Warszawa Ochota", latitude: 52.2207, longitude: 20.9822 },
    { name: "Warszawa Centralna", latitude: 52.2283, longitude: 21.0037 }, { name: "Warszawa Śródmieście", latitude: 52.2282, longitude: 21.0067 },
    { name: "Warszawa Powiśle", latitude: 52.2354, longitude: 21.0265 }, { name: "Warszawa Stadion", latitude: 52.2470, longitude: 21.0475 },
    { name: "Warszawa Wschodnia", latitude: 52.2526, longitude: 21.0513 }
  ] },
  { name: "PKP/SKM – linia obwodowa", stations: [
    { name: "Warszawa Gdańska", latitude: 52.2575, longitude: 20.9945 }, { name: "Warszawa Koło", latitude: 52.2398, longitude: 20.9455 },
    { name: "Warszawa Wola", latitude: 52.2320, longitude: 20.9653 }, { name: "Warszawa Zachodnia", latitude: 52.2206, longitude: 20.9670 },
    { name: "Warszawa Rakowiec", latitude: 52.2018, longitude: 20.9731 }, { name: "Warszawa Żwirki i Wigury", latitude: 52.1900, longitude: 20.9820 },
    { name: "Warszawa Służewiec", latitude: 52.1749, longitude: 20.9970 }
  ] },
  { name: "WKD", stations: [
    { name: "Warszawa Śródmieście WKD", latitude: 52.2263, longitude: 21.0018 }, { name: "Warszawa Ochota WKD", latitude: 52.2205, longitude: 20.9812 },
    { name: "Warszawa Reduta Ordona WKD", latitude: 52.2130, longitude: 20.9612 }, { name: "Warszawa Aleje Jerozolimskie WKD", latitude: 52.2050, longitude: 20.9460 },
    { name: "Warszawa Raków WKD", latitude: 52.1988, longitude: 20.9320 }, { name: "Warszawa Salomea WKD", latitude: 52.1913, longitude: 20.9143 },
    { name: "Opacz WKD", latitude: 52.1827, longitude: 20.8930 }, { name: "Michałowice WKD", latitude: 52.1687, longitude: 20.8822 }
  ] }
];
const warsawDreamDistrictCatalog = [
  { district: "Bemowo", subdistricts: ["Górce", "Jelonki", "Boernerowo", "Chrzanów"] },
  { district: "Białołęka", subdistricts: ["Tarchomin", "Nowodwory", "Żerań", "Brzeziny"] },
  { district: "Bielany", subdistricts: ["Słodowiec", "Stare Bielany", "Wawrzyszew", "Młociny"] },
  { district: "Mokotów", subdistricts: ["Służew", "Sadyba", "Stegny", "Ksawerów", "Wyględów", "Stary Mokotów"] },
  { district: "Ochota", subdistricts: ["Stara Ochota", "Filtry", "Rakowiec", "Szczęśliwice"] },
  { district: "Praga-Południe", subdistricts: ["Gocław", "Saska Kępa", "Grochów", "Kamionek"] },
  { district: "Praga-Północ", subdistricts: ["Nowa Praga", "Stara Praga", "Szmulowizna"] },
  { district: "Śródmieście", subdistricts: ["Powiśle", "Muranów", "Nowe Miasto", "Stare Miasto", "Centrum"] },
  { district: "Ursus", subdistricts: ["Skorosze", "Niedźwiadek", "Gołąbki"] },
  { district: "Ursynów", subdistricts: ["Kabaty", "Natolin", "Imielin", "Stokłosy", "Pyry"] },
  { district: "Wawer", subdistricts: ["Anin", "Międzylesie", "Radość", "Falenica"] },
  { district: "Wesoła", subdistricts: ["Stara Miłosna", "Zielona", "Wola Grzybowska"] },
  { district: "Wilanów", subdistricts: ["Miasteczko Wilanów", "Powsin", "Zawady"] },
  { district: "Włochy", subdistricts: ["Okęcie", "Nowe Włochy", "Stare Włochy"] },
  { district: "Wola", subdistricts: ["Odolany", "Młynów", "Czyste", "Koło", "Ulrychów"] },
  { district: "Żoliborz", subdistricts: ["Stary Żoliborz", "Sady Żoliborskie", "Marymont", "Powązki"] }
] as const;

export function App() {
  const [initialListingsSession] = useState(readListingsSession);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeTab, setActiveTab] = useState<AppTab>(initialListingsSession.activeTab);
  const [filters, setFilters] = useState<ListingFilters>(initialListingsSession.filters);
  const [filtersPanelCollapsed, setFiltersPanelCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("mieszkania-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [listingSort, setListingSort] = useState<ListingSortKey>(initialListingsSession.listingSort);
  const [filteredListings, setFilteredListings] = useState<ListingSummary[]>([]);
  const [mapListings, setMapListings] = useState<ListingSummary[]>([]);
  const [isLoadingMapListings, setIsLoadingMapListings] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [mortgageDraft, setMortgageDraft] = useState<MortgageDraft>({ principal: 0, propertyTotal: 0 });
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroupOverview[]>([]);
  const [isLoadingDuplicateGroups, setIsLoadingDuplicateGroups] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<string | null>(null);
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [duplicateTotals, setDuplicateTotals] = useState({ members: 0, copies: 0 });
  const [queueStatusError, setQueueStatusError] = useState<string | null>(null);
  const [queueStatusCheckedAt, setQueueStatusCheckedAt] = useState<Date | null>(null);
  const [marketStatsError, setMarketStatsError] = useState<string | null>(null);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [currentListingsPage, setCurrentListingsPage] = useState(initialListingsSession.currentListingsPage);
  const listingsMainRef = useRef<HTMLDivElement | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingDetail | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStatsResponse | null>(null);
  const [marketStatsLoading, setMarketStatsLoading] = useState(false);
  const [marketStatsFilters, setMarketStatsFilters] = useState<MarketStatsFilters>({ minYear: "", minArea: "", maxArea: "", elevator: false, garage: false });
  const [marketStatsDraftFilters, setMarketStatsDraftFilters] = useState<MarketStatsFilters>({ minYear: "", minArea: "", maxArea: "", elevator: false, garage: false });
  const [marketStatsBaseline, setMarketStatsBaseline] = useState<MarketStatsResponse | null>(null);
  const [marketStatsPeriod, setMarketStatsPeriod] = useState<30 | 90 | 180>(30);
  const [selectedListingDuplicateCandidates, setSelectedListingDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [isOpeningListing, setIsOpeningListing] = useState(false);
  const [isLoadingListingInsights, setIsLoadingListingInsights] = useState(false);
  const [isLoadingDuplicateCandidates, setIsLoadingDuplicateCandidates] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [compareListingIds, setCompareListingIds] = useState<string[]>([]);
  const [collectUrl, setCollectUrl] = useState("");
  const [bulkCity, setBulkCity] = useState("warszawa");
  const [bulkStartPage, setBulkStartPage] = useState("1");
  const [bulkPages, setBulkPages] = useState("3");
  const [bulkLimit, setBulkLimit] = useState("12");
  const [discoverAllCity, setDiscoverAllCity] = useState("warszawa");
  const [discoverAllMaxPages, setDiscoverAllMaxPages] = useState("50");
  const [discoverAllBatchPages, setDiscoverAllBatchPages] = useState("5");
  const [queueLimit, setQueueLimit] = useState("200");
  const [queueConcurrency, setQueueConcurrency] = useState("8");
  const [mediaBackfillLimit, setMediaBackfillLimit] = useState("150");
  const [collectResult, setCollectResult] = useState<CollectorRunResponse | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    discovered: number;
    collected: number;
    startPage: number;
    pagesScanned: number;
    limitApplied: number;
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
  } | null>(null);
  const [rcnResult, setRcnResult] = useState<RcnImportResponse | null>(null);
  const [rcnError, setRcnError] = useState<string | null>(null);
  const [discoverAllResult, setDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [gratkaDiscoverAllResult, setGratkaDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [olxDiscoverAllResult, setOlxDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [nieruchomosciOnlineDiscoverAllResult, setNieruchomosciOnlineDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [domiportaDiscoverAllResult, setDomiportaDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [maxonDiscoverAllResult, setMaxonDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [adresowoDiscoverAllResult, setAdresowoDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [morizonDiscoverAllResult, setMorizonDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(null);
  const [staleListingRefresh, setStaleListingRefresh] = useState<StaleListingRefreshStatus | null>(null);
  const [queueProcessResult, setQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [gratkaQueueProcessResult, setGratkaQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [olxQueueProcessResult, setOlxQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [nieruchomosciOnlineQueueProcessResult, setNieruchomosciOnlineQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [domiportaQueueProcessResult, setDomiportaQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [maxonQueueProcessResult, setMaxonQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [adresowoQueueProcessResult, setAdresowoQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [morizonQueueProcessResult, setMorizonQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(null);
  const [queueStatus, setQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [gratkaQueueStatus, setGratkaQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [olxQueueStatus, setOlxQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [nieruchomosciOnlineQueueStatus, setNieruchomosciOnlineQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [domiportaQueueStatus, setDomiportaQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [maxonQueueStatus, setMaxonQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [adresowoQueueStatus, setAdresowoQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [morizonQueueStatus, setMorizonQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);
  const [runAllResult, setRunAllResult] = useState<OtodomRunAllResponse | null>(null);
  const [gratkaRunAllResult, setGratkaRunAllResult] = useState<OtodomRunAllResponse | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueErrorAction, setQueueErrorAction] = useState<"discover" | "process" | null>(null);
  const [queueNotice, setQueueNotice] = useState<{ tone: "info" | "success"; message: string } | null>(null);
  const [mediaBackfillResult, setMediaBackfillResult] = useState<MediaBackfillResponse | null>(null);
  const [mediaBackfillError, setMediaBackfillError] = useState<string | null>(null);
  const [duplicateAutoMergeResult, setDuplicateAutoMergeResult] = useState<DuplicateAutoMergeResult | null>(null);
  const [duplicateAutoMergeError, setDuplicateAutoMergeError] = useState<string | null>(null);
  const [relistingScanResult, setRelistingScanResult] = useState<RelistedListingsScanResponse | null>(null);
  const [relistingScanError, setRelistingScanError] = useState<string | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isBulkCollecting, setIsBulkCollecting] = useState(false);
  const [isImportingRcn, setIsImportingRcn] = useState(false);
  const [isDiscoveringAll, setIsDiscoveringAll] = useState(false);
  const [isDiscoveringGratka, setIsDiscoveringGratka] = useState(false);
  const [isDiscoveringAllPortals, setIsDiscoveringAllPortals] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isProcessingGratkaQueue, setIsProcessingGratkaQueue] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isRunningGratkaAll, setIsRunningGratkaAll] = useState(false);
  const [isProcessingAllPortals, setIsProcessingAllPortals] = useState(false);
  const [isTogglingListingAutomation, setIsTogglingListingAutomation] = useState(false);
  const [isRefreshingQueueStatus, setIsRefreshingQueueStatus] = useState(false);
  const [isRetryingFailedQueue, setIsRetryingFailedQueue] = useState(false);
  const [isRetryingFailedGratkaQueue, setIsRetryingFailedGratkaQueue] = useState(false);
  const [isRetryingFailedOlxQueue, setIsRetryingFailedOlxQueue] = useState(false);
  const [isRetryingFailedNieruchomosciOnlineQueue, setIsRetryingFailedNieruchomosciOnlineQueue] = useState(false);
  const [isRetryingFailedDomiportaQueue, setIsRetryingFailedDomiportaQueue] = useState(false);
  const [isRetryingFailedMaxonQueue, setIsRetryingFailedMaxonQueue] = useState(false);
  const [isRetryingFailedAdresowoQueue, setIsRetryingFailedAdresowoQueue] = useState(false);
  const [isRetryingFailedMorizonQueue, setIsRetryingFailedMorizonQueue] = useState(false);
  const [isResettingProcessingQueue, setIsResettingProcessingQueue] = useState(false);
  const [isResettingProcessingGratkaQueue, setIsResettingProcessingGratkaQueue] = useState(false);
  const [isResettingProcessingOlxQueue, setIsResettingProcessingOlxQueue] = useState(false);
  const [isDeletingOlxData, setIsDeletingOlxData] = useState(false);
  const [isBackfillingMedia, setIsBackfillingMedia] = useState(false);
  const [isImportingWarsawStreets, setIsImportingWarsawStreets] = useState(false);
  const [warsawStreetImportResult, setWarsawStreetImportResult] = useState<{ imported: number; received: number } | null>(null);
  const [isEnrichingListingsFromStreets, setIsEnrichingListingsFromStreets] = useState(false);
  const [streetEnrichmentResult, setStreetEnrichmentResult] = useState<{ scanned: number; matched: number; addressUpdated: number; coordinatesFilled: number; coordinatesOverridden: number } | null>(null);
  const [isRunningDuplicateAutoMerge, setIsRunningDuplicateAutoMerge] = useState(false);
  const [isScanningRelistedListings, setIsScanningRelistedListings] = useState(false);
  const [isUpdatingShortlist, setIsUpdatingShortlist] = useState<string | null>(null);
  const [isDismissingListing, setIsDismissingListing] = useState<string | null>(null);
  const [isArchivingListing, setIsArchivingListing] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingListingManual, setIsSavingListingManual] = useState(false);
  const [isSavingContactEvent, setIsSavingContactEvent] = useState(false);
  const [isBackfillingListingMedia, setIsBackfillingListingMedia] = useState<string | null>(null);
  const [isRefreshingListingData, setIsRefreshingListingData] = useState<string | null>(null);
  const [listingRefreshConfirmation, setListingRefreshConfirmation] = useState<{ listingId: string; refreshedAt: Date; action: CollectorRunResponse["action"] } | null>(null);
  const [isReviewingDuplicatePair, setIsReviewingDuplicatePair] = useState<string | null>(null);
  const processAllAbortRef = useRef<AbortController | null>(null);
  const processAllStartedAtRef = useRef(0);
  const processAllLastProgressAtRef = useRef(0);
  const processAllLastCountsRef = useRef<ReturnType<typeof sumQueueCounts> | null>(null);
  const processAllObservedProgressRef = useRef(false);
  const processAllStopReasonRef = useRef<"completed" | "stalled" | "manual" | null>(null);
  const queueStatusInFlightRef = useRef(false);
  const initialLoadInFlightRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("mieszkania-theme", theme);
  }, [theme]);

  useEffect(() => {
    writeListingsSession({ activeTab, filters, listingSort, currentListingsPage });
  }, [activeTab, filters, listingSort, currentListingsPage]);
  useEffect(() => {
    const key = "mieszkania-scroll-y";
    const restore = () => { const value = Number(sessionStorage.getItem(key) ?? 0); if (value > 0) requestAnimationFrame(() => window.scrollTo({ top: value, behavior: "instant" as ScrollBehavior })); };
    restore();
    const save = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pageshow", restore);
    return () => { save(); window.removeEventListener("scroll", save); window.removeEventListener("pageshow", restore); };
  }, []);

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    const openFromUrl = () => {
      const listingId = new URLSearchParams(window.location.search).get("listing");
      if (listingId && listingId !== selectedListing?.id) void openListing(listingId, false);
      if (!listingId && selectedListing) setSelectedListing(null);
    };
    openFromUrl();
    window.addEventListener("popstate", openFromUrl);
    return () => window.removeEventListener("popstate", openFromUrl);
  }, [state.status, selectedListing?.id]);

  useEffect(() => {
    void refreshQueueStatus();
    void refreshStaleListingStatus();
    const staleStatusIntervalId = window.setInterval(() => void refreshStaleListingStatus(), 60_000);
    return () => window.clearInterval(staleStatusIntervalId);
  }, []);

  useEffect(() => {
    if (!isProcessingAllPortals) return;
    const monitorId = window.setInterval(() => void refreshQueueStatus("monitor"), 3000);
    return () => window.clearInterval(monitorId);
  }, [isProcessingAllPortals]);

  useEffect(() => {
    if (activeTab !== "backfill" || isProcessingAllPortals) return;
    void refreshQueueStatus("monitor");
    const automationMonitorId = window.setInterval(() => void refreshQueueStatus("monitor"), 5_000);
    return () => window.clearInterval(automationMonitorId);
  }, [activeTab, isProcessingAllPortals, staleListingRefresh?.automationPaused]);

  useEffect(() => {
    const statuses = [queueStatus, gratkaQueueStatus, olxQueueStatus, nieruchomosciOnlineQueueStatus, domiportaQueueStatus, maxonQueueStatus, adresowoQueueStatus, morizonQueueStatus];
    const delayedPending = statuses.reduce((sum, status) => sum + (status?.delayedPending ?? 0), 0);
    if (isProcessingAllPortals || delayedPending === 0) return;
    const nextAttemptAt = getNextQueueAttemptAt(...statuses);
    const nextAttemptMs = nextAttemptAt ? new Date(nextAttemptAt).getTime() : Date.now() + 10_000;
    const delayMs = Math.max(1_000, Math.min(60_000, nextAttemptMs - Date.now() + 750));
    const timeoutId = window.setTimeout(() => void refreshQueueStatus("passive"), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [adresowoQueueStatus, domiportaQueueStatus, gratkaQueueStatus, isProcessingAllPortals, maxonQueueStatus, morizonQueueStatus, nieruchomosciOnlineQueueStatus, olxQueueStatus, queueStatus]);

  useEffect(() => {
    if (activeTab === "map") void loadMapListings();
    if (activeTab === "duplicates") void loadDuplicateGroups();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "stats") return;
    setMarketStatsLoading(true);
    const params = new URLSearchParams(); params.set("period", String(marketStatsPeriod)); if (marketStatsFilters.minYear) params.set("minYear", marketStatsFilters.minYear); if (marketStatsFilters.minArea) params.set("minArea", marketStatsFilters.minArea); if (marketStatsFilters.maxArea) params.set("maxArea", marketStatsFilters.maxArea); if (marketStatsFilters.elevator) params.set("elevator", "true"); if (marketStatsFilters.garage) params.set("garage", "true");
    const controller = new AbortController();
    setMarketStatsError(null);
    fetch(`${apiBaseUrl}/api/market-stats?${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Nie udało się pobrać statystyk rynku.")))
      .then((data: MarketStatsResponse) => { if (!controller.signal.aborted) { setMarketStats(data); if (!Object.values(marketStatsFilters).some(Boolean)) setMarketStatsBaseline(data); } })
      .catch((error) => { if (!controller.signal.aborted) setMarketStatsError(error instanceof Error ? error.message : "Nie udało się pobrać statystyk rynku."); })
      .finally(() => { if (!controller.signal.aborted) setMarketStatsLoading(false); });
    return () => controller.abort();
  }, [activeTab, marketStatsFilters, marketStatsPeriod]);

  useEffect(() => {
    if (activeTab !== "stats" || !Object.values(marketStatsFilters).some(Boolean)) return;
    const controller = new AbortController();
    setMarketStatsBaseline(null);
    fetch(`${apiBaseUrl}/api/market-stats?period=${marketStatsPeriod}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data: MarketStatsResponse | null) => { if (data && !controller.signal.aborted) setMarketStatsBaseline(data); }).catch(() => undefined);
    return () => controller.abort();
  }, [activeTab, marketStatsPeriod, Boolean(Object.values(marketStatsFilters).some(Boolean))]);

  if (state.status === "loading") {
    return <Shell title="Ładowanie danych rynku mieszkaniowego" subtitle="Pobieranie dashboardu i ustawień rodziny." />;
  }

  if (state.status === "error") {
    return <Shell title="Nie udało się wczytać aplikacji" subtitle={state.message} error onRetry={() => { setState({ status: "loading" }); void loadInitial(); }} />;
  }

  const { dashboard, alerts, region, settings, upcomingViewings } = state;
  const statsPriceDelta = marketStats && marketStatsBaseline ? Math.round(marketStats.totals.averagePricePerSqm - marketStatsBaseline.totals.averagePricePerSqm) : 0;
  const dashboardListings = applyDreamProfile(dashboard.listings, settings);
  const visibleListings = applyDreamProfile(filteredListings, settings);
  const compareListings = resolveCompareListings(compareListingIds, dashboardListings, visibleListings);
  const totalListingsPages = Math.max(1, Math.ceil(listingsTotal / listingsPerPage));
  const listingInsights = buildListingInsights(dashboard.stats, dashboardListings);
  const listingSectionTitle = filters.archivedOnly ? "Oferty archiwalne" : filters.hiddenOnly ? "Ukryte oferty 2-pokojowe" : "Wszystkie oferty";
  const combinedQueueCounts = sumQueueCounts(queueStatus, gratkaQueueStatus, olxQueueStatus, nieruchomosciOnlineQueueStatus, domiportaQueueStatus, maxonQueueStatus, adresowoQueueStatus, morizonQueueStatus);
  const combinedRecentFailures = [
    ...(queueStatus?.recentFailures.map((failure) => ({ source: "Otodom", ...failure })) ?? []),
    ...(gratkaQueueStatus?.recentFailures.map((failure) => ({ source: "Gratka", ...failure })) ?? []),
    ...(olxQueueStatus?.recentFailures.map((failure) => ({ source: "OLX", ...failure })) ?? [])
    , ...(nieruchomosciOnlineQueueStatus?.recentFailures.map((failure) => ({ source: "Nieruchomosci-online", ...failure })) ?? [])
    , ...(domiportaQueueStatus?.recentFailures.map((failure) => ({ source: "Domiporta", ...failure })) ?? [])
    , ...(maxonQueueStatus?.recentFailures.map((failure) => ({ source: "Maxon", ...failure })) ?? [])
    , ...(adresowoQueueStatus?.recentFailures.map((failure) => ({ source: "Adresowo", ...failure })) ?? [])
    , ...(morizonQueueStatus?.recentFailures.map((failure) => ({ source: "Morizon", ...failure })) ?? [])
  ];
  const portalQueueRows = [
    { name: "Otodom", status: queueStatus },
    { name: "Gratka", status: gratkaQueueStatus },
    { name: "OLX", status: olxQueueStatus },
    { name: "Nieruchomości-online", status: nieruchomosciOnlineQueueStatus },
    { name: "Domiporta", status: domiportaQueueStatus },
    { name: "Maxon", status: maxonQueueStatus },
    { name: "Adresowo", status: adresowoQueueStatus },
    { name: "Morizon", status: morizonQueueStatus }
  ];
  const nextQueueAttemptAt = getNextQueueAttemptAt(...portalQueueRows.map(({ status }) => status));
  const isQueueBusy = isRunningAll || isRunningGratkaAll || isProcessingAllPortals || combinedQueueCounts.processing > 0;
  const isRetryingAnyQueue = isRetryingFailedQueue || isRetryingFailedGratkaQueue || isRetryingFailedOlxQueue || isRetryingFailedNieruchomosciOnlineQueue || isRetryingFailedDomiportaQueue || isRetryingFailedMaxonQueue || isRetryingFailedAdresowoQueue || isRetryingFailedMorizonQueue;

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <button className="brand-button" type="button" onClick={() => setActiveTab("dashboard")} aria-label="Przejdź do ofert">
          <span className="brand-mark">M</span>
          <span><strong>Mieszkania</strong><small>Wasze centrum decyzji</small></span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Włącz tryb ciemny" : "Włącz tryb jasny"} title={theme === "light" ? "Tryb ciemny" : "Tryb jasny"}>
            {theme === "light" ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
          </button>
          <button className="icon-button" type="button" onClick={() => { setSettingsSaveError(null); setSettingsOpen(true); }} aria-label="Otwórz ustawienia" title="Ustawienia"><Settings2 size={19} aria-hidden="true" /></button>
        </div>
      </header>
      {activeTab === "dashboard" ? <div className="top-dashboard-frame">
      <section className="hero">
        <div>
          <p className="eyebrow">Wasze poszukiwania · {region.name}</p>
          <h1>Nasze oferty mieszkaniowe</h1>
          <p className="lead">
            Oferty z Warszawy, ceny, dojazdy i zapisane oferty w jednym miejscu.
          </p>
        </div>

        <div className="hero-card">
          <span>Najbliższy krok</span>
          <strong>{upcomingViewings.total > 0 ? `${upcomingViewings.total} zaplanowane` : "Przejrzyj nowe oferty"}</strong>
          <p>{listingsTotal || dashboardListings.length} ofert gotowych do porównania.</p>
          <button className="action-button hero-primary-action" onClick={() => setActiveTab("dashboard")}>
            <Search size={16} aria-hidden="true" /> Przeglądaj oferty
          </button>
          <button className="action-button secondary-button hero-settings" onClick={() => setActiveTab("duplicates")}>
            <GitCompareArrows size={16} aria-hidden="true" /> Sprawdź duplikaty
          </button>
        </div>
      </section>

      <div className="hero-stats" aria-label="Snapshot stanu bazy">
        {listingInsights.map((stat) => <div key={stat.label} className="hero-stat" title={stat.description}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.trend ? <small>{stat.trend}</small> : null}
        </div>)}
      </div>

      <section className="panel compact-panel">
        <div className="panel-header">
          <div className="detail-sidebar">
            <p className="eyebrow">Kalendarz</p>
            <h2>Najbliższe wizyty</h2>
          </div>
          <div className="pill">{upcomingViewings.total} zaplanowane</div>
        </div>
        <div className="calendar-grid">
          {upcomingViewings.items.length > 0 ? upcomingViewings.items.map((viewing) => (
            <article key={viewing.id} className="calendar-card" onClick={() => void openListing(viewing.listingId)}>
              <span>{formatViewingDate(viewing.scheduledAt)}</span>
              <strong>{viewing.listingTitle}</strong>
              <p>{viewing.city}{viewing.district ? ` / ${viewing.district}` : ""}</p>
              <p>{viewing.addressText ?? "Brak adresu"}</p>
              {viewing.notes ? <p className="muted">{viewing.notes}</p> : null}
            </article>
          )) : <div className="result-box">Brak zaplanowanych oglądań.</div>}
        </div>
      </section>
      </div> : null}

      <section className="workspace-navigation" aria-label="Widoki aplikacji">
        <div className="tabs-row">
          <button className={tabClass(activeTab === "dashboard")} onClick={() => setActiveTab("dashboard")}><LayoutDashboard size={17} aria-hidden="true" /><span>Oferty</span></button>
          <button className={tabClass(activeTab === "stats")} onClick={() => setActiveTab("stats")}><Columns3 size={17} aria-hidden="true" /><span>Statystyki</span></button>
          <button className={tabClass(activeTab === "compare")} onClick={() => setActiveTab("compare")}><GitCompareArrows size={17} aria-hidden="true" /><span>Porównanie</span></button>
          <button className={tabClass(activeTab === "map")} onClick={() => setActiveTab("map")}><MapIcon size={17} aria-hidden="true" /><span>Mapa</span></button>
          <button className={tabClass(activeTab === "mortgage")} onClick={() => setActiveTab("mortgage")}><Calculator size={17} aria-hidden="true" /><span>Kredyt</span></button>
          <button className={tabClass(activeTab === "duplicates")} onClick={() => setActiveTab("duplicates")}><GitCompareArrows size={17} aria-hidden="true" /><span>Duplikaty</span></button>
          <button className={tabClass(activeTab === "backfill")} onClick={() => setActiveTab("backfill")}><DatabaseZap size={17} aria-hidden="true" /><span>Aktualizacja</span></button>
        </div>
      </section>

      {activeTab === "stats" ? <>
        <StatsControls
          period={marketStatsPeriod}
          draft={marketStatsDraftFilters}
          onPeriodChange={setMarketStatsPeriod}
          onDraftChange={setMarketStatsDraftFilters}
          onApply={() => { setMarketStats(null); setMarketStatsFilters(marketStatsDraftFilters); }}
          onClear={() => {
            const empty: MarketStatsFilters = { minYear: "", minArea: "", maxArea: "", elevator: false, garage: false };
            setMarketStatsDraftFilters(empty);
            setMarketStats(null);
            setMarketStatsFilters(empty);
          }}
        />
        {marketStatsError ? <p className="panel" role="alert">{marketStatsError} <button className="action-button secondary-button" onClick={() => setMarketStatsFilters({ ...marketStatsFilters })}>Spróbuj ponownie</button></p> : null}
        {marketStats && !marketStatsLoading ? <MarketPulse stats={marketStats} /> : null}
        <MarketStatsPanel stats={marketStats} loading={marketStatsLoading} filters={marketStatsFilters} baseline={marketStatsBaseline} onFiltersChange={setMarketStatsFilters} />
      </> : null}
{activeTab === "stats" && statsPriceDelta !== 0 ? <div className="stats-delta-banner">Średnia cena za m² względem zapisanych kryteriów bez dodatkowych filtrów: <strong>{statsPriceDelta > 0 ? "↑" : "↓"} {Math.abs(statsPriceDelta).toLocaleString("pl-PL")} zł/m²</strong></div> : null}
      {activeTab === "stats" && marketStats && marketStatsBaseline && (marketStatsFilters.minYear || marketStatsFilters.minArea || marketStatsFilters.maxArea || marketStatsFilters.elevator || marketStatsFilters.garage) ? <div className="panel stats-filter-diff"><strong>Cena za m² — różnica względem zapisanych kryteriów bez dodatkowych filtrów</strong><span>{Math.round(marketStats.totals.averagePricePerSqm).toLocaleString("pl-PL")} zł/m² ({statsPriceDelta >= 0 ? "+" : "-"}{Math.abs(statsPriceDelta).toLocaleString("pl-PL")} zł/m²)</span></div> : null}
      {activeTab === "compare" ? (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Compare</p>
            <h2>Porównanie ofert 2-5</h2>
          </div>
          <div className="pill">{compareListings.length} wybrane</div>
        </div>
        <CompareBoard listings={compareListings} onOpen={openListing} onRemove={removeFromCompare} />
      </section>
      ) : null}

      {activeTab === "mortgage" ? <MortgageCalculator draft={mortgageDraft} onBackToListing={() => {
        if (!mortgageDraft.listingId) return;
        setActiveTab("dashboard");
        void openListing(mortgageDraft.listingId);
      }} /> : null}

      {activeTab === "duplicates" ? <DuplicateGroupsPanel groups={duplicateGroups} total={duplicateTotal} totalMembers={duplicateTotals.members} totalCopies={duplicateTotals.copies} error={duplicateError} busy={duplicateAction} onReload={() => void loadDuplicateGroups()} onLoadMore={() => void loadDuplicateGroups(duplicateGroups.length + 100)} isLoading={isLoadingDuplicateGroups} onOpen={(id) => void openListing(id)} onUnmerge={(primaryListingId, duplicateListingId) => void unmergeDuplicate(primaryListingId, duplicateListingId)} onConfirm={(primaryListingId) => void confirmDuplicateGroup(primaryListingId)} /> : null}

      {activeTab === "operations" ? (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Operacje</p>
            <h2>Collectory i import RCN</h2>
          </div>
        </div>

        <div className="ops-grid">
          <article className="ops-card">
            <h3>Otodom collect-one</h3>
            <p className="muted">Wklejasz jeden pełny link do konkretnej oferty Otodom. Collector pobiera opis, zdjęcia, adres, cechy i zapisuje snapshot do bazy.</p>
            <form className="ops-form" onSubmit={(event) => { event.preventDefault(); void runCollector(); }}>
              <label className="field-label">
                <span>Link do oferty</span>
                <input className="text-input" value={collectUrl} onChange={(event) => setCollectUrl(event.target.value)} placeholder="https://www.otodom.pl/pl/oferta/..." />
              </label>
              <button className="action-button" type="submit" disabled={isCollecting || !collectUrl.trim()}>
                {isCollecting ? "Pobieranie..." : "Uruchom collector"}
              </button>
            </form>
            {collectError ? <p className="error-text">{collectError}</p> : null}
            {collectResult ? (
              <div className="result-box">
                <strong>{collectResult.parsed.title}</strong>
                <p>{collectResult.parsed.city} / {collectResult.parsed.district ?? "-"} / {collectResult.parsed.neighborhood ?? "-"}</p>
                <p>Zdjecia: {collectResult.parsed.imageCount}</p>
              </div>
            ) : null}
          </article>

          <article className="ops-card">
            <h3>Otodom automat</h3>
            <p className="muted">`Miasto` to slug z wyników Otodom, np. `warszawa`. `Liczba stron` mówi, przez ile stron wyników iść po kolei. `Limit` mówi, ile ofert maksymalnie faktycznie zaciągnąć z wykrytych linków.</p>
            <form className="ops-form" onSubmit={(event) => { event.preventDefault(); void runBulkCollector(); }}>
              <label className="field-label">
                <span>Miasto</span>
                <input className="text-input" value={bulkCity} onChange={(event) => setBulkCity(event.target.value)} placeholder="warszawa" />
              </label>
              <label className="field-label">
                <span>Start od strony</span>
                <input className="text-input" value={bulkStartPage} onChange={(event) => setBulkStartPage(event.target.value)} placeholder="np. 1" />
              </label>
              <label className="field-label">
                <span>Liczba stron w batchu</span>
                <input className="text-input" value={bulkPages} onChange={(event) => setBulkPages(event.target.value)} placeholder="np. 3" />
              </label>
              <label className="field-label">
                <span>Limit ofert do pobrania</span>
                <input className="text-input" value={bulkLimit} onChange={(event) => setBulkLimit(event.target.value)} placeholder="np. 12" />
              </label>
              <button className="action-button" type="submit" disabled={isBulkCollecting}>
                {isBulkCollecting ? "Zaciaganie..." : "Lec po ogloszeniach"}
              </button>
            </form>
            {bulkError ? <p className="error-text">{bulkError}</p> : null}
            {bulkResult ? (
              <div className="result-box">
                <p>Start od strony: {bulkResult.startPage}</p>
                <p>Przeskanowane strony: {bulkResult.pagesScanned}</p>
                <p>Wykryte URL-e: {bulkResult.discovered}</p>
                <p>Limit pobrania: {bulkResult.limitApplied}</p>
                <p>Przetworzone wpisy: {bulkResult.collected}</p>
                <p>Nowe: {bulkResult.created} / Zaktualizowane: {bulkResult.updated} / Bez zmian: {bulkResult.unchanged} / Błędy: {bulkResult.failed}</p>
              </div>
            ) : null}
          </article>

          <article className="ops-card">
            <h3>RCN import</h3>
            <p className="muted">To jest nadal warstwa robocza. Import próbuje pobrać publiczne dane WFS dla Warszawy i okolic. Jeśli źródło powiatu nic nie zwraca, zobaczysz mało albo zero rekordów.</p>
            <button className="action-button" onClick={() => void runRcnImport()} disabled={isImportingRcn}>
              {isImportingRcn ? "Import..." : "Uruchom import RCN"}
            </button>
            {rcnError ? <p className="error-text">{rcnError}</p> : null}
            {rcnResult ? <div className="result-box"><strong>Transakcje: {rcnResult.importedTransactions}</strong></div> : null}
          </article>
        </div>
      </section>
      ) : null}

      {activeTab === "backfill" ? (
      <section className="sync-center">
        <div className="panel sync-hero">
          <div>
            <p className="eyebrow">Aktualizacja bazy</p>
            <h2>Pobierz najnowsze oferty</h2>
            <p className="muted">Najpierw sprawdź portale, a potem pobierz przygotowane oferty. Resztą zajmie się aplikacja.</p>
          </div>
          <div className="sync-hero-actions">
            <div className={isQueueBusy ? "sync-state is-running" : combinedQueueCounts.failed > 0 ? "sync-state has-errors" : "sync-state"}>
              {isQueueBusy ? <LoaderCircle size={18} className="icon-spin" aria-hidden="true" /> : <DatabaseZap size={18} aria-hidden="true" />}
              <span>{queueStatusError ? "Status części portali niedostępny" : !queueStatusCheckedAt ? "Odczytuję kolejki…" : isQueueBusy
                ? "Aktualizacja trwa"
                : staleListingRefresh?.automationPaused
                  ? "Automat jest wstrzymany"
                : combinedQueueCounts.readyPending > 0
                  ? `${combinedQueueCounts.readyPending} ofert gotowych do pobrania`
                : combinedQueueCounts.delayedPending > 0
                    ? `${combinedQueueCounts.delayedPending} ofert chwilowo wstrzymanych`
                    : combinedQueueCounts.failed > 0
                      ? `${combinedQueueCounts.failed} ofert wymaga uwagi`
                    : "Baza jest gotowa"}</span>
            </div>
            <button className="action-button secondary-button sync-refresh-button" type="button" onClick={() => void Promise.all([refreshQueueStatus("manual"), refreshStaleListingStatus()])} disabled={isRefreshingQueueStatus}><RefreshCw size={16} className={isRefreshingQueueStatus ? "icon-spin" : ""} aria-hidden="true" /> {isRefreshingQueueStatus ? "Odświeżam…" : "Odśwież"}</button>
          </div>
        </div>

        <div className="sync-connection" role="status">{queueStatusError ?? (queueStatusCheckedAt ? `Status portali odczytany: ${queueStatusCheckedAt.toLocaleTimeString("pl-PL")}` : "Odczytuję status portali…")}</div>
        <section className="panel stale-refresh-summary" aria-label="Automatyczne odświeżanie ofert po 24 godzinach">
          <div className="stale-refresh-heading">
            <span className={staleListingRefresh?.running ? "stale-refresh-icon is-running" : "stale-refresh-icon"}>
              <RefreshCw size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>Automatyczne odświeżanie co 24 godziny</strong>
              <small>
                {staleListingRefresh?.running
                  ? "Trwa sprawdzanie starszych ofert"
                  : staleListingRefresh?.automationPaused
                    ? "Automat jest zatrzymany. Wznowisz go przyciskiem pobierania."
                  : (staleListingRefresh?.due ?? 0) > 0
                    ? `${staleListingRefresh?.due} ${staleListingRefresh?.due === 1 ? "oferta czeka" : "ofert czeka"} na automatyczne sprawdzenie`
                  : staleListingRefresh?.nextDueAt
                    ? `Najbliższe oferty wrócą do sprawdzenia ${formatStaleRefreshTime(staleListingRefresh.nextDueAt)}`
                    : "Oferty wracają do sprawdzenia 24 godziny po ostatnim udanym pobraniu"}
              </small>
            </div>
          </div>
          <div className="stale-refresh-metrics">
            <div><strong>{staleListingRefresh?.due ?? 0}</strong><span>wymaga sprawdzenia teraz</span></div>
            <div><strong>{staleListingRefresh?.refreshedLast24Hours?.toLocaleString("pl-PL") ?? "—"}</strong><span>sprawdzonych w ostatnich 24 h</span></div>
            <div><strong>{staleListingRefresh?.lastCheckedAt ? formatStaleRefreshTime(staleListingRefresh.lastCheckedAt, true) : "—"}</strong><span>ostatnia udana aktualizacja</span></div>
          </div>
        </section>

        <div className="sync-flow">
          <article className="panel sync-step">
            <span className="step-number">1</span>
            <div className="sync-step-copy"><h3>Sprawdź portale</h3><p>Wyszukaj nowe ogłoszenia i zmiany w istniejących ofertach.</p></div>
            <div className="sync-step-body">
              <div className="sync-step-fields">
                <label className="field-label"><span>Miasto</span><input className="text-input" value={discoverAllCity} onChange={(event) => setDiscoverAllCity(event.target.value)} placeholder="warszawa" /></label>
                <label className="field-label"><span>Ile stron na portal</span><input className="text-input" inputMode="numeric" value={discoverAllMaxPages} onChange={(event) => setDiscoverAllMaxPages(event.target.value.replace(/\D/g, ""))} placeholder="50" /><small className="field-hint">Zwykle wystarczy 20–50 stron.</small></label>
              </div>
            </div>
            <div className="sync-step-footer">
              <button className="action-button sync-main-button" type="button" onClick={() => void runDiscoverAllPortals()} disabled={isDiscoveringAllPortals}>
                {isDiscoveringAllPortals ? <LoaderCircle size={17} className="icon-spin" aria-hidden="true" /> : <Search size={17} aria-hidden="true" />} {isDiscoveringAllPortals ? "Sprawdzam 8 portali…" : "Sprawdź wszystkie portale"}
              </button>
            </div>
          </article>

          <div className="sync-connector" aria-hidden="true"><span /></div>

          <article className="panel sync-step">
            <span className="step-number">2</span>
            <div className="sync-step-copy"><h3>Pobierz szczegóły</h3><p>Portale są pobierane równolegle, a w każdym z nich oferta po ofercie w kontrolowanej liczbie zadań.</p></div>
            <div className="sync-step-body">
              <div className="sync-metrics" aria-label="Stan kolejki">
                <div><strong>{combinedQueueCounts.pendingNew}</strong><span>nowych</span></div>
                <div><strong>{combinedQueueCounts.pendingPriceUpdates}</strong><span>do odświeżenia</span></div>
                <div className={combinedQueueCounts.failed > 0 ? "metric-alert" : ""}><strong>{combinedQueueCounts.failed}</strong><span>błędów</span></div>
              </div>
              {combinedQueueCounts.delayedPending > 0 ? (
                <small className="sync-delay-note">
                  {combinedQueueCounts.readyPending > 0
                    ? `${combinedQueueCounts.readyPending} można pobrać teraz, a ${combinedQueueCounts.delayedPending} portal chwilowo wstrzymał.`
                    : `${combinedQueueCounts.delayedPending} ofert portal chwilowo wstrzymał${nextQueueAttemptAt ? `; automatyczne wznowienie ${formatQueueAttemptTime(nextQueueAttemptAt)}` : ""}.`}
                </small>
              ) : null}
              <label className="field-label sync-queue-limit"><span>Maksymalnie ofert na portal w tej partii</span><input className="text-input" inputMode="numeric" value={queueLimit} onChange={(event) => setQueueLimit(event.target.value.replace(/\D/g, ""))} placeholder="200" /></label>
              <small className="sync-recovery-note">Nieruchomości-online respektuje ten limit (do 500). Żądania startują co 5 sekund, więc 200 ofert wymaga co najmniej ok. 17 minut. Odpowiedzi przetwarzamy równolegle; czasowa blokada portalu odkłada zadania na później.</small>
              <small className="sync-recovery-note">Status odświeża się automatycznie także po zatrzymaniu automatu. Dłuższe pobranie nie oznacza błędu — rozpoczęte zadania mogą się jeszcze kończyć.</small>
            </div>
            <div className="sync-process-actions sync-step-footer">
              <button className="action-button sync-main-button" type="button" onClick={() => void runProcessAllPortals()} disabled={isTogglingListingAutomation || isProcessingAllPortals || (!staleListingRefresh?.automationPaused && (isQueueBusy || combinedQueueCounts.readyPending === 0))}>
                <DatabaseZap size={17} aria-hidden="true" className={isProcessingAllPortals ? "icon-spin" : ""} /> {isProcessingAllPortals
                  ? "Pobieram oferty…"
                  : staleListingRefresh?.automationPaused
                    ? "Wznów automat i pobierz oferty"
                    : "Pobierz przygotowane oferty"}
              </button>
              {!staleListingRefresh?.automationPaused ? <button className="action-button danger-button" type="button" onClick={() => void stopListingAutomation()} disabled={isTogglingListingAutomation}><X size={16} aria-hidden="true" /> {isTogglingListingAutomation ? "Zatrzymuję…" : "Zatrzymaj automat"}</button> : null}
            </div>
          </article>
        </div>

        {queueNotice && !queueError ? (
          <section className={`sync-notice-banner is-${queueNotice.tone}`} role="status" aria-live="polite">
            {queueNotice.tone === "success" ? <ClipboardCheck size={21} aria-hidden="true" /> : <LoaderCircle size={21} className={isProcessingAllPortals ? "icon-spin" : ""} aria-hidden="true" />}
            <p>{queueNotice.message}</p>
          </section>
        ) : null}

        {queueError ? (
          <section className="sync-error-banner" role="alert" aria-live="assertive">
            <CircleAlert size={22} aria-hidden="true" />
            <div><strong>Aktualizacja nie zakończyła się poprawnie</strong><p>{queueError}</p></div>
            <div className="sync-error-actions">
              <button className="action-button danger-button" type="button" onClick={() => void (queueErrorAction === "discover" ? runDiscoverAllPortals() : runProcessAllPortals())} disabled={isDiscoveringAllPortals || isProcessingAllPortals}>
                <RotateCcw size={16} aria-hidden="true" /> Spróbuj ponownie
              </button>
              <button className="action-button secondary-button" type="button" onClick={() => void refreshQueueStatus("manual")} disabled={isRefreshingQueueStatus}>
                <RefreshCw size={16} className={isRefreshingQueueStatus ? "icon-spin" : ""} aria-hidden="true" /> Odśwież status
              </button>
            </div>
          </section>
        ) : null}

        <details className="panel sync-details">
          <summary><span><Columns3 size={18} aria-hidden="true" /> Szczegóły kolejki</span><small>Status poszczególnych portali i narzędzia naprawcze</small></summary>
          <div className="portal-status-table" role="table" aria-label="Status pobierania z portali">
            <div className="portal-status-row portal-status-head" role="row"><span>Portal</span><span>Nowe</span><span>Odświeżenie</span><span>W toku</span><span>Błędy</span></div>
            {portalQueueRows.map(({ name, status }) => <div className="portal-status-row" role="row" key={name}><strong>{name}</strong><span>{status?.pendingNew ?? 0}</span><span title={status?.nextAttemptAt ? `Najbliższa próba: ${formatQueueAttemptTime(status.nextAttemptAt)}` : undefined}>{status?.pendingPriceUpdates ?? 0}{(status?.delayedPending ?? 0) > 0 ? ` (${status?.delayedPending} wstrz.)` : ""}</span><span>{status?.counts.processing ?? "—"}</span><span className={(status?.counts.failed ?? 0) > 0 ? "status-error" : ""}>{status?.counts.failed ?? "—"}</span></div>)}
          </div>
          <div className="sync-recent-failures">
            {portalQueueRows.filter(({ status }) => status?.recentFailures.length).map(({ name, status }) => <details key={name}>
              <summary>{name} · ostatnie błędy ({status!.recentFailures.length})</summary>
              {status!.recentFailures.map((failure) => <article key={failure.external_id}><a href={failure.canonical_url} target="_blank" rel="noreferrer">{failure.external_id} ↗</a><p>{failure.last_error?.includes("MISSING_PRICE") ? "Portal nie zwrócił odczytywalnej ceny. Poprzednia cena oferty pozostaje w bazie." : failure.last_error?.includes("429") ? "Portal ogranicza częstotliwość pobierania." : failure.last_error?.includes("403") ? "Portal odmówił dostępu do ogłoszenia." : failure.last_error ?? "Brak szczegółów błędu."}</p><details><summary>Szczegóły techniczne</summary><code>{failure.last_error}</code></details></article>)}
            </details>)}
          </div>
          <div className="sync-detail-actions">
            <button className="action-button secondary-button" type="button" onClick={() => void refreshQueueStatus("manual")} disabled={isRefreshingQueueStatus}><RefreshCw size={16} className={isRefreshingQueueStatus ? "icon-spin" : ""} aria-hidden="true" /> Odśwież status</button>
            {combinedQueueCounts.failed > 0 ? <button className="action-button secondary-button" type="button" onClick={() => void retryAllFailedQueues()} disabled={isRetryingAnyQueue}><RotateCcw size={16} className={isRetryingAnyQueue ? "icon-spin" : ""} aria-hidden="true" /> Ponów błędy</button> : null}
            {combinedQueueCounts.processing > 0 && !isProcessingAllPortals ? <button className="action-button secondary-button" type="button" onClick={() => void resetAllProcessingQueues()} disabled={isResettingProcessingQueue}><RotateCcw size={16} className={isResettingProcessingQueue ? "icon-spin" : ""} aria-hidden="true" /> Odblokuj zatrzymane ({combinedQueueCounts.processing})</button> : null}
          </div>
        </details>

        <section className="panel data-tools">
          <div className="data-tools-heading"><div><p className="eyebrow">Dane pomocnicze</p><h2>Warszawa i porządek w bazie</h2></div><p className="muted">Rzadziej używane operacje zebrane w jednym miejscu.</p></div>
          <div className="data-tool-grid">
            <article><DatabaseZap size={20} aria-hidden="true" /><div><h3>Ceny transakcyjne RCN</h3><p>Aktualizuje rzeczywiste ceny sprzedaży mieszkań.</p></div><button className="action-button secondary-button" type="button" onClick={() => void runRcnImport()} disabled={isImportingRcn}>{isImportingRcn ? "Importuję…" : "Aktualizuj RCN"}</button>{rcnResult ? <small>{rcnResult.importedTransactions ?? 0} nowych transakcji</small> : null}</article>
            <article><MapPin size={20} aria-hidden="true" /><div><h3>Ulice ofert</h3><p>Dopasowuje nowe oferty do zapisanej bazy ulic Warszawy.</p></div><div className="tool-actions"><button className="action-button secondary-button" type="button" onClick={() => void enrichListingsFromStreets()} disabled={isEnrichingListingsFromStreets}>{isEnrichingListingsFromStreets ? "Dopasowuję…" : "Dopasuj ulice ofert"}</button></div>{streetEnrichmentResult ? <small>{streetEnrichmentResult.matched} dopasowanych ofert</small> : null}</article>
            <article><GitCompareArrows size={20} aria-hidden="true" /><div><h3>Połącz duplikaty</h3><p>Szybko grupuje te same oferty z różnych portali.</p></div><button className="action-button secondary-button" type="button" onClick={() => void runDuplicateAutoMerge()} disabled={isRunningDuplicateAutoMerge}>{isRunningDuplicateAutoMerge ? "Porównuję…" : "Znajdź i połącz"}</button>{duplicateAutoMergeResult ? <small>{duplicateAutoMergeResult.merged} połączonych z {duplicateAutoMergeResult.checked} sprawdzonych</small> : null}</article>
            <article><RotateCcw size={20} aria-hidden="true" /><div><h3>Sprawdź ponownie dodane oferty</h3><p>Łączy aktywne ogłoszenia z ich wcześniejszą, archiwalną wersją i porównuje ceny.</p></div><button className="action-button secondary-button" type="button" onClick={() => void runRelistingScan()} disabled={isScanningRelistedListings}>{isScanningRelistedListings ? "Sprawdzam…" : "Sprawdź ponownie dodane"}</button>{relistingScanResult ? <small>{relistingScanResult.matched} znalezionych relistingów</small> : null}</article>
          </div>
          {relistingScanResult ? (
            <section className="relisting-results" aria-live="polite">
              <div className="relisting-results-heading">
                <div><h3>Ponownie dodane oferty</h3><p className="muted">Sprawdzono {relistingScanResult.checkedActive} aktywnych i {relistingScanResult.checkedArchived} archiwalnych ofert.</p></div>
                <span>{relistingScanResult.matched} dopasowań</span>
              </div>
              {relistingScanResult.items.length > 0 ? (
                <div className="relisting-result-grid">
                  {relistingScanResult.items.map((match) => {
                    const difference = match.priceDifferenceAmount;
                    const differenceClass = difference === undefined || difference === 0 ? "is-neutral" : difference < 0 ? "is-lower" : "is-higher";
                    return (
                      <article className="relisting-result-card" key={`${match.previous.id}:${match.current.id}`}>
                        <div className="relisting-offer-row is-archived"><span>Archiwalna · {match.previous.sourceLabel}</span><button className="text-link-button" type="button" onClick={() => void openListing(match.previous.id)}>{match.previous.title}</button><strong>{formatOptionalPln(match.previous.priceAmount)}</strong></div>
                        <div className="relisting-arrow" aria-hidden="true">→</div>
                        <div className="relisting-offer-row is-current"><span>Aktualna · {match.current.sourceLabel}</span><button className="text-link-button" type="button" onClick={() => void openListing(match.current.id)}>{match.current.title}</button><strong>{formatOptionalPln(match.current.priceAmount)}</strong></div>
                        <div className={`relisting-price-difference ${differenceClass}`}><span>Różnica ceny</span><strong>{difference === undefined ? "brak danych" : `${difference > 0 ? "+" : ""}${formatPln(difference)}`}</strong>{match.priceDifferencePercent !== undefined ? <small>{match.priceDifferencePercent > 0 ? "+" : ""}{match.priceDifferencePercent.toFixed(1)}%</small> : null}</div>
                        <small className="relisting-reasons">Pewność {match.confidenceScore}% · {match.reasons.join(", ")}</small>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="muted relisting-empty">Nie znaleziono aktywnych ofert, które pojawiły się ponownie po archiwizacji.</p>}
            </section>
          ) : null}
          {rcnError || duplicateAutoMergeError || relistingScanError || queueError ? <p className="error-text">{rcnError || duplicateAutoMergeError || relistingScanError || queueError}</p> : null}
        </section>
      </section>
      ) : null}

      {activeTab === ("legacy-backfill" as AppTab) ? (
      <section className="panel backfill-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pobieranie ofert</p>
            <h2>Aktualizacja ofert — krok po kroku</h2>
          </div>
          <div className="pill">{combinedQueueCounts.pending} pending łącznie</div>
        </div>

        <div className="ops-grid">
          <article className="ops-card">
            <h3 className="ops-card-title"><Search size={18} aria-hidden="true" /> 1. Znajdź nowe oferty</h3>
            <p className="muted">Najpierw wyszukaj oferty we wszystkich portalach. Nie zapisuje to jeszcze szczegółów — tylko przygotowuje je do pobrania w następnym kroku.</p>
            <div className="ops-form">
              <label className="field-label">
                <span>Miasto</span>
                <input className="text-input" value={discoverAllCity} onChange={(event) => setDiscoverAllCity(event.target.value)} placeholder="warszawa" />
              </label>
              <label className="field-label">
                <span>Zakres wyszukiwania (strony)</span>
                <input className="text-input" value={discoverAllMaxPages} onChange={(event) => setDiscoverAllMaxPages(event.target.value)} placeholder="700" />
              </label>
              <label className="field-label">
                <span>Strony pobierane naraz</span>
                <input className="text-input" value={discoverAllBatchPages} onChange={(event) => setDiscoverAllBatchPages(event.target.value)} placeholder="5" />
              </label>
            </div>
            <div className="panel-inline-actions">
              <button className="action-button" type="button" onClick={() => void runDiscoverAllPortals()} disabled={isDiscoveringAllPortals}>
                <DatabaseZap size={16} aria-hidden="true" className={isDiscoveringAllPortals ? "icon-spin" : ""} /> {isDiscoveringAllPortals ? "Szukam ofert..." : "Znajdź oferty we wszystkich portalach"}
              </button>
              <button className="action-button secondary-button" type="button" onClick={() => void refreshQueueStatus("manual")} disabled={isRefreshingQueueStatus}>
                <RefreshCw size={16} aria-hidden="true" className={isRefreshingQueueStatus ? "icon-spin" : ""} /> {isRefreshingQueueStatus ? "Odświeżanie..." : "Odśwież statusy"}
              </button>
            </div>
            <div className="result-box result-box-tight">
              <p>Otodom: {discoverAllResult?.discovered ?? 0} wykrytych / {discoverAllResult?.queued ?? 0} dodanych</p>
              {staleListingRefresh ? <p>Aktualizacja cen: <strong>{staleListingRefresh.due}</strong> ofert {staleListingRefresh.running ? "jest dodawanych do kolejki" : "czeka w kolejce"} po 24 h od ostatniego pobrania.</p> : null}
              <p>Gratka: {gratkaDiscoverAllResult?.discovered ?? 0} wykrytych / {gratkaDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>OLX: {olxDiscoverAllResult?.discovered ?? 0} wykrytych / {olxDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>Nieruchomosci-online: {nieruchomosciOnlineDiscoverAllResult?.discovered ?? 0} wykrytych / {nieruchomosciOnlineDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>Domiporta: {domiportaDiscoverAllResult?.discovered ?? 0} wykrytych / {domiportaDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>Maxon: {maxonDiscoverAllResult?.discovered ?? 0} wykrytych / {maxonDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>Adresowo: {adresowoDiscoverAllResult?.discovered ?? 0} wykrytych / {adresowoDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>Morizon: {morizonDiscoverAllResult?.discovered ?? 0} wykrytych / {morizonDiscoverAllResult?.queued ?? 0} dodanych</p>
              <p>Łącznie w tym starcie: {(discoverAllResult?.queued ?? 0) + (gratkaDiscoverAllResult?.queued ?? 0) + (olxDiscoverAllResult?.queued ?? 0) + (nieruchomosciOnlineDiscoverAllResult?.queued ?? 0) + (domiportaDiscoverAllResult?.queued ?? 0) + (maxonDiscoverAllResult?.queued ?? 0) + (adresowoDiscoverAllResult?.queued ?? 0) + (morizonDiscoverAllResult?.queued ?? 0)}</p>
            </div>
          </article>

          <article className="ops-card">
            <h3 className="ops-card-title"><Columns3 size={18} aria-hidden="true" /> Co czeka na pobranie?</h3>
            <p className="muted">„Nowe oferty” to pozycje, których jeszcze nie ma w bazie. Po kliknięciu kroku 2 są pobierane przed aktualizacjami cen.</p>
            <div className="queue-columns">
              <div className="result-box result-box-tight queue-status-card">
                <strong>Otodom</strong>
                <p>Nowe oferty: {queueStatus?.pendingNew ?? 0}</p>
                <p>Aktualizacja ceny: {queueStatus?.pendingPriceUpdates ?? 0}</p>
                <p>W toku: {queueStatus?.counts.processing ?? 0}</p>
                <p>Pobrane: {queueStatus?.counts.completed ?? 0}</p>
                <p>Błędy: {queueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>Gratka</strong>
                <p>Nowe oferty: {gratkaQueueStatus?.pendingNew ?? 0}</p>
                <p>Aktualizacja ceny: {gratkaQueueStatus?.pendingPriceUpdates ?? 0}</p>
                <p>W toku: {gratkaQueueStatus?.counts.processing ?? 0}</p>
                <p>Pobrane: {gratkaQueueStatus?.counts.completed ?? 0}</p>
                <p>Błędy: {gratkaQueueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>OLX</strong>
                <p>Nowe oferty: {olxQueueStatus?.pendingNew ?? 0}</p>
                <p>Aktualizacja ceny: {olxQueueStatus?.pendingPriceUpdates ?? 0}</p>
                <p>W toku: {olxQueueStatus?.counts.processing ?? 0}</p>
                <p>Pobrane: {olxQueueStatus?.counts.completed ?? 0}</p>
                <p>Błędy: {olxQueueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>Nieruchomosci-online</strong>
                <p>Nowe oferty: {nieruchomosciOnlineQueueStatus?.pendingNew ?? 0}</p>
                <p>Aktualizacja ceny: {nieruchomosciOnlineQueueStatus?.pendingPriceUpdates ?? 0}</p>
                <p>W toku: {nieruchomosciOnlineQueueStatus?.counts.processing ?? 0}</p>
                <p>Pobrane: {nieruchomosciOnlineQueueStatus?.counts.completed ?? 0}</p>
                <p>Błędy: {nieruchomosciOnlineQueueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>Domiporta</strong>
                <p>Nowe oferty: {domiportaQueueStatus?.pendingNew ?? 0}</p><p>Aktualizacja ceny: {domiportaQueueStatus?.pendingPriceUpdates ?? 0}</p><p>W toku: {domiportaQueueStatus?.counts.processing ?? 0}</p><p>Pobrane: {domiportaQueueStatus?.counts.completed ?? 0}</p><p>Błędy: {domiportaQueueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>Adresowo</strong>
                <p>Nowe oferty: {adresowoQueueStatus?.pendingNew ?? 0}</p>
                <p>Aktualizacja ceny: {adresowoQueueStatus?.pendingPriceUpdates ?? 0}</p>
                <p>W toku: {adresowoQueueStatus?.counts.processing ?? 0}</p>
                <p>Pobrane: {adresowoQueueStatus?.counts.completed ?? 0}</p>
                <p>Błędy: {adresowoQueueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>Maxon</strong>
                <p>Nowe oferty: {maxonQueueStatus?.pendingNew ?? 0}</p><p>Aktualizacja ceny: {maxonQueueStatus?.pendingPriceUpdates ?? 0}</p><p>W toku: {maxonQueueStatus?.counts.processing ?? 0}</p><p>Pobrane: {maxonQueueStatus?.counts.completed ?? 0}</p><p>Błędy: {maxonQueueStatus?.counts.failed ?? 0}</p>
              </div>
              <div className="result-box result-box-tight queue-status-card">
                <strong>Morizon</strong>
                <p>Nowe oferty: {morizonQueueStatus?.pendingNew ?? 0}</p>
                <p>Aktualizacja ceny: {morizonQueueStatus?.pendingPriceUpdates ?? 0}</p>
                <p>W toku: {morizonQueueStatus?.counts.processing ?? 0}</p>
                <p>Pobrane: {morizonQueueStatus?.counts.completed ?? 0}</p>
                <p>Błędy: {morizonQueueStatus?.counts.failed ?? 0}</p>
              </div>
            </div>
            <div className="result-box result-box-tight queue-status-card queue-status-total">
              <strong>Łącznie</strong>
              <p>Nowe oferty: {combinedQueueCounts.pendingNew}</p>
              <p>Aktualizacja ceny: {combinedQueueCounts.pendingPriceUpdates}</p>
              <p>W toku: {combinedQueueCounts.processing}</p>
              <p>Pobrane: {combinedQueueCounts.completed}</p>
              <p>Błędy: {combinedQueueCounts.failed}</p>
            </div>
            {queueError ? <p className="error-text">{queueError}</p> : null}
          </article>
        </div>

        <div className="ops-grid">
          <article className="ops-card">
            <h3 className="ops-card-title"><Play size={18} aria-hidden="true" /> 2. Pobierz szczegóły ofert</h3>
            <p className="muted">Pobierze opis, cenę i zdjęcia dla ofert znalezionych w kroku 1. Możesz zostawić domyślne ustawienia.</p>
            <ul className="result-list compact-list">
              <li><strong>Limit</strong>: maksymalna liczba ofert z każdego portalu.</li>
              <li><strong>Równoległość</strong>: techniczne ustawienie szybkości; najlepiej zostawić domyślne.</li>
            </ul>
            <form className="ops-form" onSubmit={(event) => { event.preventDefault(); void runProcessAllPortals(); }}>
              <label className="field-label">
                <span>Limit</span>
                <input className="text-input" value={queueLimit} onChange={(event) => setQueueLimit(event.target.value)} placeholder="200" />
              </label>
              <label className="field-label">
                <span>Równoległość</span>
                <input className="text-input" value={queueConcurrency} onChange={(event) => setQueueConcurrency(event.target.value)} placeholder="8" />
              </label>
              <button className="action-button" type="submit" disabled={isProcessingAllPortals}>
                <Play size={16} aria-hidden="true" className={isProcessingAllPortals ? "icon-spin" : ""} /> {isProcessingAllPortals ? "Pobieranie szczegółów..." : "Pobierz znalezione oferty"}
              </button>
              <button className="action-button secondary-button" type="button" onClick={() => { void retryAllFailedQueues(); }} disabled={isRetryingFailedQueue || isRetryingFailedGratkaQueue || isRetryingFailedOlxQueue || isRetryingFailedNieruchomosciOnlineQueue || isRetryingFailedDomiportaQueue || isRetryingFailedMaxonQueue}>
                <RotateCcw size={16} aria-hidden="true" className={isRetryingFailedQueue || isRetryingFailedGratkaQueue || isRetryingFailedOlxQueue || isRetryingFailedNieruchomosciOnlineQueue || isRetryingFailedDomiportaQueue || isRetryingFailedMaxonQueue ? "icon-spin" : ""} /> {isRetryingFailedQueue || isRetryingFailedGratkaQueue || isRetryingFailedOlxQueue || isRetryingFailedNieruchomosciOnlineQueue || isRetryingFailedDomiportaQueue || isRetryingFailedMaxonQueue ? "Cofam błędy..." : "Ponów błędy"}
              </button>
              <button
                className="action-button secondary-button"
                type="button"
                onClick={() => { void resetAllProcessingQueues(); }}
                disabled={isResettingProcessingQueue || isResettingProcessingGratkaQueue || isResettingProcessingOlxQueue}
              >
                <RotateCcw size={16} aria-hidden="true" className={isResettingProcessingQueue || isResettingProcessingGratkaQueue || isResettingProcessingOlxQueue ? "icon-spin" : ""} /> {isResettingProcessingQueue || isResettingProcessingGratkaQueue || isResettingProcessingOlxQueue ? "Resetuję kolejki..." : "Zresetuj przetwarzanie"}
              </button>
            </form>
            {queueError ? <p className="error-text">{queueError}</p> : null}
          </article>

          <article className="ops-card">
            <h3 className="ops-card-title"><DatabaseZap size={18} aria-hidden="true" /> Import RCN · Warszawa</h3>
            <p className="muted">Pobiera publiczne transakcje lokali z WFS GUGiK dla m.st. Warszawy. Import omija garaże i rekordy poza zakresem porównywalnych mieszkań.</p>
            <button className="action-button" type="button" onClick={() => void runRcnImport()} disabled={isImportingRcn}>
              <DatabaseZap size={16} aria-hidden="true" className={isImportingRcn ? "icon-spin" : ""} /> {isImportingRcn ? "Pobieram dane RCN..." : "Uruchom import RCN"}
            </button>
            {rcnError ? <p className="error-text">RCN: {rcnError}</p> : null}
            {rcnResult ? (
              <div className="result-box result-box-tight">
                <p><strong>Nowe transakcje: {rcnResult.importedTransactions ?? 0}</strong></p>
                {rcnResult.powiats.map((powiat) => (
                  <p key={powiat.key}><strong>{powiat.label}:</strong> {powiat.status}{typeof powiat.importedCount === "number" ? ` · ${powiat.importedCount} nowych` : ""}{powiat.error ? ` · ${powiat.error}` : ""}</p>
                ))}
              </div>
            ) : <p className="muted">Wywołanie: POST /api/collectors/rcn/import</p>}
          </article>

          <article className="ops-card">
            <h3 className="ops-card-title"><MapPin size={18} aria-hidden="true" /> Ulice Warszawy (OSM)</h3>
            <p className="muted">Jednorazowo zapisuje lokalny katalog ulic i ich geometrię. Kolejne oferty z nazwą ulicy będą lokalizowane z tej bazy.</p>
            <button className="action-button" type="button" onClick={() => void importWarsawStreets()} disabled={isImportingWarsawStreets}>
              <MapPin size={16} aria-hidden="true" className={isImportingWarsawStreets ? "icon-spin" : ""} /> {isImportingWarsawStreets ? "Importuję ulice..." : "Importuj ulice Warszawy"}
            </button>
            <button className="action-button secondary-button" type="button" onClick={() => void enrichListingsFromStreets()} disabled={isEnrichingListingsFromStreets}>
              <RefreshCw size={16} aria-hidden="true" className={isEnrichingListingsFromStreets ? "icon-spin" : ""} /> {isEnrichingListingsFromStreets ? "Uzupełniam oferty..." : "Uzupełnij istniejące oferty"}
            </button>
            {warsawStreetImportResult ? <div className="result-box result-box-tight"><p>Zaimportowano: {warsawStreetImportResult.imported} ulic.</p></div> : null}
            {streetEnrichmentResult ? <div className="result-box result-box-tight"><p>Dopasowano ulicę: {streetEnrichmentResult.matched} / {streetEnrichmentResult.scanned} ofert.</p><p>Uzupełniono współrzędne: {streetEnrichmentResult.coordinatesFilled}; zastąpiono rozbieżne: {streetEnrichmentResult.coordinatesOverridden}.</p></div> : null}
          </article>

          <article className="ops-card">
            <h3 className="ops-card-title"><ImageDown size={18} aria-hidden="true" /> 3. Napraw brakujące zdjęcia (tylko gdy trzeba)</h3>
            <p className="muted">To naprawia przypadek, gdy oferta juz jest w bazie, ale zdjecia nie zostaly pobrane albo pliki zniknely z cache.</p>
            <form className="ops-form" onSubmit={(event) => { event.preventDefault(); void runMediaBackfill(); }}>
              <label className="field-label">
                <span>Limit assetow</span>
                <input className="text-input" value={mediaBackfillLimit} onChange={(event) => setMediaBackfillLimit(event.target.value)} placeholder="150" />
              </label>
              <button className="action-button" type="submit" disabled={isBackfillingMedia}>
                <ImageDown size={16} aria-hidden="true" className={isBackfillingMedia ? "icon-spin" : ""} /> {isBackfillingMedia ? "Dociaganie..." : "Dociagnij brakujace zdjecia"}
              </button>
            </form>
            {mediaBackfillError ? <p className="error-text">{mediaBackfillError}</p> : null}
            {mediaBackfillResult ? (
              <div className="result-box">
                <p>Requested: {mediaBackfillResult.requested}</p>
                <p>Downloaded: {mediaBackfillResult.downloaded}</p>
                <p>Skipped: {mediaBackfillResult.skipped}</p>
                <p>Błędy: {mediaBackfillResult.failed}</p>
              </div>
            ) : null}
          </article>

          <article className="ops-card">
            <h3 className="ops-card-title"><GitCompareArrows size={18} aria-hidden="true" /> Automatyczne łączenie duplikatów</h3>
            <p className="muted">Nowe oferty są łączone automatycznie, gdy pierwsze 30 słów opisu jest identyczne. Ten przycisk sprawdza tę regułę także dla ofert pobranych wcześniej.</p>
            <button className="action-button" type="button" onClick={() => void runDuplicateAutoMerge()} disabled={isRunningDuplicateAutoMerge}>
              <GitCompareArrows size={16} aria-hidden="true" className={isRunningDuplicateAutoMerge ? "icon-spin" : ""} /> {isRunningDuplicateAutoMerge ? "Sprawdzanie duplikatów..." : "Sprawdź duplikaty w pobranych ofertach"}
            </button>
            {duplicateAutoMergeError ? <p className="error-text">{duplicateAutoMergeError}</p> : null}
            {duplicateAutoMergeResult ? <div className="result-box result-box-tight"><p>Sprawdzone: {duplicateAutoMergeResult.checked}</p><p>Automatycznie polaczone: {duplicateAutoMergeResult.merged}</p></div> : null}
          </article>

          <article className="ops-card">
            <h3 className="ops-card-title"><NotebookPen size={18} aria-hidden="true" /> Ostatnie błędy</h3>
            <p className="muted">Podgląd ostatnich nieudanych pozycji z kolejki, żeby łatwo złapać blokady albo błędne adresy URL.</p>
            <div className="result-box">
              {combinedRecentFailures.length ? (
                <ul className="result-list">
                  {combinedRecentFailures.map((failure) => (
                    <li key={`${failure.source}-${failure.external_id}`}>
                      [{failure.source}] {failure.external_id}: {failure.last_error ?? "brak szczegolow"}
                    </li>
                  ))}
                </ul>
              ) : <p>Brak ostatnich błędów.</p>}
            </div>
          </article>
        </div>
      </section>
      ) : null}

      {activeTab === "dashboard" ? (
        <>
          <div className={filtersPanelCollapsed ? "listings-workspace filters-collapsed" : "listings-workspace"}>
            {mobileFiltersOpen ? <button className="filters-mobile-backdrop" type="button" aria-label="Zamknij filtry" onClick={() => setMobileFiltersOpen(false)} /> : null}
            <aside className={mobileFiltersOpen ? "filters-sidebar mobile-open" : "filters-sidebar"} aria-label="Filtry ofert">
              <section className="panel filters-panel">
            <div className="panel-header listing-filters-header">
              <div className="listing-filters-heading">
                <span className="stats-controls-icon listing-filters-icon"><SlidersHorizontal size={19} aria-hidden="true" /></span>
                <div>
                <p className="eyebrow">Filtr</p>
                <h2>{listingSectionTitle}</h2>
                <small>Zawęź oferty tak samo jak analizowany rynek.</small>
                </div>
              </div>
              <button className="filter-mobile-close" type="button" aria-label="Zamknij filtry" onClick={() => setMobileFiltersOpen(false)}><X size={20} aria-hidden="true" /></button>
              <div className="section-switches">
                <button className={filters.shortlistedOnly ? "tab-button active" : "tab-button"} type="button" onClick={() => { const nextFilters = { ...filters, shortlistedOnly: true as const, archivedOnly: undefined, hiddenOnly: undefined }; setFilters(nextFilters); void applyFilters(nextFilters, 1); }}>
                  Ulubione
                </button>
                <button className={!filters.shortlistedOnly && !filters.archivedOnly && !filters.hiddenOnly ? "tab-button active" : "tab-button"} type="button" onClick={() => { const nextFilters = { ...filters, shortlistedOnly: undefined, archivedOnly: undefined, hiddenOnly: undefined }; setFilters(nextFilters); void applyFilters(nextFilters, 1); }}>
                  Wszystkie
                </button>
                <button className={filters.hiddenOnly ? "tab-button active" : "tab-button"} type="button" onClick={() => { const nextFilters = { ...filters, shortlistedOnly: undefined, archivedOnly: undefined, hiddenOnly: true as const }; setFilters(nextFilters); void applyFilters(nextFilters, 1); }}>
                  Tylko ukryte
                </button>
              </div>
            </div>
            <form className="filters-grid" onSubmit={(event) => { event.preventDefault(); setMobileFiltersOpen(false); void applyFilters(filters, 1); }}>
              <label className="filter-field"><span>Miasto</span><input className="text-input" value={filters.city ?? ""} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value || undefined }))} /></label>
              <label className="filter-field"><span>Dzielnica</span><select className="text-input" value={filters.district ?? ""} onChange={(event) => setFilters((current) => ({ ...current, district: event.target.value || undefined }))}><option value="">Wszystkie dzielnice</option><option value="__none__">Bez dzielnicy</option>{warsawDreamDistrictCatalog.map((item) => <option key={item.district} value={item.district}>{item.district}</option>)}</select></label>
              <label className="filter-field"><span>Cena od</span><input className="text-input" inputMode="numeric" value={stringValue(filters.minPrice)} onChange={(event) => setFilters((current) => ({ ...current, minPrice: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>Cena do</span><input className="text-input" inputMode="numeric" value={stringValue(filters.maxPrice)} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>PLN/m2 od</span><input className="text-input" inputMode="numeric" value={stringValue(filters.minPricePerSqm)} onChange={(event) => setFilters((current) => ({ ...current, minPricePerSqm: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>PLN/m2 do</span><input className="text-input" inputMode="numeric" value={stringValue(filters.maxPricePerSqm)} onChange={(event) => setFilters((current) => ({ ...current, maxPricePerSqm: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>Metraz od</span><input className="text-input" inputMode="decimal" value={stringValue(filters.minArea)} onChange={(event) => setFilters((current) => ({ ...current, minArea: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>Metraz do</span><input className="text-input" inputMode="decimal" value={stringValue(filters.maxArea)} onChange={(event) => setFilters((current) => ({ ...current, maxArea: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>Rok budowy od</span><input className="text-input" inputMode="numeric" value={stringValue(filters.minYearBuilt)} onChange={(event) => setFilters((current) => ({ ...current, minYearBuilt: toOptionalNumber(event.target.value) }))} placeholder="np. 2000" /></label>
              <label className="filter-field"><span>Rok budowy do</span><input className="text-input" inputMode="numeric" value={stringValue(filters.maxYearBuilt)} onChange={(event) => setFilters((current) => ({ ...current, maxYearBuilt: toOptionalNumber(event.target.value) }))} placeholder="np. 2020" /></label>
              <label className="filter-field"><span>Pokoje od</span><input className="text-input" inputMode="numeric" value={stringValue(filters.roomsMin)} onChange={(event) => setFilters((current) => ({ ...current, roomsMin: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>Pokoje do</span><input className="text-input" inputMode="numeric" value={stringValue(filters.roomsMax)} onChange={(event) => setFilters((current) => ({ ...current, roomsMax: toOptionalNumber(event.target.value) }))} /></label>
              <label className="filter-field"><span>Szukaj w ofercie</span><input className="text-input" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value || undefined }))} /></label>
              <label className="filter-field"><span>Sortowanie</span><select className="text-input listing-sort-select" value={listingSort} onChange={(event) => {
                const nextSort = event.target.value as ListingSortKey;
                setListingSort(nextSort);
              }}>
                <option value="newest">Sortuj: najnowsze</option>
                <option value="oldest">Sortuj: najstarsze</option>
                <option value="price_desc">Sortuj: cena malejaco</option>
                <option value="price_asc">Sortuj: cena rosnaco</option>
                <option value="area_desc">Sortuj: metraz malejaco</option>
                <option value="area_asc">Sortuj: metraz rosnaco</option>
                <option value="dream_desc">Sortuj: wymarzone mieszkanie</option>
              </select></label>
              <label className={filters.shortlistedOnly ? "check-row is-active" : "check-row"}>
                <input type="checkbox" checked={filters.shortlistedOnly ?? false} onChange={(event) => setFilters((current) => ({ ...current, shortlistedOnly: event.target.checked || undefined }))} />
                <span>Tylko ulubione</span>
              </label>
              <label className={filters.priceChangedOnly ? "check-row is-active" : "check-row"}>
                <input type="checkbox" checked={filters.priceChangedOnly ?? false} onChange={(event) => setFilters((current) => ({ ...current, priceChangedOnly: event.target.checked || undefined }))} />
                <span>Tylko zmiana ceny</span>
              </label>
              <label className={filters.archivedOnly ? "check-row is-active" : "check-row"}>
                <input type="checkbox" checked={filters.archivedOnly ?? false} onChange={(event) => setFilters((current) => ({ ...current, archivedOnly: event.target.checked || undefined, shortlistedOnly: event.target.checked ? undefined : current.shortlistedOnly, hiddenOnly: event.target.checked ? undefined : current.hiddenOnly }))} />
                <span>Tylko archiwalne</span>
              </label>
              <div className="filters-actions">
                <button className="action-button" type="submit" disabled={isLoadingListings}>{isLoadingListings ? <><LoaderCircle size={16} className="icon-spin" aria-hidden="true" /> Ładowanie...</> : "Filtruj"}</button>
                <button className="action-button secondary-button" type="button" onClick={() => {
                  setFilters(defaultFilters);
                  setListingSort("newest");
                }}>Reset</button>
              </div>
            </form>
                <button
                  className="filters-collapse-button"
                  type="button"
                  aria-label={filtersPanelCollapsed ? "Pokaz filtry" : "Ukryj filtry"}
                  onClick={() => setFiltersPanelCollapsed((current) => !current)}
                >
                  {filtersPanelCollapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
                </button>
              </section>
            </aside>

            <div ref={listingsMainRef} className="listings-main">
              <button className="mobile-filter-trigger" type="button" onClick={() => setMobileFiltersOpen(true)}>
                <SlidersHorizontal size={18} aria-hidden="true" /> Filtry
                {getActiveFilterBadges(filters).length > 0 ? <span>{getActiveFilterBadges(filters).length}</span> : null}
              </button>
              <ListingSection title={listingSectionTitle} listings={visibleListings} onOpen={openListing} onToggleShortlist={toggleShortlist} updatingShortlistId={isUpdatingShortlist} isLoading={isLoadingListings} />
              {listingsTotal > 0 ? (
                <section className="panel">
              <div className="pagination-row">
                <span className="muted">Strona {currentListingsPage} z {totalListingsPages} · {listingsTotal} ofert</span>
                <div className="pagination-pages">
                  <button className="action-button secondary-button" type="button" disabled={isLoadingListings || currentListingsPage <= 1} onClick={() => void applyFilters(filters, currentListingsPage - 1)}>
                    Poprzednia
                  </button>
                  {buildPageNumbers(currentListingsPage, totalListingsPages).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={pageNumber === currentListingsPage ? "tab-button active" : "tab-button"}
                      type="button"
                      onClick={() => void applyFilters(filters, pageNumber)} disabled={isLoadingListings}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button className="action-button secondary-button" type="button" disabled={isLoadingListings || currentListingsPage >= totalListingsPages} onClick={() => void applyFilters(filters, currentListingsPage + 1)}>
                    Nastepna
                  </button>
                </div>
              </div>
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "map" ? (
        <section className="panel">
          <div className="panel-header">
            <div><p className="eyebrow">Mapa</p><h2>Oferty naniesione na mapie</h2></div>
          </div>
          <MapView listings={mapListings} selectedListingId={selectedListing?.id} onOpen={openListing} workplaces={settings.workplaces} isLoading={isLoadingMapListings} />
        </section>
      ) : null}

      {selectedListing ? (
        <ListingDetailPanel
          listing={selectedListing}
          duplicateCandidates={selectedListingDuplicateCandidates}
          onClose={() => { window.history.pushState({}, "", window.location.pathname); setSelectedListing(null); }}
          onOpenRelatedListing={openListing}
          onReviewDuplicate={reviewDuplicatePair}
          onToggleShortlist={toggleShortlist}
          onDismiss={dismissListing}
          onArchive={archiveListing}
          isCompared={compareListingIds.includes(selectedListing.id)}
          onToggleCompare={toggleCompareListing}
          isUpdatingShortlist={isUpdatingShortlist === selectedListing.id}
          isDismissing={isDismissingListing === selectedListing.id}
          isArchiving={isArchivingListing === selectedListing.id}
          isLoadingDuplicateCandidates={isLoadingDuplicateCandidates}
          isReviewingDuplicatePair={isReviewingDuplicatePair}
          onSaveManual={saveListingManual}
          onAddContactEvent={saveListingContactEvent}
          onScheduleViewing={scheduleViewing}
          onDeleteViewing={deleteViewing}
          onBackfillMedia={runListingMediaBackfill}
          onRefreshFromSource={refreshListingFromSource}
          refreshConfirmation={listingRefreshConfirmation?.listingId === selectedListing.id ? listingRefreshConfirmation : null}
          isBackfillingMedia={isBackfillingListingMedia === selectedListing.id}
          isRefreshingFromSource={isRefreshingListingData === selectedListing.id}
          isSavingManual={isSavingListingManual}
          isSavingContactEvent={isSavingContactEvent}
          isLoadingInsights={isLoadingListingInsights}
          onRefreshInsights={() => loadListingInsights(selectedListing.id, true)}
          onAddToMortgage={(listing) => {
            const propertyTotal = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0;
            setMortgageDraft({ propertyTotal, principal: Math.max(0, propertyTotal - DEFAULT_DOWN_PAYMENT), listingTitle: listing.title, listingId: listing.id });
            setActiveTab("mortgage");
            setSelectedListing(null);
          }}
        />
      ) : null}

      {isOpeningListing && !selectedListing ? (
        <aside className="detail-overlay">
          <section className="detail-panel">
            <div className="result-box">Ladowanie oferty...</div>
          </section>
        </aside>
      ) : null}

      {settingsOpen ? <SettingsPanel settings={settings} onClose={() => { setSettingsSaveError(null); setSettingsOpen(false); }} onSave={saveSettings} isSaving={isSavingSettings} saveError={settingsSaveError} /> : null}
    </main>
  );

  async function loadInitial() {
    if (initialLoadInFlightRef.current) return;
    initialLoadInFlightRef.current = true;
    try {
      const [dashboardResponse, alertsResponse, regionResponse, settingsResponse, upcomingViewingsResponse, listingsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/dashboard`),
        fetch(`${apiBaseUrl}/api/alerts`),
        fetch(`${apiBaseUrl}/api/region`),
        fetch(`${apiBaseUrl}/api/settings/family`),
        fetch(`${apiBaseUrl}/api/viewings/upcoming`),
        fetch(`${apiBaseUrl}/api/listings?${createListingsQuery(filters, currentListingsPage, listingSort)}`)
      ]);
      const failedResponse = [dashboardResponse, alertsResponse, regionResponse, settingsResponse, upcomingViewingsResponse, listingsResponse].find((response) => !response.ok);
      if (failedResponse) {
        const endpoint = new URL(failedResponse.url).pathname;
        throw new Error(`Nie udało się pobrać danych: ${endpoint} (HTTP ${failedResponse.status}). Spróbuj ponownie.`);
      }

      const listings = (await listingsResponse.json()) as ListingsResponse;
      setState({
        status: "ready",
        dashboard: (await dashboardResponse.json()) as DashboardResponse,
        alerts: (await alertsResponse.json()) as AlertsResponse,
        region: (await regionResponse.json()) as SupportedRegion,
        settings: (await settingsResponse.json()) as FamilySettings,
        upcomingViewings: (await upcomingViewingsResponse.json()) as UpcomingViewingsResponse
      });
      setFilteredListings(listings.items);
      setListingsTotal(listings.total);
      setCurrentListingsPage(currentListingsPage);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Nieznany blad pobierania danych." });
    } finally {
      initialLoadInFlightRef.current = false;
    }
  }

  async function refreshDashboard() {
    const response = await fetch(`${apiBaseUrl}/api/dashboard`);
    if (!response.ok) return;
    const dashboardResponse = (await response.json()) as DashboardResponse;
    setState((current) => current.status === "ready" ? { ...current, dashboard: dashboardResponse } : current);
  }


  async function refreshAlerts() {
    const response = await fetch(`${apiBaseUrl}/api/alerts`);
    if (!response.ok) return;
    const alertsResponse = (await response.json()) as AlertsResponse;
    setState((current) => current.status === "ready" ? { ...current, alerts: alertsResponse } : current);
  }

  async function refreshUpcomingViewings() {
    const response = await fetch(`${apiBaseUrl}/api/viewings/upcoming`);
    if (!response.ok) return;
    const upcomingViewingsResponse = (await response.json()) as UpcomingViewingsResponse;
    setState((current) => current.status === "ready" ? { ...current, upcomingViewings: upcomingViewingsResponse } : current);
  }

  async function applyFilters(nextFilters = filters, nextPage = currentListingsPage, nextSort = listingSort) {
    const shouldScrollToListingTop = nextPage !== currentListingsPage;
    setIsLoadingListings(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings?${createListingsQuery(nextFilters, nextPage, nextSort)}`);
      if (!response.ok) return;
      const data = (await response.json()) as ListingsResponse;
      setFilteredListings(data.items);
      setListingsTotal(data.total);
      setFilters(nextFilters);
      setListingSort(nextSort);
      setCurrentListingsPage(nextPage);
      if (shouldScrollToListingTop) {
        requestAnimationFrame(() => {
          listingsMainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } finally {
      setIsLoadingListings(false);
    }
  }

  async function loadMapListings() {
    setIsLoadingMapListings(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/map`);
      if (!response.ok) return;
      const data = (await response.json()) as ListingSummary[];
      setMapListings(data);
    } finally {
      setIsLoadingMapListings(false);
    }
  }

  async function loadDuplicateGroups(limit = 100) {
    setIsLoadingDuplicateGroups(true);
    setDuplicateError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/duplicates/groups?limit=${Math.max(limit, duplicateGroups.length)}&summary=true`);
      if (!response.ok) throw new Error("Nie udało się pobrać grup duplikatów.");
      const data = await response.json() as { items: DuplicateGroupOverview[]; total: number; totalMembers: number; totalCopies: number };
      setDuplicateGroups(data.items);
      setDuplicateTotal(data.total);
      setDuplicateTotals({ members: data.totalMembers, copies: data.totalCopies });
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "Błąd odczytu duplikatów.");
    } finally { setIsLoadingDuplicateGroups(false); }
  }

  async function unmergeDuplicate(primaryListingId: string, duplicateListingId: string) {
    if (duplicateAction) return;
    setDuplicateAction(primaryListingId);
    setDuplicateError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/duplicates/unmerge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryListingId, duplicateListingId }) });
      if (!response.ok) throw new Error("Nie udało się rozłączyć ofert. Odśwież grupy i spróbuj ponownie.");
      await Promise.all([loadDuplicateGroups(), refreshDashboard(), loadMapListings(), applyFilters(filters, currentListingsPage, listingSort)]);
    } catch (error) { setDuplicateError(error instanceof Error ? error.message : "Błąd rozłączania."); }
    finally { setDuplicateAction(null); }
  }

  async function confirmDuplicateGroup(primaryListingId: string) {
    if (duplicateAction) return;
    setDuplicateAction(primaryListingId);
    setDuplicateError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/duplicates/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryListingId }) });
      if (!response.ok) throw new Error("Nie udało się zatwierdzić grupy.");
      await loadDuplicateGroups();
    } catch (error) { setDuplicateError(error instanceof Error ? error.message : "Błąd zatwierdzania."); }
    finally { setDuplicateAction(null); }
  }

  async function openListing(listingId: string, updateUrl = true) {
    window.dispatchEvent(new Event("mieszkania:open-listing"));
    setIsOpeningListing(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}`);
      if (!response.ok) return;
      const detail = (await response.json()) as ListingDetail;
      setSelectedListing(detail);
      if (updateUrl) window.history.pushState({}, "", listingHref(detail.id));
      void loadListingInsights(detail.id);
      void loadDuplicateCandidates(detail.id);
    } finally {
      setIsOpeningListing(false);
    }
  }

  async function loadDuplicateCandidates(listingId: string) {
    setIsLoadingDuplicateCandidates(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/duplicates/candidates?limit=40&listingId=${encodeURIComponent(listingId)}`);
      if (!response.ok) {
        setSelectedListingDuplicateCandidates([]);
        return;
      }

      const result = (await response.json()) as DuplicateCandidatesResponse;
      setSelectedListingDuplicateCandidates(result.items);
    } finally {
      setIsLoadingDuplicateCandidates(false);
    }
  }

  async function loadListingInsights(listingId: string, force = false) {
    setIsLoadingListingInsights(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}/insights${force ? "?refresh=true" : ""}`);
      if (!response.ok) return;
      const insights = (await response.json()) as Pick<ListingDetail, "commutes" | "amenities" | "amenityAnalysis">;
      setSelectedListing((current) => current?.id === listingId ? {
        ...current,
        commutes: insights.commutes,
        amenities: insights.amenities,
        amenityAnalysis: insights.amenityAnalysis
      } : current);
    } finally {
      setIsLoadingListingInsights(false);
    }
  }

  async function toggleShortlist(listingId: string, shortlisted: boolean) {
    setIsUpdatingShortlist(listingId);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}/shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortlisted })
      });
      if (!response.ok) return;

      setFilteredListings((current) => current.map((listing) => listing.id === listingId ? { ...listing, isShortlisted: shortlisted } : listing));
      setState((current) => current.status === "ready" ? {
        ...current,
        dashboard: { ...current.dashboard, listings: current.dashboard.listings.map((listing) => listing.id === listingId ? { ...listing, isShortlisted: shortlisted } : listing) },
      } : current);
      setSelectedListing((current) => current?.id === listingId ? { ...current, isShortlisted: shortlisted } : current);
    } finally {
      setIsUpdatingShortlist(null);
    }
  }

  async function saveSettings(nextSettings: FamilySettings) {
    setIsSavingSettings(true);
    setSettingsSaveError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/family`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings)
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || `API zwróciło błąd ${response.status}.`);
      }
      const saved = (await response.json()) as FamilySettings;
      const missingLocations = nextSettings.dreamProfile.preferredDistricts.filter((location) => !saved.dreamProfile.preferredDistricts.includes(location));
      if (missingLocations.length > 0) {
        throw new Error(`Nie zapisano lokalizacji: ${missingLocations.join(", ")}.`);
      }
      setState((current) => current.status === "ready" ? { ...current, settings: saved } : current);
      await Promise.all([refreshDashboard(), refreshAlerts(), applyFilters()]);
      setSettingsOpen(false);
    } catch (error) {
      setSettingsSaveError(error instanceof Error ? error.message : "Nie udało się zapisać ustawień.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function saveListingManual(manual: ListingDetail["manual"]) {
    if (!selectedListing) return;
    setIsSavingListingManual(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${selectedListing.id}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual)
      });
      if (!response.ok) return;
      const detail = (await response.json()) as ListingDetail;
      setSelectedListing(detail);
      await Promise.all([refreshDashboard(), applyFilters()]);
    } finally {
      setIsSavingListingManual(false);
    }
  }

  async function saveListingContactEvent(event: {
    eventType: ListingContactEventType;
    occurredAt: string;
    title?: string;
    notes?: string;
    contactName?: string;
    amount?: number;
  }) {
    if (!selectedListing) return;
    setIsSavingContactEvent(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${selectedListing.id}/contact-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event)
      });
      if (!response.ok) return;
      const detail = (await response.json()) as ListingDetail;
      setSelectedListing(detail);
      await Promise.all([refreshDashboard(), refreshUpcomingViewings(), refreshAlerts(), applyFilters()]);
    } finally {
      setIsSavingContactEvent(false);
    }
  }

  function toggleCompareListing(listingId: string) {
    setCompareListingIds((current) => {
      if (current.includes(listingId)) {
        return current.filter((id) => id !== listingId);
      }

      if (current.length >= 5) {
        return [...current.slice(1), listingId];
      }

      return [...current, listingId];
    });
  }

  function removeFromCompare(listingId: string) {
    setCompareListingIds((current) => current.filter((id) => id !== listingId));
  }

  async function scheduleViewing(input: { listingId: string; scheduledAt: string; notes?: string }) {
    const response = await fetch(`${apiBaseUrl}/api/listings/${input.listingId}/viewing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: input.scheduledAt, notes: input.notes, status: "scheduled" })
    });
    if (!response.ok) return;
    await Promise.all([openListing(input.listingId), refreshDashboard(), refreshUpcomingViewings(), refreshAlerts(), applyFilters()]);
  }

  async function deleteViewing(listingId: string) {
    const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}/viewing`, {
      method: "DELETE"
    });
    if (!response.ok) return;
    await Promise.all([openListing(listingId), refreshDashboard(), refreshUpcomingViewings(), refreshAlerts(), applyFilters()]);
  }

  async function runCollector() {
    setIsCollecting(true);
    setCollectError(null);
    try {
      const response = await fetch(resolveCollectorEndpoint(collectUrl.trim()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: collectUrl.trim() })
      });
      if (!response.ok) throw new Error(`Collector failed with status ${response.status}`);
      setCollectResult((await response.json()) as CollectorRunResponse);
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : "Collector failed.");
    } finally {
      setIsCollecting(false);
    }
  }

  async function runBulkCollector() {
    setIsBulkCollecting(true);
    setBulkError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/otodom/collect-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: bulkCity.trim(),
          startPage: Number(bulkStartPage) || 1,
          pages: Number(bulkPages) || 3,
          limit: Number(bulkLimit) || 12
        })
      });
      if (!response.ok) throw new Error(`Bulk collector failed with status ${response.status}`);
      setBulkResult((await response.json()) as {
        discovered: number;
        collected: number;
        startPage: number;
        pagesScanned: number;
        limitApplied: number;
        created: number;
        updated: number;
        unchanged: number;
        failed: number;
      });
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk collector failed.");
    } finally {
      setIsBulkCollecting(false);
    }
  }

  async function runRcnImport() {
    setIsImportingRcn(true);
    setRcnError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/rcn/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "warsaw-metropolitan" })
      });
      if (!response.ok) throw new Error(`RCN import failed with status ${response.status}`);
      setRcnResult((await response.json()) as RcnImportResponse);
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setRcnError(error instanceof Error ? error.message : "RCN import failed.");
    } finally {
      setIsImportingRcn(false);
    }
  }

  async function runDiscoverAll() {
    setIsDiscoveringAll(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/otodom/discover-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: discoverAllCity.trim(),
          startPage: 1,
          maxPages: toOptionalNumber(discoverAllMaxPages) ?? 700,
          batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5
        })
      });
      if (!response.ok) throw new Error(`Discover-all failed with status ${response.status}`);
      setDiscoverAllResult((await response.json()) as OtodomDiscoverAllResponse);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Discover-all failed.");
    } finally {
      setIsDiscoveringAll(false);
    }
  }

  async function runDiscoverAllPortals() {
    setIsDiscoveringAllPortals(true);
    setQueueError(null);
    setQueueErrorAction(null);
    try {
      const [otodomResponse, gratkaResponse, olxResponse, nieruchomosciOnlineResponse, domiportaResponse, maxonResponse, adresowoResponse, morizonResponse, staleRefreshResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/collectors/otodom/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: toOptionalNumber(discoverAllMaxPages) ?? 50,
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5
          })
        }),
        fetch(`${apiBaseUrl}/api/collectors/gratka/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5
          })
        }),
        fetch(`${apiBaseUrl}/api/collectors/olx/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5
          })
        }),
        fetch(`${apiBaseUrl}/api/collectors/nieruchomosci-online/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: discoverAllCity.trim(), startPage: 1, maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250), batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/domiporta/discover-all`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: discoverAllCity.trim(), startPage: 1, maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250), batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/maxon/discover-all`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: discoverAllCity.trim(), startPage: 1, maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250), batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/adresowo/discover-all`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: discoverAllCity.trim(), startPage: 1, maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250), batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/morizon/discover-all`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: discoverAllCity.trim(), startPage: 1, maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250), batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5 })
        }),
        fetch(`${apiBaseUrl}/api/listings/refresh-stale`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        })
      ]);

      if (!otodomResponse.ok) {
        throw new Error(`Otodom discover-all failed with status ${otodomResponse.status}`);
      }

      if (!gratkaResponse.ok) {
        throw new Error(`Gratka discover-all failed with status ${gratkaResponse.status}`);
      }
      if (!olxResponse.ok) {
        throw new Error(`OLX discover-all failed with status ${olxResponse.status}`);
      }
      if (!nieruchomosciOnlineResponse.ok) throw new Error(`Nieruchomosci-online discover-all failed with status ${nieruchomosciOnlineResponse.status}`);
      if (!domiportaResponse.ok) throw new Error(`Domiporta discover-all failed with status ${domiportaResponse.status}`);
      if (!maxonResponse.ok) throw new Error(`Maxon discover-all failed with status ${maxonResponse.status}`);
      if (!adresowoResponse.ok) throw new Error(`Adresowo discover-all failed with status ${adresowoResponse.status}`);
      if (!morizonResponse.ok) throw new Error(`Morizon discover-all failed with status ${morizonResponse.status}`);
      if (!staleRefreshResponse.ok) throw new Error(`Stale listing refresh failed with status ${staleRefreshResponse.status}`);
      const portalResults = [
        ["Otodom", await otodomResponse.json()],
        ["Gratka", await gratkaResponse.json()],
        ["OLX", await olxResponse.json()],
        ["Nieruchomości-online", await nieruchomosciOnlineResponse.json()],
        ["Domiporta", await domiportaResponse.json()],
        ["Maxon", await maxonResponse.json()],
        ["Adresowo", await adresowoResponse.json()],
        ["Morizon", await morizonResponse.json()]
      ] as Array<[string, OtodomDiscoverAllResponse]>;
      setDiscoverAllResult(portalResults[0][1]);
      setGratkaDiscoverAllResult(portalResults[1][1]);
      setOlxDiscoverAllResult(portalResults[2][1]);
      setNieruchomosciOnlineDiscoverAllResult(portalResults[3][1]);
      setDomiportaDiscoverAllResult(portalResults[4][1]);
      setMaxonDiscoverAllResult(portalResults[5][1]);
      setAdresowoDiscoverAllResult(portalResults[6][1]);
      setMorizonDiscoverAllResult(portalResults[7][1]);
      setStaleListingRefresh((await staleRefreshResponse.json()) as StaleListingRefreshStatus);
      const stoppedPortals = portalResults.filter(([, result]) => result.stoppedBecause === "error");
      if (stoppedPortals.length > 0) {
        const networkFailures = stoppedPortals.filter(([, result]) => isOutboundNetworkError(result.error));
        if (networkFailures.length === portalResults.length) {
          setQueueError("Backend nie ma obecnie dostępu do internetu (połączenia HTTPS są blokowane). Nie usunęliśmy ani nie zmieniliśmy istniejących ofert. Sprawdź zaporę, VPN lub uruchomienie serwera API i spróbuj ponownie.");
        } else {
          setQueueError(`Nie udało się sprawdzić: ${stoppedPortals.map(([name, result]) => `${name}${result.error ? ` (${friendlyPortalError(result.error)})` : ""}`).join(", ")}. Oferty z pozostałych portali zostały zachowane.`);
        }
        setQueueErrorAction("discover");
      }
      await fetch(`${apiBaseUrl}/api/listings/automation/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await Promise.all([refreshQueueStatus(), refreshStaleListingStatus()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Multi-portal discover-all failed.");
      setQueueErrorAction("discover");
    } finally {
      setIsDiscoveringAllPortals(false);
    }
  }

  async function runGratkaDiscoverAll() {
    setIsDiscoveringGratka(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/gratka/discover-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: discoverAllCity.trim(),
          startPage: 1,
          maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
          batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5
        })
      });
      if (!response.ok) throw new Error(`Gratka discover-all failed with status ${response.status}`);
      const result = (await response.json()) as OtodomDiscoverAllResponse;
      setGratkaDiscoverAllResult(result);
      if (result.stoppedBecause === "error") {
        throw new Error(result.error ?? "Gratka discover-all failed.");
      }
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Gratka discover-all failed.");
    } finally {
      setIsDiscoveringGratka(false);
    }
  }

  async function runProcessQueue() {
    setIsProcessingQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/otodom/process-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: toOptionalNumber(queueLimit) ?? 200,
          concurrency: toOptionalNumber(queueConcurrency) ?? 8
        })
      });
      if (!response.ok) throw new Error(`Process-queue failed with status ${response.status}`);
      setQueueProcessResult((await response.json()) as OtodomQueueProcessResponse);
      await Promise.all([refreshQueueStatus(), refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Process-queue failed.");
    } finally {
      setIsProcessingQueue(false);
    }
  }

  async function runGratkaProcessQueue() {
    setIsProcessingGratkaQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/gratka/process-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: toOptionalNumber(queueLimit) ?? 200,
          concurrency: toOptionalNumber(queueConcurrency) ?? 8
        })
      });
      if (!response.ok) throw new Error(`Gratka process-queue failed with status ${response.status}`);
      setGratkaQueueProcessResult((await response.json()) as OtodomQueueProcessResponse);
      await Promise.all([refreshQueueStatus(), refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Gratka process-queue failed.");
    } finally {
      setIsProcessingGratkaQueue(false);
    }
  }

  async function runProcessAllPortals() {
    const abortController = new AbortController();
    processAllAbortRef.current = abortController;
    processAllStartedAtRef.current = Date.now();
    processAllLastProgressAtRef.current = Date.now();
    processAllLastCountsRef.current = combinedQueueCounts;
    processAllObservedProgressRef.current = false;
    processAllStopReasonRef.current = null;
    setIsProcessingAllPortals(true);
    setQueueError(null);
    setQueueErrorAction(null);
    setQueueNotice({ tone: "info", message: "Pobieranie rozpoczęte. Status kolejek odświeża się automatycznie co 3 sekundy." });
    try {
      const resumeResponse = await fetch(`${apiBaseUrl}/api/listings/automation/resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!resumeResponse.ok) throw new Error(`Automation resume failed with status ${resumeResponse.status}`);
      setStaleListingRefresh((current) => current ? { ...current, automationPaused: false } : current);
      const [otodomResponse, gratkaResponse, olxResponse, nieruchomosciOnlineResponse, domiportaResponse, maxonResponse, adresowoResponse, morizonResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/collectors/otodom/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8
          })
        }),
        fetch(`${apiBaseUrl}/api/collectors/gratka/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8
          })
        }),
        fetch(`${apiBaseUrl}/api/collectors/olx/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8
          })
        }),
        fetch(`${apiBaseUrl}/api/collectors/nieruchomosci-online/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: toOptionalNumber(queueLimit) ?? 200, concurrency: toOptionalNumber(queueConcurrency) ?? 8, force: true })
        }),
        fetch(`${apiBaseUrl}/api/collectors/domiporta/process-queue`, {
          method: "POST", signal: abortController.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: toOptionalNumber(queueLimit) ?? 200, concurrency: toOptionalNumber(queueConcurrency) ?? 8 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/maxon/process-queue`, {
          method: "POST", signal: abortController.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: toOptionalNumber(queueLimit) ?? 200, concurrency: toOptionalNumber(queueConcurrency) ?? 8 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/adresowo/process-queue`, {
          method: "POST", signal: abortController.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: toOptionalNumber(queueLimit) ?? 200, concurrency: toOptionalNumber(queueConcurrency) ?? 8 })
        }),
        fetch(`${apiBaseUrl}/api/collectors/morizon/process-queue`, {
          method: "POST", signal: abortController.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: toOptionalNumber(queueLimit) ?? 200, concurrency: toOptionalNumber(queueConcurrency) ?? 4 })
        })
      ]);

      if (!otodomResponse.ok) throw new Error(`Otodom process-queue failed with status ${otodomResponse.status}`);
      if (!gratkaResponse.ok) throw new Error(`Gratka process-queue failed with status ${gratkaResponse.status}`);
      if (!olxResponse.ok) throw new Error(`OLX process-queue failed with status ${olxResponse.status}`);
      if (!nieruchomosciOnlineResponse.ok) throw new Error(`Nieruchomosci-online process-queue failed with status ${nieruchomosciOnlineResponse.status}`);
      if (!domiportaResponse.ok) throw new Error(`Domiporta process-queue failed with status ${domiportaResponse.status}`);
      if (!maxonResponse.ok) throw new Error(`Maxon process-queue failed with status ${maxonResponse.status}`);
      if (!adresowoResponse.ok) throw new Error(`Adresowo process-queue failed with status ${adresowoResponse.status}`);
      if (!morizonResponse.ok) throw new Error(`Morizon process-queue failed with status ${morizonResponse.status}`);

      const portalResults = [
        ["Otodom", await otodomResponse.json()],
        ["Gratka", await gratkaResponse.json()],
        ["OLX", await olxResponse.json()],
        ["Nieruchomości-online", await nieruchomosciOnlineResponse.json()],
        ["Domiporta", await domiportaResponse.json()],
        ["Maxon", await maxonResponse.json()],
        ["Adresowo", await adresowoResponse.json()],
        ["Morizon", await morizonResponse.json()]
      ] as Array<[string, OtodomQueueProcessResponse]>;
      setQueueProcessResult(portalResults[0][1]);
      setGratkaQueueProcessResult(portalResults[1][1]);
      setOlxQueueProcessResult(portalResults[2][1]);
      setNieruchomosciOnlineQueueProcessResult(portalResults[3][1]);
      setDomiportaQueueProcessResult(portalResults[4][1]);
      setMaxonQueueProcessResult(portalResults[5][1]);
      setAdresowoQueueProcessResult(portalResults[6][1]);
      setMorizonQueueProcessResult(portalResults[7][1]);
      const failedPortals = portalResults.filter(([, result]) => result.failed > 0);
      const deferredPortals = portalResults.filter(([, result]) => (result.deferred ?? 0) > 0 || Boolean(result.pausedUntil));
      if (failedPortals.length > 0) {
        setQueueError(`Część ofert nie została pobrana: ${failedPortals.map(([name, result]) => `${name}: ${result.failed}`).join(" · ")}. Udane oferty są już zapisane; ponowienie obejmie tylko błędne lub oczekujące rekordy.`);
        setQueueErrorAction("process");
        setQueueNotice(null);
      } else if (deferredPortals.length > 0) {
        const completed = portalResults.reduce((sum, [, result]) => sum + result.completed, 0);
        const deferred = portalResults.reduce((sum, [, result]) => sum + (result.deferred ?? 0), 0);
        const pausedUntil = getNextProcessAttemptAt(...portalResults.map(([, result]) => result));
        setQueueNotice({
          tone: "info",
          message: `${completed > 0 ? `Zapisano ${completed} ofert. ` : ""}${deferred > 0 ? `${deferred} ofert odłożono` : "Portal chwilowo wstrzymał pobieranie"}${pausedUntil ? `; automatyczne wznowienie ${formatQueueAttemptTime(pausedUntil)}` : ""}.`
        });
      } else {
        const completed = portalResults.reduce((sum, [, result]) => sum + result.completed, 0);
        setQueueNotice({ tone: "success", message: `Pobieranie zakończone. Zapisano ${completed} ofert.` });
      }

      // Import zakończył się wraz z odpowiedziami kolektorów. Odświeżanie widoków
      // wykonujemy osobno, aby wolne zapytanie do dashboardu lub listy nie
      // pozostawiało przycisku w stanie "Pobieranie" mimo ukończonego importu.
      if (processAllAbortRef.current === abortController) processAllAbortRef.current = null;
      setIsProcessingAllPortals(false);
      await refreshQueueStatus("passive");
      void Promise.all([refreshStaleListingStatus(), refreshDashboard(), applyFilters()]).catch(() => undefined);
    } catch (error) {
      const stopReason = processAllStopReasonRef.current;
      if (stopReason === "manual") {
        setQueueError(null);
        setQueueErrorAction(null);
        setQueueNotice({ tone: "info", message: "Automat zatrzymany. Rozpoczęte oferty mogą się jeszcze dokończyć, ale następna partia nie wystartuje." });
        void refreshQueueStatus("passive");
      } else if (stopReason !== "completed" && stopReason !== "stalled") {
        setQueueNotice(null);
        setQueueError(error instanceof Error ? error.message : "Multi-portal process-queue failed.");
        setQueueErrorAction("process");
      }
    } finally {
      if (processAllAbortRef.current === abortController) processAllAbortRef.current = null;
      setIsProcessingAllPortals(false);
    }
  }

  async function stopListingAutomation() {
    setIsTogglingListingAutomation(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/automation/pause`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error(`Automation pause failed with status ${response.status}`);
      processAllStopReasonRef.current = "manual";
      processAllAbortRef.current?.abort();
      setIsProcessingAllPortals(false);
      setStaleListingRefresh((current) => current ? { ...current, automationPaused: true, running: false } : current);
      setQueueError(null);
      setQueueErrorAction(null);
      setQueueNotice({ tone: "info", message: "Automat zatrzymany. Trwająca oferta może zostać dokończona, ale kolejna partia nie wystartuje." });
      await refreshQueueStatus("passive");
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Nie udało się zatrzymać automatu.");
    } finally {
      setIsTogglingListingAutomation(false);
    }
  }

  async function runAllOtodom() {
    setIsRunningAll(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/otodom/run-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: discoverAllCity.trim(),
          startPage: 1,
          maxPages: toOptionalNumber(discoverAllMaxPages) ?? 700,
          batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          processLimit: toOptionalNumber(queueLimit) ?? 200,
          concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          maxRounds: 50
        })
      });
      if (!response.ok) throw new Error(`Run-all failed with status ${response.status}`);
      const result = (await response.json()) as OtodomRunAllResponse;
      setRunAllResult(result);
      setDiscoverAllResult(result.discoverAll);
      setQueueStatus(result.finalQueueStatus);
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Run-all failed.");
    } finally {
      setIsRunningAll(false);
    }
  }

  async function runAllGratka() {
    setIsRunningGratkaAll(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/gratka/run-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: discoverAllCity.trim(),
          startPage: 1,
          maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
          batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          processLimit: toOptionalNumber(queueLimit) ?? 200,
          concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          maxRounds: 50
        })
      });
      if (!response.ok) throw new Error(`Gratka run-all failed with status ${response.status}`);
      const result = (await response.json()) as OtodomRunAllResponse;
      setGratkaRunAllResult(result);
      setGratkaDiscoverAllResult(result.discoverAll);
      setGratkaQueueStatus(result.finalQueueStatus);
      if (result.discoverAll.stoppedBecause === "error") {
        throw new Error(result.discoverAll.error ?? "Gratka run-all failed during discovery.");
      }
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Gratka run-all failed.");
    } finally {
      setIsRunningGratkaAll(false);
    }
  }

  async function refreshQueueStatus(origin: "manual" | "monitor" | "passive" = "passive") {
    if (queueStatusInFlightRef.current) return;
    queueStatusInFlightRef.current = true;
    if (origin === "manual") setIsRefreshingQueueStatus(true);
    const portals = [
      ["otodom", "Otodom", setQueueStatus], ["gratka", "Gratka", setGratkaQueueStatus],
      ["olx", "OLX", setOlxQueueStatus], ["nieruchomosci-online", "Nieruchomości-online", setNieruchomosciOnlineQueueStatus],
      ["domiporta", "Domiporta", setDomiportaQueueStatus], ["maxon", "Maxon", setMaxonQueueStatus],
      ["adresowo", "Adresowo", setAdresowoQueueStatus], ["morizon", "Morizon", setMorizonQueueStatus]
    ] as const;
    try {
      const results = await Promise.allSettled(portals.map(async ([key]) => {
        const response = await fetch(`${apiBaseUrl}/api/collectors/${key}/queue-status`, { signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error(String(response.status));
        return await response.json() as OtodomQueueStatusResponse;
      }));
      const statuses: OtodomQueueStatusResponse[] = [];
      const unavailable: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") { portals[index][2](result.value); statuses.push(result.value); }
        else unavailable.push(portals[index][1]);
      });
      setQueueStatusError(unavailable.length ? `Brak aktualnego statusu: ${unavailable.join(", ")}. Liczniki tych portali mogą być nieaktualne; ponawiam odczyt automatycznie.` : null);
      if (!unavailable.length) setQueueStatusCheckedAt(new Date());
      if (unavailable.length || !processAllAbortRef.current || !processAllStartedAtRef.current) return;
      const counts = sumQueueCounts(...statuses);
      const previous = processAllLastCountsRef.current;
      if (previous && (counts.pending < previous.pending || counts.completed > previous.completed || counts.failed > previous.failed)) {
        processAllLastProgressAtRef.current = Date.now();
      }
      processAllLastCountsRef.current = counts;
      const inactiveFor = Date.now() - processAllLastProgressAtRef.current;
      // Only collector responses confirm a completed batch. An idle sample can occur between jobs.
      setQueueNotice({ tone: "info", message: inactiveFor >= 60_000
        ? `Dłuższe oczekiwanie: ${counts.processing} w toku, ${counts.pending} oczekuje. Pobieranie lub ponowne próby mogą potrwać kilka minut. Możesz zatrzymać automat; rozpoczęte zadania mogą się jeszcze dokończyć.`
        : `Pobieranie trwa: ${counts.processing} w toku, ${counts.pending} oczekuje, ${counts.failed} błędów.` });
    } finally {
      queueStatusInFlightRef.current = false;
      if (origin === "manual") setIsRefreshingQueueStatus(false);
    }
  }

  async function retryFailedQueue() {
    setIsRetryingFailedQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/otodom/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Retry-failed failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Retry-failed failed.");
    } finally {
      setIsRetryingFailedQueue(false);
    }
  }

  async function retryFailedGratkaQueue() {
    setIsRetryingFailedGratkaQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/gratka/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Gratka retry-failed failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Gratka retry-failed failed.");
    } finally {
      setIsRetryingFailedGratkaQueue(false);
    }
  }

  async function retryFailedOlxQueue() {
    setIsRetryingFailedOlxQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/olx/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`OLX retry-failed failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "OLX retry-failed failed.");
    } finally {
      setIsRetryingFailedOlxQueue(false);
    }
  }

  async function resetProcessingQueue() {
    setIsResettingProcessingQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/otodom/reset-processing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Otodom reset-processing failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Otodom reset-processing failed.");
    } finally {
      setIsResettingProcessingQueue(false);
    }
  }

  async function resetProcessingGratkaQueue() {
    setIsResettingProcessingGratkaQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/gratka/reset-processing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Gratka reset-processing failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Gratka reset-processing failed.");
    } finally {
      setIsResettingProcessingGratkaQueue(false);
    }
  }

  async function resetProcessingOlxQueue() {
    setIsResettingProcessingOlxQueue(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/olx/reset-processing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`OLX reset-processing failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "OLX reset-processing failed.");
    } finally {
      setIsResettingProcessingOlxQueue(false);
    }
  }

  async function deleteOlxData() {
    setIsDeletingOlxData(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/olx/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error(`OLX delete-data failed with status ${response.status}`);
      setOlxDiscoverAllResult(null);
      setOlxQueueProcessResult(null);
      await Promise.all([refreshQueueStatus(), refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "OLX delete-data failed.");
    } finally {
      setIsDeletingOlxData(false);
    }
  }

  async function importWarsawStreets() {
    setIsImportingWarsawStreets(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/streets/warsaw/import`, { method: "POST" });
      if (!response.ok) throw new Error(`Street import failed with status ${response.status}`);
      setWarsawStreetImportResult((await response.json()) as { imported: number; received: number });
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Nie udało się zaimportować ulic Warszawy.");
    } finally {
      setIsImportingWarsawStreets(false);
    }
  }

  async function dismissListing(listingId: string) {
    setIsDismissingListing(listingId);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}/dismiss`, { method: "POST" });
      if (!response.ok) throw new Error(`Dismiss listing failed with status ${response.status}`);
      setSelectedListing(null);
      setCompareListingIds((current) => current.filter((id) => id !== listingId));
      await Promise.all([refreshDashboard(), refreshAlerts(), applyFilters(), loadMapListings()]);
    } finally {
      setIsDismissingListing(null);
    }
  }

  async function archiveListing(listingId: string) {
    setIsArchivingListing(listingId);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}/archive`, { method: "POST" });
      if (!response.ok) throw new Error(`Archive listing failed with status ${response.status}`);
      setSelectedListing(null);
      setCompareListingIds((current) => current.filter((id) => id !== listingId));
      await Promise.all([refreshDashboard(), refreshAlerts(), applyFilters(), loadMapListings()]);
    } finally {
      setIsArchivingListing(null);
    }
  }

  async function refreshStaleListingStatus() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/refresh-stale/status`);
      if (!response.ok) throw new Error("Nie udało się odczytać statusu automatu.");
      setStaleListingRefresh((await response.json()) as StaleListingRefreshStatus);
    } catch {
      // Status aktualizacji cen nie powinien blokować reszty panelu operacyjnego.
    }
  }

  async function enrichListingsFromStreets() {
    setIsEnrichingListingsFromStreets(true);
    setQueueError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/streets/warsaw/enrich-listings`, { method: "POST" });
      if (!response.ok) throw new Error(`Street enrichment failed with status ${response.status}`);
      setStreetEnrichmentResult((await response.json()) as { scanned: number; matched: number; addressUpdated: number; coordinatesFilled: number; coordinatesOverridden: number });
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Nie udało się uzupełnić ofert z katalogu ulic.");
    } finally {
      setIsEnrichingListingsFromStreets(false);
    }
  }

  async function runMediaBackfill() {
    setIsBackfillingMedia(true);
    setMediaBackfillError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/media/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: toOptionalNumber(mediaBackfillLimit) ?? 150
        })
      });
      if (!response.ok) throw new Error(`Media backfill failed with status ${response.status}`);
      const result = (await response.json()) as MediaBackfillResponse;
      setMediaBackfillResult(result);
      await Promise.all([refreshDashboard(), applyFilters()]);
      if (selectedListing) {
        await openListing(selectedListing.id);
      }
    } catch (error) {
      setMediaBackfillError(error instanceof Error ? error.message : "Media backfill failed.");
    } finally {
      setIsBackfillingMedia(false);
    }
  }

  async function retryFailedNieruchomosciOnlineQueue() {
    setIsRetryingFailedNieruchomosciOnlineQueue(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/nieruchomosci-online/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Nieruchomosci-online retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedNieruchomosciOnlineQueue(false);
    }
  }

  async function retryFailedDomiportaQueue() {
    setIsRetryingFailedDomiportaQueue(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/domiporta/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Domiporta retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedDomiportaQueue(false);
    }
  }

  async function retryFailedMaxonQueue() {
    setIsRetryingFailedMaxonQueue(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/maxon/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 })
      });
      if (!response.ok) throw new Error(`Maxon retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedMaxonQueue(false);
    }
  }

  async function retryFailedAdresowoQueue() {
    setIsRetryingFailedAdresowoQueue(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/adresowo/retry-failed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 2000 }) });
      if (!response.ok) throw new Error(`Adresowo retry-failed failed with status ${response.status}`);
    } finally { setIsRetryingFailedAdresowoQueue(false); }
  }

  async function retryFailedMorizonQueue() {
    setIsRetryingFailedMorizonQueue(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/collectors/morizon/retry-failed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 2000 }) });
      if (!response.ok) throw new Error(`Morizon retry-failed failed with status ${response.status}`);
    } finally { setIsRetryingFailedMorizonQueue(false); }
  }

  async function retryAllFailedQueues() {
    setQueueError(null);
    try {
      await Promise.all([
        retryFailedQueue(),
        retryFailedGratkaQueue(),
        retryFailedOlxQueue(),
        retryFailedNieruchomosciOnlineQueue(),
        retryFailedDomiportaQueue(),
        retryFailedMaxonQueue(),
        retryFailedAdresowoQueue(),
        retryFailedMorizonQueue()
      ]);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Nie udało się ponowić błędów kolejek.");
    }
  }

  async function resetProcessingNieruchomosciOnlineQueue() {
    const response = await fetch(`${apiBaseUrl}/api/collectors/nieruchomosci-online/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 })
    });
    if (!response.ok) throw new Error(`Nieruchomosci-online reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingDomiportaQueue() {
    const response = await fetch(`${apiBaseUrl}/api/collectors/domiporta/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 })
    });
    if (!response.ok) throw new Error(`Domiporta reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingMaxonQueue() {
    const response = await fetch(`${apiBaseUrl}/api/collectors/maxon/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 })
    });
    if (!response.ok) throw new Error(`Maxon reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingAdresowoQueue() {
    const response = await fetch(`${apiBaseUrl}/api/collectors/adresowo/reset-processing`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 2000 })
    });
    if (!response.ok) throw new Error(`Adresowo reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingMorizonQueue() {
    const response = await fetch(`${apiBaseUrl}/api/collectors/morizon/reset-processing`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 2000 })
    });
    if (!response.ok) throw new Error(`Morizon reset-processing failed with status ${response.status}`);
  }

  async function resetAllProcessingQueues() {
    processAllAbortRef.current?.abort();
    setIsResettingProcessingQueue(true);
    setQueueError(null);
    try {
      await Promise.all([
        resetProcessingQueue(),
        resetProcessingGratkaQueue(),
        resetProcessingOlxQueue(),
        resetProcessingNieruchomosciOnlineQueue(),
        resetProcessingDomiportaQueue(),
        resetProcessingMaxonQueue(),
        resetProcessingAdresowoQueue(),
        resetProcessingMorizonQueue()
      ]);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Nie udało się zresetować przetwarzania.");
    } finally {
      setIsResettingProcessingQueue(false);
    }
  }

  async function runDuplicateAutoMerge() {
    setIsRunningDuplicateAutoMerge(true);
    setDuplicateAutoMergeError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/duplicates/auto-merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10_000 })
      });
      if (!response.ok) throw new Error(`Duplicate check failed with status ${response.status}`);
      setDuplicateAutoMergeResult((await response.json()) as DuplicateAutoMergeResult);
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setDuplicateAutoMergeError(error instanceof Error ? error.message : "Duplicate check failed.");
    } finally {
      setIsRunningDuplicateAutoMerge(false);
    }
  }

  async function runRelistingScan() {
    setIsScanningRelistedListings(true);
    setRelistingScanError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/relistings/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 })
      });
      if (!response.ok) throw new Error(`Relisting scan failed with status ${response.status}`);
      setRelistingScanResult((await response.json()) as RelistedListingsScanResponse);
    } catch (error) {
      setRelistingScanError(error instanceof Error ? error.message : "Nie udało się sprawdzić ponownie dodanych ofert.");
    } finally {
      setIsScanningRelistedListings(false);
    }
  }

  async function runListingMediaBackfill(listingId: string) {
    setIsBackfillingListingMedia(listingId);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listingId}/media/backfill`, {
        method: "POST"
      });
      if (!response.ok) throw new Error(`Listing media backfill failed with status ${response.status}`);
      await response.json();
      await Promise.all([refreshDashboard(), applyFilters(), openListing(listingId)]);
    } catch (error) {
      setMediaBackfillError(error instanceof Error ? error.message : "Listing media backfill failed.");
    } finally {
      setIsBackfillingListingMedia(null);
    }
  }

  async function refreshListingFromSource(listing: Pick<ListingDetail, "id" | "canonicalUrl" | "sourceLabel">) {
    if (!listing.canonicalUrl) {
      setCollectError("Oferta nie ma zapisanego URL-a źródłowego.");
      return;
    }

    setIsRefreshingListingData(listing.id);
    setCollectError(null);
    try {
      const refreshedAt = new Date();
      const endpoint = resolveCollectorEndpoint(listing.canonicalUrl);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: listing.canonicalUrl,
          ...(isGratkaUrl(listing.canonicalUrl) ? { refreshMode: "price_only" } : {})
        })
      });
      if (!response.ok) throw new Error(`Listing refresh failed with status ${response.status}`);
      const result = (await response.json()) as CollectorRunResponse;
      setListingRefreshConfirmation({ listingId: listing.id, refreshedAt, action: result.action });
      await Promise.all([refreshDashboard(), applyFilters(filters, currentListingsPage, listingSort), openListing(listing.id)]);
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : "Listing refresh failed.");
    } finally {
      setIsRefreshingListingData(null);
    }
  }

  async function reviewDuplicatePair(pair: DuplicateCandidate, status: "same_listing" | "different_listing") {
    setIsReviewingDuplicatePair(pair.pairKey);
    try {
      const response = await fetch(`${apiBaseUrl}/api/duplicates/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftId: pair.left.id,
          rightId: pair.right.id,
          primaryListingId: selectedListing?.id,
          status
        })
      });

      if (!response.ok || !selectedListing) {
        return;
      }

      await openListing(selectedListing.id);
      await refreshDashboard();
      await applyFilters(filters, currentListingsPage, listingSort);
    } finally {
      setIsReviewingDuplicatePair(null);
    }
  }
}

function StatsControls(input: {
  period: 30 | 90 | 180;
  draft: MarketStatsFilters;
  onPeriodChange: (period: 30 | 90 | 180) => void;
  onDraftChange: (filters: MarketStatsFilters) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const activeFilterCount = [input.draft.minYear, input.draft.minArea, input.draft.maxArea, input.draft.elevator, input.draft.garage].filter(Boolean).length;

  return <section className="stats-controls panel">
    <div className="stats-controls-heading">
      <span className="stats-controls-icon"><SlidersHorizontal size={19} aria-hidden="true" /></span>
      <div><p className="eyebrow">Zakres danych</p><h2>Ustaw analizowany rynek</h2><small>Okres zmienia wszystkie wskaźniki, nie tylko wykres.</small></div>
      <div className="stats-period-bar" aria-label="Zakres analizy">
        {([30, 90, 180] as const).map((days) => <button type="button" key={days} className={input.period === days ? "is-active" : ""} onClick={() => input.onPeriodChange(days)}>{days} dni</button>)}
      </div>
    </div>
    <div className="stats-filter-grid">
      <label className="stats-filter-field"><span>Rok budowy od</span><input type="number" min="1800" max="2100" placeholder="np. 2000" value={input.draft.minYear} onChange={(event) => input.onDraftChange({ ...input.draft, minYear: event.target.value })} /></label>
      <label className="stats-filter-field"><span>Metraż od</span><div><input type="number" min="1" step="1" placeholder="np. 60" value={input.draft.minArea} onChange={(event) => input.onDraftChange({ ...input.draft, minArea: event.target.value })} /><small>m²</small></div></label>
      <label className="stats-filter-field"><span>Metraż do</span><div><input type="number" min="1" step="1" placeholder="np. 100" value={input.draft.maxArea} onChange={(event) => input.onDraftChange({ ...input.draft, maxArea: event.target.value })} /><small>m²</small></div></label>
      <div className="stats-filter-toggles" aria-label="Udogodnienia">
        <label className={input.draft.elevator ? "is-active" : ""}><input type="checkbox" checked={input.draft.elevator} onChange={(event) => input.onDraftChange({ ...input.draft, elevator: event.target.checked })} /><span>Winda</span></label>
        <label className={input.draft.garage ? "is-active" : ""}><input type="checkbox" checked={input.draft.garage} onChange={(event) => input.onDraftChange({ ...input.draft, garage: event.target.checked })} /><span>Garaż / miejsce</span></label>
      </div>
      <div className="stats-filter-actions">
        <button type="button" className="stats-filter-clear" onClick={input.onClear} disabled={activeFilterCount === 0}>Wyczyść</button>
        <button type="button" className="stats-filter-submit" onClick={input.onApply}>Pokaż wyniki{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}</button>
      </div>
    </div>
  </section>;
}

function MarketStatsPanel({ stats, loading, baseline }: { stats: MarketStatsResponse | null; loading: boolean; filters: MarketStatsFilters; baseline: MarketStatsResponse | null; onFiltersChange: (filters: MarketStatsFilters) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<"active" | "price" | "archive" | "drops">("active");
  if (loading || !stats) return <section className="panel stats-loading" aria-busy="true" aria-live="polite">
    <div className="stats-loading-copy"><span className="stats-loading-icon"><LoaderCircle className="icon-spin" size={24} aria-hidden="true" /></span><div><p className="eyebrow">Statystyki rynku</p><h2>Liczymy obraz rynku</h2><p className="muted">Porównujemy ceny, przepływ ofert i segmenty mieszkań dla wybranego okresu.</p></div></div>
    <div className="stats-loading-progress"><i /><span>Agregowanie ofert i dzielnic…</span></div>
    <div className="stats-loading-kpis" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index}><i /><b /><small /></div>)}</div>
    <div className="stats-loading-body" aria-hidden="true"><div /><div /></div>
  </section>;

  const names = ["Bemowo", "Białołęka", "Bielany", "Mokotów", "Ochota", "Praga-Północ", "Praga-Południe", "Rembertów", "Śródmieście", "Targówek", "Ursus", "Ursynów", "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz", "Bez dzielnicy"];
  const norm = (value: string) => normalizeListingText(value).replace(/[^a-z]/g, "");
  const aggregateDistricts = (input: MarketStatsResponse | null) => names.map((name) => {
    const matching = input?.districts.filter((district) => norm(district.district) === norm(name)) ?? [];
    const neighborhoods = new Map<string, { neighborhood: string; active: number; weightedPrice: number; priced: number }>();
    let active = 0;
    let archived = 0;
    let weightedPrice = 0;
    let priced = 0;
    let weightedArea = 0;
    let areaPriced = 0;
    let weightedMedianPrice = 0;
    let medianPriced = 0;
    let priceDrops = 0;
    let priceIncreases = 0;
    let newLast7Days = 0;
    let newInPeriod = 0;
    let archivedInPeriod = 0;
    let weightedDaysOnMarket = 0;
    let daysOnMarketCount = 0;

    for (const district of matching) {
      active += district.active;
      archived += district.archived;
      priceDrops += district.priceDrops;
      priceIncreases += district.priceIncreases;
      newLast7Days += district.newLast7Days;
      newInPeriod += district.newInPeriod;
      archivedInPeriod += district.archivedInPeriod;
      if (district.medianPricePerSqm > 0 && district.pricedListings > 0) {
        weightedMedianPrice += district.medianPricePerSqm * district.pricedListings;
        medianPriced += district.pricedListings;
      }
      if (district.medianDaysOnMarket !== null && district.archivedInPeriod > 0) {
        weightedDaysOnMarket += district.medianDaysOnMarket * district.archivedInPeriod;
        daysOnMarketCount += district.archivedInPeriod;
      }
      if (district.averagePricePerSqm > 0 && district.active > 0) {
        weightedPrice += district.averagePricePerSqm * district.active;
        priced += district.active;
      }
      if (district.averageArea > 0 && district.active > 0) {
        weightedArea += district.averageArea * district.active;
        areaPriced += district.active;
      }
      for (const neighborhood of district.neighborhoods ?? []) {
        const key = norm(neighborhood.neighborhood || "Nieustalona");
        const current = neighborhoods.get(key) ?? { neighborhood: neighborhood.neighborhood || "Nieustalona", active: 0, weightedPrice: 0, priced: 0 };
        current.active += neighborhood.active;
        if (neighborhood.averagePricePerSqm > 0 && neighborhood.active > 0) {
          current.weightedPrice += neighborhood.averagePricePerSqm * neighborhood.active;
          current.priced += neighborhood.active;
        }
        neighborhoods.set(key, current);
      }
    }

    return {
      district: name,
      active,
      archived,
      averagePricePerSqm: priced ? weightedPrice / priced : 0,
      medianPricePerSqm: medianPriced ? weightedMedianPrice / medianPriced : 0,
      pricedListings: medianPriced,
      averageArea: areaPriced ? weightedArea / areaPriced : 0,
      archiveRate: active + archived ? Math.round(archived / (active + archived) * 100) : 0,
      priceDrops,
      priceIncreases,
      newLast7Days,
      newInPeriod,
      archivedInPeriod,
      medianDaysOnMarket: daysOnMarketCount ? Math.round(weightedDaysOnMarket / daysOnMarketCount) : null,
      neighborhoods: [...neighborhoods.values()]
        .map((neighborhood) => ({ ...neighborhood, averagePricePerSqm: neighborhood.priced ? neighborhood.weightedPrice / neighborhood.priced : 0 }))
        .sort((left, right) => right.active - left.active || left.neighborhood.localeCompare(right.neighborhood, "pl"))
    };
  });
  const rows = aggregateDistricts(stats);
  const baselineRows = aggregateDistricts(baseline);
  const sorted = [...rows].sort((left, right) => sort === "price"
    ? right.medianPricePerSqm - left.medianPricePerSqm
    : sort === "archive"
      ? right.archivedInPeriod - left.archivedInPeriod
      : sort === "drops"
        ? right.priceDrops - left.priceDrops
        : right.active - left.active);
  const formatPrice = (value: number) => value > 0 ? `${Math.round(value).toLocaleString("pl-PL")} zł/m²` : "Brak danych";
  const formatDelta = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(Math.round(value)).toLocaleString("pl-PL")} zł/m²`;
  const deltaClass = (value: number) => value > 0 ? "is-positive" : value < 0 ? "is-negative" : "is-neutral";
  const offerPercent = (count: number, active: number) => active > 0 ? Math.round(count / active * 100) : 0;
  const formatPercentDelta = (value: number | null) => value === null ? "brak porównania" : `${value > 0 ? "+" : ""}${value.toLocaleString("pl-PL")}%`;
  const toggleSelected = (name: string) => setSelected((current) => current === name ? null : name);
  const sortOptions: Array<{ key: typeof sort; label: string }> = [
    { key: "active", label: "Liczba ofert" },
    { key: "price", label: "Cena za m²" },
    { key: "archive", label: "Archiwizacje" },
    { key: "drops", label: "Obniżki" }
  ];

  return (
    <section className="stats-panel">
      <div className="section-topline"><div><p className="eyebrow">Rynek warszawski · ostatnie {stats.periodDays} dni</p><h2>Co dzieje się teraz na rynku</h2><p className="muted">Bieżący okres porównujemy z bezpośrednio poprzednimi {stats.periodDays} dniami. Ceny dzielnic pokazujemy jako medianę, odporną na pojedyncze skrajne oferty.</p></div></div>
      <div className="stats-kpi-grid stats-kpi-grid-insight">
        <div className="stats-kpi"><span>Aktywne teraz</span><strong>{stats.totals.active.toLocaleString("pl-PL")}</strong><small>bez ukrytych duplikatów</small></div>
        <div className="stats-kpi"><span>Mediana aktywnych</span><strong>{Math.round(stats.totals.medianPricePerSqm).toLocaleString("pl-PL")} zł/m²</strong><small>zamiast podatnej na skrajności średniej</small></div>
        <div className="stats-kpi"><span>Nowo wykryte</span><strong>{stats.comparison.newListings.toLocaleString("pl-PL")}</strong><small className={deltaClass(stats.comparison.newListingsChangePercent ?? 0)}>{formatPercentDelta(stats.comparison.newListingsChangePercent)} vs poprzedni okres</small></div>
        <div className="stats-kpi"><span>Zniknęły z portali</span><strong>{stats.comparison.archivedListings.toLocaleString("pl-PL")}</strong><small className={deltaClass(stats.comparison.archivedListingsChangePercent ?? 0)}>{formatPercentDelta(stats.comparison.archivedListingsChangePercent)} vs poprzedni okres</small></div>
        <div className="stats-kpi"><span>Mediana nowych</span><strong>{stats.comparison.medianNewPricePerSqm ? `${Math.round(stats.comparison.medianNewPricePerSqm).toLocaleString("pl-PL")} zł/m²` : "—"}</strong><small className={deltaClass(stats.comparison.medianPriceChangePercent ?? 0)}>{formatPercentDelta(stats.comparison.medianPriceChangePercent)} vs poprzedni okres</small></div>
        <div className="stats-kpi"><span>Czas ekspozycji</span><strong>{stats.comparison.medianDaysOnMarket === null ? "—" : `${stats.comparison.medianDaysOnMarket} dni`}</strong><small>mediana ofert zarchiwizowanych w okresie</small></div>
      </div>
      <div className="stats-signal-strip"><div><strong>{stats.comparison.priceDrops.toLocaleString("pl-PL")}</strong><span>aktywnych ofert miało obniżkę</span></div><div><strong>{stats.comparison.priceDropSharePercent.toLocaleString("pl-PL")}%</strong><span>aktywnych ofert przeceniono w okresie</span></div><div><strong>{stats.comparison.newListings - stats.comparison.archivedListings >= 0 ? "+" : ""}{(stats.comparison.newListings - stats.comparison.archivedListings).toLocaleString("pl-PL")}</strong><span>bilans nowych i archiwizowanych</span></div></div>
      <div className="stats-layout">
        <div className="panel stats-map">
          <StatsDistrictMap stats={stats} selected={selected} onSelect={toggleSelected} />
        </div>
        <div className="panel stats-table">
          <div className="stats-table-header">
            <div><p className="eyebrow">Ranking lokalizacji</p><h3>Dzielnice</h3><span>{rows.filter((row) => row.active > 0).length} dzielnic · mediana i przepływ dla {stats.periodDays} dni</span></div>
            <div className="stats-sort-buttons" aria-label="Sortowanie dzielnic">{sortOptions.map((option) => <button type="button" key={option.key} className={sort === option.key ? "is-active" : ""} onClick={() => setSort(option.key)}>{option.label}</button>)}</div>
          </div>
          <div className="stats-table-scroll">
            <table>
              <thead><tr><th>Dzielnica</th><th>Aktywne teraz</th><th>Mediana zł/m²</th><th className="stats-col-secondary">Wykryte / zniknęły</th><th className="stats-col-secondary">Obniżki</th><th className="stats-col-secondary">Mediana dni</th></tr></thead>
              <tbody>{sorted.map((district, index) => {
                const expanded = selected === district.district;
                const baselineDistrict = baselineRows.find((row) => row.district === district.district);
                const districtDelta = district.medianPricePerSqm - (baselineDistrict?.medianPricePerSqm ?? district.medianPricePerSqm);
                return <Fragment key={district.district}>
                  <tr
                    className={expanded ? "district-stats-row is-selected" : "district-stats-row"}
                    onClick={() => toggleSelected(district.district)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSelected(district.district); } }}
                    tabIndex={0}
                    aria-expanded={expanded}
                  >
                    <td><div className="district-name-cell"><span className="district-rank">{index + 1}</span><div><strong>{district.district}</strong><small>{district.neighborhoods.length} poddzielnic</small></div><ChevronRight className="district-expand-icon" size={18} aria-hidden="true" /></div></td>
                    <td data-label="Aktywne teraz" className="stats-mobile-active"><span className="stats-count-pill">{district.active.toLocaleString("pl-PL")}</span></td>
                    <td data-label="Mediana ceny za m²" className="stats-mobile-price"><strong className="stats-price-value">{formatPrice(district.medianPricePerSqm)}</strong>{baseline ? <small className={`stats-row-delta ${deltaClass(districtDelta)}`}>{formatDelta(districtDelta)}</small> : null}<small>{district.pricedListings} ofert z ceną</small></td>
                    <td data-label={`Ruch ofert · ${stats.periodDays} dni`} className="stats-col-secondary stats-mobile-flow"><span className="stats-flow-pair"><b>+{district.newInPeriod} wykrytych</b><b>−{district.archivedInPeriod} zniknęło</b></span></td>
                    <td data-label={`Obniżki · ${stats.periodDays} dni`} className="stats-col-secondary stats-mobile-drops"><span className="change-pill is-drop">↓ {district.priceDrops}</span><small>{offerPercent(district.priceDrops, district.active)}% ofert</small></td>
                    <td data-label="Mediana ekspozycji" className="stats-mobile-days"><strong>{district.medianDaysOnMarket === null ? "—" : `${district.medianDaysOnMarket} dni`}</strong></td>
                  </tr>
                  {expanded ? <tr className="neighborhood-expansion-row"><td colSpan={6}>
                    <div className="neighborhood-expansion">
                      <div className="neighborhood-expansion-heading"><div><p className="eyebrow">Poddzielnice · {district.district}</p><h4>Dokładniejszy obraz lokalnego rynku</h4></div><p>Różnica ceny jest liczona względem tej samej poddzielnicy bez żadnych filtrów.</p></div>
                      {district.neighborhoods.length ? <div className="neighborhood-grid">{district.neighborhoods.map((neighborhood) => {
                        const baselineNeighborhood = baselineDistrict?.neighborhoods.find((item) => norm(item.neighborhood) === norm(neighborhood.neighborhood));
                        const hasBaseline = Boolean(baselineNeighborhood?.averagePricePerSqm);
                        const delta = hasBaseline ? neighborhood.averagePricePerSqm - (baselineNeighborhood?.averagePricePerSqm ?? 0) : 0;
                        return <article className="neighborhood-stat-card" key={norm(neighborhood.neighborhood)}>
                          <div className="neighborhood-card-top"><strong>{neighborhood.neighborhood}</strong><span>{neighborhood.active.toLocaleString("pl-PL")} ofert</span></div>
                          <div className="neighborhood-card-price"><b>{formatPrice(neighborhood.averagePricePerSqm)}</b>{baseline && hasBaseline ? <span className={deltaClass(delta)}>({formatDelta(delta)})</span> : <span className="is-neutral">brak punktu odniesienia</span>}</div>
                        </article>;
                      })}</div> : <div className="neighborhood-empty"><strong>Brak poddzielnic do pokazania</strong><span>Nowy estymator uzupełni je przy kolejnym zapisie lub migracji danych.</span></div>}
                    </div>
                  </td></tr> : null}
                </Fragment>;
              })}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="stats-analysis-grid">
        <Suspense fallback={<div className="panel">Ładowanie wykresu…</div>}><MarketActivityChart stats={stats} /></Suspense>
        <div className="panel stats-distribution"><div className="stats-card-heading"><div><p className="eyebrow">Poziom cen · {stats.periodDays} dni</p><h3>Wykryte oferty według zł/m²</h3></div><span>{stats.priceDistribution.reduce((sum, band) => sum + band.count, 0).toLocaleString("pl-PL")} z ceną</span></div><div className="price-distribution-list">{stats.priceDistribution.map((band) => <div className="price-distribution-row" key={band.label}><div><span>{band.label}</span><strong>{band.count.toLocaleString("pl-PL")} · {band.sharePercent.toLocaleString("pl-PL")}%</strong></div><i><b style={{ width: `${band.sharePercent}%` }} /></i></div>)}</div></div>
      </div>
      <div className="stats-segments-grid">
        {[
          { title: "Liczba pokoi", items: stats.segments.rooms },
          { title: "Metraż", items: stats.segments.areas },
          { title: "Rok budowy", items: stats.segments.buildingAge },
          { title: "Rynek", items: stats.segments.marketTypes },
          { title: "Źródła ofert", items: stats.segments.sources }
        ].map((segment) => <div className="panel stats-segment-card" key={segment.title}><div className="stats-card-heading"><div><p className="eyebrow">Struktura wykrytych · {stats.periodDays} dni</p><h3>{segment.title}</h3></div></div><div className="stats-segment-list">{segment.items.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.sharePercent}%` }} /></i><strong>{item.count.toLocaleString("pl-PL")} <small>{item.sharePercent.toLocaleString("pl-PL")}%</small></strong></div>)}</div></div>)}
      </div>
    </section>
  );
}

function MortgageQuickPreview({ listing }: { listing: ListingDetail }) {
  const total = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0;
  const principal = Math.max(0, total - 400_000);
  const payment = calculateMortgage(principal, 5.8, 360, 0).basePayment;
  return total > 400_000 ? <div className="mortgage-quick-preview"><Calculator size={18} aria-hidden="true" /><span>Rata od</span><strong>{formatPln(payment)} / mies.</strong><small>400 tys. wkładu · 5,8% · 360 rat</small></div> : null;
}

function MortgageCalculator({ draft, onBackToListing }: { draft: MortgageDraft; onBackToListing: () => void }) {
  const [propertyTotal, setPropertyTotal] = useState(draft.propertyTotal || 1_200_000);
  const [downPayment, setDownPayment] = useState(Math.min(DEFAULT_DOWN_PAYMENT, draft.propertyTotal || 1_200_000));
  const [rate, setRate] = useState(5.8);
  const [months, setMonths] = useState(360);
  const [monthlyTarget, setMonthlyTarget] = useState(8500);
  const [oneOffAmount, setOneOffAmount] = useState(0);
  const [oneOffMonth, setOneOffMonth] = useState(1);
  const [strategy, setStrategy] = useState<"shorten" | "lower_payment">("lower_payment");
  const [rateChangeMonth, setRateChangeMonth] = useState(13);
  const [rateAfterChange, setRateAfterChange] = useState(4.8);
  const [rateChangeEnabled, setRateChangeEnabled] = useState(false);
  const [rateTransitionMonths, setRateTransitionMonths] = useState(12);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [showBaselineSchedule, setShowBaselineSchedule] = useState(false);
  const [insurancePresetKey, setInsurancePresetKey] = useState<MortgageInsurancePreset["key"]>("ing_basic");
  const [includeLifeInsurance, setIncludeLifeInsurance] = useState(true);
  const [includePropertyInsurance, setIncludePropertyInsurance] = useState(true);
  const [marketType, setMarketType] = useState<"primary" | "secondary">("secondary");
  const [firstHomeExemption, setFirstHomeExemption] = useState(false);
  const [customCommission, setCustomCommission] = useState(0);
  const [customValuation, setCustomValuation] = useState(500);
  const [customLifeRate, setCustomLifeRate] = useState(0.035);
  const [customPropertyRate, setCustomPropertyRate] = useState(0.01);
  const [monthlyAccountFee, setMonthlyAccountFee] = useState(0);

  useEffect(() => {
    if (draft.propertyTotal > 0) {
      setPropertyTotal(draft.propertyTotal);
      setDownPayment(Math.min(DEFAULT_DOWN_PAYMENT, draft.propertyTotal));
    }
  }, [draft.propertyTotal]);

  const principal = Math.max(0, propertyTotal - downPayment);
  const rateChange = rateChangeEnabled ? { month: rateChangeMonth, rate: rateAfterChange, transitionMonths: rateTransitionMonths } : undefined;
  const base = calculateMortgage(principal, rate, months, 0, 0, 1, "shorten", rateChange);
  const monthlyExtra = Math.max(0, monthlyTarget - base.basePayment);
  const modified = calculateMortgage(principal, rate, months, monthlyExtra, oneOffAmount, oneOffMonth, strategy, rateChange);
  const chartPoints = modified.rows.filter((row) => row.month === 1 || row.month % 12 === 0 || row.balance === 0);
  const customPreset: MortgageInsurancePreset = { key: "custom", label: "Własny bank", description: "Własne parametry",
    commissionRate: customCommission / 100, valuationFee: customValuation,
    lifeMonthlyRate: customLifeRate / 100, propertyMonthlyRate: customPropertyRate / 100 };
  const insurancePreset = insurancePresetKey === "custom" ? customPreset : mortgageInsurancePresets.find((preset) => preset.key === insurancePresetKey)!;
  const bankCosts = calculateBankCosts({ principal, rows: modified.rows, preset: insurancePreset, includeLife: includeLifeInsurance, includeProperty: includePropertyInsurance });
  const purchaseCosts = calculatePurchaseCosts({ propertyPrice: propertyTotal, marketType, firstHomeExemption });
  const cashAtStart = Math.min(downPayment, propertyTotal) + purchaseCosts.total + bankCosts.oneOff;
  const accountCosts = principal > 0 ? monthlyAccountFee * modified.rows.length : 0;
  const additionalCosts = purchaseCosts.total + bankCosts.oneOff + bankCosts.insuranceTotal + accountCosts;
  const bankComparisons = mortgageInsurancePresets.map((preset) => {
    const selected = preset.key === "custom" ? customPreset : preset;
    const costs = calculateBankCosts({ principal, rows: modified.rows, preset: selected, includeLife: includeLifeInsurance, includeProperty: includePropertyInsurance });
    return { key: preset.key, label: preset.label, first: base.basePayment + costs.firstInsuranceMonthly + (principal > 0 ? monthlyAccountFee : 0), upfront: costs.oneOff, total: modified.interest + costs.oneOff + costs.insuranceTotal + accountCosts };
  }).sort((a, b) => a.total - b.total);
  const rateScenarios = [-2, -1, 0, 1, 2].map((delta) => {
    const scenarioRate = Math.max(0, rate + delta);
    const loan = calculateMortgage(principal, scenarioRate, months, 0, 0, 1, "shorten");
    return { delta, rate: scenarioRate, payment: loan.basePayment, interest: loan.interest };
  });

  return <section className="mortgage-page">
    <div className="panel mortgage-header"><div><p className="eyebrow">Finansowanie</p><h2>Kalkulator kredytowy</h2><p className="muted">Raty równe. Wybierz skrócenie okresu lub obniżenie raty i uwzględnij koszty wybranego scenariusza banku.</p>{draft.listingTitle ? <p className="mortgage-source">Z oferty: {draft.listingTitle}</p> : null}</div></div>
    {draft.listingTitle ? <button className="action-button secondary-button mortgage-back-button" type="button" onClick={onBackToListing}>Wróć do oferty: {draft.listingTitle}</button> : null}
    <section className="mortgage-explainer" aria-label="Jak czytać kalkulator">
      <article><span>1</span><div><strong>Ustal finansowanie</strong><small>Cena całkowita minus wkład własny daje kwotę kredytu.</small></div></article>
      <article><span>2</span><div><strong>Podaj budżet miesięczny</strong><small>Nadwyżka ponad pierwszą ratę ustala stałą nadpłatę. Po zmianie stopy lub raty łączna wpłata może się zmienić.</small></div></article>
      <article><span>3</span><div><strong>Porównaj scenariusze</strong><small>Zobacz koszt odsetek, zmianę raty i moment całkowitej spłaty.</small></div></article>
    </section>
    <section className="panel mortgage-full-costs">
      <div className="section-topline mortgage-full-costs-heading"><div><p className="eyebrow">Pełny koszt transakcji</p><h3>Bank, notariusz i opłaty urzędowe</h3><p className="muted">Zapisane profile banków to przykładowe założenia, nie bieżące oferty. Własne parametry przepisz z oferty banku.</p></div><span className="costs-reference-badge">Założenia symulacji</span></div>
      <div className="mortgage-cost-options">
        <label className="detail-field"><span>Scenariusz banku</span><select className="text-input" value={insurancePresetKey} onChange={(event) => setInsurancePresetKey(event.target.value as MortgageInsurancePreset["key"])}>{mortgageInsurancePresets.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select><small>{insurancePreset.description}</small></label>
        <label className="detail-field"><span>Rynek</span><select className="text-input" value={marketType} onChange={(event) => setMarketType(event.target.value as "primary" | "secondary")}><option value="secondary">Wtórny</option><option value="primary">Pierwotny</option></select><small>PCC 2% dotyczy zasadniczo rynku wtórnego.</small></label>
        <div className="mortgage-cost-toggles">
          <label className={includeLifeInsurance ? "is-active" : ""}><input type="checkbox" checked={includeLifeInsurance} onChange={(event) => setIncludeLifeInsurance(event.target.checked)} /> Polisa na życie</label>
          <label className={includePropertyInsurance ? "is-active" : ""}><input type="checkbox" checked={includePropertyInsurance} onChange={(event) => setIncludePropertyInsurance(event.target.checked)} /> Ubezpieczenie lokalu</label>
          <label className={firstHomeExemption ? "is-active" : ""}><input type="checkbox" checked={firstHomeExemption} onChange={(event) => setFirstHomeExemption(event.target.checked)} disabled={marketType === "primary"} /> Pierwsze mieszkanie — zwolnienie PCC</label>
        </div>
      </div>
      {insurancePresetKey === "custom" ? <div className="mortgage-custom-fields">
        <MortgageInput label="Prowizja banku (%)" value={customCommission} onChange={setCustomCommission} />
        <MortgageInput label="Wycena (zł)" value={customValuation} onChange={setCustomValuation} />
        <MortgageInput label="Życie (% salda / miesiąc)" value={customLifeRate} onChange={setCustomLifeRate} />
        <MortgageInput label="Lokal (% kredytu / miesiąc)" value={customPropertyRate} onChange={setCustomPropertyRate} />
      </div> : null}
      <MortgageInput label="Konto i karta / miesiąc (zł, wspólne założenie porównania)" value={monthlyAccountFee} onChange={setMonthlyAccountFee} />
      <div className="mortgage-total-cards">
        <article><span>Rata bankowa</span><strong>{formatPln(base.basePayment)}</strong><small>bez dobrowolnych polis</small></article>
        <article className="is-highlight"><span>Pierwszy miesiąc z polisami i kontem</span><strong>{formatPln(base.basePayment + bankCosts.firstInsuranceMonthly + (principal > 0 ? monthlyAccountFee : 0))}</strong><small>polisy: ok. {formatPln(bankCosts.firstInsuranceMonthly)} / mies.</small></article>
        <article><span>Gotówka potrzebna na start</span><strong>{formatPln(cashAtStart)}</strong><small>wkład {formatPln(Math.min(downPayment, propertyTotal))} + opłaty jednorazowe</small></article>
        <article><span>Dodatkowe koszty łącznie</span><strong>{formatPln(additionalCosts)}</strong><small>formalności, bank i polisy w okresie spłaty</small></article>
      </div>
      <dl className="mortgage-cost-breakdown">
        <div><dt>Notariusz — taksa maks. brutto</dt><dd>{formatPln(purchaseCosts.notaryMaximumGross)}</dd></div>
        <div><dt>Wypisy aktu (założenie: 4 × 10 stron)</dt><dd>{formatPln(purchaseCosts.copiesGross)}</dd></div>
        <div><dt>Wniosek do księgi przez notariusza</dt><dd>{formatPln(purchaseCosts.landRegisterApplicationGross)}</dd></div>
        <div><dt>PCC od zakupu</dt><dd>{purchaseCosts.purchaseTax > 0 ? formatPln(purchaseCosts.purchaseTax) : "0 zł"}</dd></div>
        <div><dt>Wpis własności + odpis KW</dt><dd>{formatPln(purchaseCosts.ownershipEntry + purchaseCosts.landRegisterExtract)}</dd></div>
        <div><dt>Prowizja banku</dt><dd>{formatPln(bankCosts.commission)}</dd></div>
        <div><dt>Konto i karta przez okres spłaty</dt><dd>{formatPln(accountCosts)}</dd></div>
        <div><dt>Wycena bankowa</dt><dd>{formatPln(bankCosts.valuation)}</dd></div>
        <div><dt>Wpis hipoteki + PCC-3</dt><dd>{formatPln(bankCosts.mortgageEntry + bankCosts.mortgageTax)}</dd></div>
        <div><dt>Polisy przez cały okres symulacji</dt><dd>{formatPln(bankCosts.insuranceTotal)}</dd></div>
      </dl>
      <p className="mortgage-cost-disclaimer">To symulacja budżetowa, nie oferta banku ani wycena kancelarii. Bank może doliczyć prowizję, konto lub kartę zgodnie z konkretnym ESIS; kancelaria może ustalić taksę niższą od maksimum.</p>
    </section>
    <section className="panel"><p className="eyebrow">Porównanie scenariuszy banku</p><h3>Ile kosztują dodatki do kredytu</h3><p className="muted">Wspólne oprocentowanie {rate}%, nadpłaty, okres i wybrane polisy. Koszt finansowania = odsetki + bank + polisy + konto; bez kapitału i kosztów zakupu. Brak polis w profilu nie oznacza zwolnienia z wymagań banku.</p>
      <div className="mortgage-table-wrap"><table><thead><tr><th>Scenariusz</th><th>Pierwsza rata + dodatki</th><th>Bank na start</th><th>Koszt finansowania</th><th>Wybór</th></tr></thead><tbody>{bankComparisons.map((scenario) => <tr key={scenario.key} className={scenario.key === insurancePresetKey ? "is-selected" : ""}><td>{scenario.label}</td><td>{formatPln(scenario.first)}</td><td>{formatPln(scenario.upfront)}</td><td>{formatPln(scenario.total)}</td><td><button className="action-button secondary-button" aria-pressed={scenario.key === insurancePresetKey} onClick={() => setInsurancePresetKey(scenario.key)}>{scenario.key === insurancePresetKey ? "Wybrany" : "Wybierz"}</button></td></tr>)}</tbody></table></div>
    </section>
    <section className="panel"><p className="eyebrow">Wrażliwość na oprocentowanie</p><h3>Co zmienia różnica 1–2 punktów procentowych</h3><p className="muted">Osobne scenariusze stałej stopy przez cały okres, bez nadpłat i opłat dodatkowych.</p><div className="rate-scenario-grid">{rateScenarios.map((scenario) => <article className="insight-category" key={scenario.delta}><span>{scenario.delta === 0 ? "Bazowe" : `${scenario.delta > 0 ? "+" : ""}${scenario.delta} p.p.`} · {scenario.rate.toLocaleString("pl-PL")}%</span><strong className="insight-number">{formatPln(scenario.payment)}</strong><small>odsetki łącznie: {formatPln(scenario.interest)}</small></article>)}</div></section>
    <section className="panel mortgage-cost-structure"><h3>Struktura kosztów</h3><div className="mortgage-donuts"><MortgageDonut label="Bez nadpłat" principal={principal} interest={base.interest} extra={0} /><MortgageDonut label="Po nadpłatach" principal={principal} interest={modified.interest} extra={modified.rows.reduce((sum, row) => sum + row.extra, 0)} /></div></section>
    <div className="mortgage-layout">
      <section className="panel mortgage-form"><h3>Podstawowe dane</h3>
        <MortgageInput label="Cena całkowita zakupu" value={propertyTotal} onChange={setPropertyTotal} />
        <MortgageInput label="Wkład własny" value={downPayment} onChange={setDownPayment} />
        <MortgageInput label="Oprocentowanie roczne (%)" value={rate} onChange={setRate} />
        <MortgageInput label="Liczba rat" value={months} onChange={setMonths} integer />
        <MortgageInput label="Rata + miesięczna nadpłata" value={monthlyTarget} onChange={setMonthlyTarget} />
        <hr /><h3>Jednorazowa nadpłata</h3>
        <label className="detail-field"><span>Efekt nadpłaty</span><select className="text-input" value={strategy} onChange={(event) => setStrategy(event.target.value as "shorten" | "lower_payment")}><option value="shorten">Skróć okres kredytu</option><option value="lower_payment">Obniż ratę (nadpłaty mogą skrócić okres)</option></select></label>
        <fieldset className="rate-change-box"><legend><label><input type="checkbox" checked={rateChangeEnabled} onChange={(event) => setRateChangeEnabled(event.target.checked)} /> Symuluj zmianę oprocentowania</label></legend>{rateChangeEnabled ? <><MortgageInput label="Docelowe oprocentowanie (%)" value={rateAfterChange} onChange={setRateAfterChange} /><MortgageInput label="Zmiana od miesiąca" value={rateChangeMonth} onChange={setRateChangeMonth} integer /><MortgageInput label="Okres płynnej zmiany (mies.)" value={rateTransitionMonths} onChange={setRateTransitionMonths} integer /></> : <p className="muted">Np. spadek z 5,8% do 4,8% rozłożony na 12 miesięcy.</p>}</fieldset>
        <MortgageInput label="Kwota" value={oneOffAmount} onChange={setOneOffAmount} />
        <MortgageInput label="Miesiąc" value={oneOffMonth} onChange={setOneOffMonth} integer />
      </section>
      <section className="mortgage-results">
        <div className="mortgage-stat-grid">
          <MortgageStat label="Kredyt" value={formatPln(principal)} /><MortgageStat label="Pierwsza rata" value={formatPln(base.basePayment)} />
          <MortgageStat label="Nadpłata / mies." value={formatPln(Math.max(0, monthlyTarget - base.basePayment))} /><MortgageStat label="Po nadpłatach" value={`${modified.rows.length} rat`} />
        </div>
        <div className="panel"><h3>Kredyt wyjściowy vs po nadpłatach</h3><div className="mortgage-compare"><p><span>Bez nadpłat</span><strong>{formatPln(base.totalPaid)}</strong><small>odsetki: {formatPln(base.interest)}</small></p><p><span>Po nadpłatach</span><strong>{formatPln(modified.totalPaid)}</strong><small>odsetki: {formatPln(modified.interest)}</small></p><p><span>Oszczędność</span><strong>{formatPln(Math.max(0, base.interest - modified.interest))}</strong><small>{Math.max(0, months - modified.rows.length)} rat krócej</small></p></div></div>
        <div className="panel"><h3>Spadek kapitału</h3><svg className="mortgage-chart" viewBox="0 0 600 160" role="img" aria-label="Wykres pozostałego kapitału po nadpłatach"><polyline fill="none" stroke="#1f6f5f" strokeWidth="4" points={chartPoints.map((row, index) => `${(index / Math.max(1, chartPoints.length - 1)) * 580 + 10},${145 - (row.balance / Math.max(1, principal)) * 130}`).join(" ")} /></svg></div>
      </section>
    </div>
    <MortgageSavings base={base} modified={modified} months={months} strategy={strategy} />
    <Suspense fallback={<section className="panel mortgage-chart-loading"><LoaderCircle className="icon-spin" aria-hidden="true" /> Przygotowuję wykresy…</section>}>
      <PremiumMortgageVisuals principal={principal} base={base} modified={modified} />
    </Suspense>
    <section className="panel mortgage-schedule"><div className="section-topline"><div><h3>{showBaselineSchedule ? "Harmonogram bez nadpłat" : "Harmonogram rat po nadpłatach"}</h3><p className="muted">{showBaselineSchedule ? "Bazowy plan spłaty dla porównania." : "Plan po wybranych nadpłatach."}</p></div><label className="check-row"><input type="checkbox" checked={showBaselineSchedule} onChange={(event) => setShowBaselineSchedule(event.target.checked)} /> Pokaż bez nadpłat</label></div><div className="mortgage-table-wrap"><table><thead><tr><th>Nr</th><th>Rata</th><th>Odsetki</th><th>Kapitał</th><th>Nadpłata</th><th>Saldo</th></tr></thead><tbody>{(showAllInstallments ? (showBaselineSchedule ? base.rows : modified.rows) : (showBaselineSchedule ? base.rows : modified.rows).slice(0, 120)).map((row) => <tr key={row.month}><td>{row.month}</td><td>{formatPln(row.payment)}</td><td>{formatPln(row.interest)}</td><td>{formatPln(row.principal)}</td><td>{formatPln(row.extra)}</td><td>{formatPln(row.balance)}</td></tr>)}</tbody></table></div>{(showBaselineSchedule ? base.rows : modified.rows).length > 120 ? <div className="mortgage-schedule-toggle"><p className="muted">{showAllInstallments ? `Pokazano wszystkie ${(showBaselineSchedule ? base.rows : modified.rows).length} rat.` : `Pokazano pierwsze 120 z ${(showBaselineSchedule ? base.rows : modified.rows).length} rat.`}</p><button className="action-button secondary-button" type="button" onClick={() => setShowAllInstallments((current) => !current)}>{showAllInstallments ? "Pokaż skrócony harmonogram" : "Pokaż wszystkie raty"}</button></div> : null}</section>
  </section>;
}

/* Legacy inline visuals kept here for reference; the live charts are lazy-loaded from MortgageVisuals.tsx.
function PremiumMortgageVisuals({ principal, base, modified }: { principal: number; base: ReturnType<typeof calculateMortgage>; modified: ReturnType<typeof calculateMortgage> }) {
  const everyYear = Array.from({ length: Math.max(base.rows.length, modified.rows.length) }, (_, index) => index).filter((index) => index === 0 || index % 12 === 11 || index === modified.rows.length - 1).map((index) => ({ month: index + 1, bazowy: base.rows[index]?.balance ?? 0, poNadplatach: modified.rows[index]?.balance ?? 0, oprocentowanie: modified.rows[index]?.annualRate ?? 0 }));
  const before = [{ name: "Kapitał", value: principal, color: "#2e8472" }, { name: "Odsetki", value: base.interest, color: "#e7a64a" }];
  const after = [{ name: "Kapitał", value: principal, color: "#2e8472" }, { name: "Odsetki", value: modified.interest, color: "#e7a64a" }, { name: "Nadpłaty", value: modified.rows.reduce((sum, row) => sum + row.extra, 0), color: "#637eeb" }];
  return <section className="premium-mortgage-visuals"><article className="panel premium-balance-chart"><div className="chart-heading"><div><p className="eyebrow">Porównanie</p><h3>Jak nadpłaty zmieniają saldo</h3></div><span>{Math.max(0, base.rows.length - modified.rows.length)} rat mniej</span></div><ResponsiveContainer width="100%" height={330}><AreaChart data={everyYear} margin={{ top: 16, right: 18, left: 12, bottom: 4 }}><defs><linearGradient id="mortgageBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e7a64a" stopOpacity={.4}/><stop offset="100%" stopColor="#e7a64a" stopOpacity={.02}/></linearGradient><linearGradient id="mortgageExtra" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2e8472" stopOpacity={.5}/><stop offset="100%" stopColor="#2e8472" stopOpacity={.03}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#dce6e1"/><XAxis dataKey="month" tickFormatter={(value) => `${Math.ceil(value / 12)} r.`}/><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`}/><Tooltip formatter={(value) => formatPln(Number(value))} labelFormatter={(value) => `Miesiąc ${value}`}/><Legend/><Area type="monotone" dataKey="bazowy" name="Bez nadpłat" stroke="#d9902f" fill="url(#mortgageBase)" strokeWidth={3}/><Area type="monotone" dataKey="poNadplatach" name="Po nadpłatach" stroke="#207863" fill="url(#mortgageExtra)" strokeWidth={4}/></AreaChart></ResponsiveContainer></article><article className="panel premium-rate-chart"><div className="chart-heading"><div><p className="eyebrow">Scenariusz stopy</p><h3>Oprocentowanie w czasie</h3></div><span>płynna zmiana</span></div><ResponsiveContainer width="100%" height={330}><LineChart data={everyYear} margin={{ top: 16, right: 18, left: 0, bottom: 4 }}><CartesianGrid vertical={false} stroke="#dce6e1"/><XAxis dataKey="month" tickFormatter={(value) => `${Math.ceil(value / 12)} r.`}/><YAxis domain={["auto", "auto"]} tickFormatter={(value) => `${Number(value).toFixed(1)}%`}/><Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} labelFormatter={(value) => `Miesiąc ${value}`}/><Line type="monotone" dataKey="oprocentowanie" name="Oprocentowanie" stroke="#637eeb" strokeWidth={4} dot={false}/></LineChart></ResponsiveContainer></article><article className="panel premium-cost-chart"><div className="chart-heading"><div><p className="eyebrow">Struktura kosztów</p><h3>Przed i po nadpłatach</h3></div></div><div className="premium-donuts"><CostDonut title="Bez nadpłat" data={before}/><CostDonut title="Po nadpłatach" data={after}/></div></article></section>;
}
function CostDonut({ title, data }: { title: string; data: Array<{ name: string; value: number; color: string }> }) { const total = data.reduce((sum, item) => sum + item.value, 0); return <div className="cost-donut"><h4>{title}</h4><div className="cost-donut-chart"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={3} stroke="none">{data.map((item) => <Cell key={item.name} fill={item.color}/>) }<Label value={formatPln(total)} position="center" fill="#1e3130" fontSize={14} fontWeight={800}/></Pie><Tooltip formatter={(value) => formatPln(Number(value))}/></PieChart></ResponsiveContainer></div><ul>{data.map((item) => <li key={item.name}><i style={{ background: item.color }}/><span>{item.name}</span><strong>{formatPln(item.value)}</strong></li>)}</ul></div>; }

*/
function MortgageSavings({ base, modified, months, strategy }: { base: ReturnType<typeof calculateMortgage>; modified: ReturnType<typeof calculateMortgage>; months: number; strategy: "shorten" | "lower_payment" }) {
  const savedInterest = Math.max(0, base.interest - modified.interest);
  const savedMonths = Math.max(0, months - modified.rows.length);
  const loweredPayment = Math.max(0, base.basePayment - (modified.rows[1]?.payment ?? modified.basePayment));
  return <section className="mortgage-savings"><article><span>Oszczędność na odsetkach</span><strong>{formatPln(savedInterest)}</strong><small>mniej pieniędzy dla banku</small></article><article><span>{strategy === "lower_payment" ? "Rata po pierwszej nadpłacie" : "Krótszy okres"}</span><strong>{strategy === "lower_payment" ? formatPln(modified.rows[1]?.payment ?? modified.basePayment) : `${savedMonths} mies.`}</strong><small>{strategy === "lower_payment" ? `${formatPln(loweredPayment)} mniej niż rata wyjściowa` : "przy stałej racie i nadpłacie"}</small></article><article><span>Łączny koszt po zmianach</span><strong>{formatPln(modified.totalPaid)}</strong><small>kapitał, odsetki i wszystkie nadpłaty</small></article></section>;
}

/* Superseded by the lazy-loaded chart module above.
function MortgageCharts({ principal, base, modified }: { principal: number; base: ReturnType<typeof calculateMortgage>; modified: ReturnType<typeof calculateMortgage> }) {
  const modifiedExtra = modified.rows.reduce((sum, row) => sum + row.extra, 0);
  const costs = [{ name: "Kapitał", value: principal, color: "#1f6f5f" }, { name: "Odsetki", value: base.interest, color: "#d8954c" }];
  const updatedCosts = [{ name: "Kapitał", value: principal, color: "#1f6f5f" }, { name: "Odsetki", value: modified.interest, color: "#d8954c" }, { name: "Nadpłaty", value: modifiedExtra, color: "#5c8dcc" }];
  const months = Array.from({ length: Math.max(base.rows.length, modified.rows.length) }, (_, index) => index).filter((index) => index === 0 || index % 12 === 11 || index === modified.rows.length - 1).map((index) => ({ month: index + 1, bezNadplat: base.rows[index]?.balance ?? 0, poNadplatach: modified.rows[index]?.balance ?? 0 }));
  return <section className="mortgage-visuals"><div className="panel"><h3>Kapitał, odsetki i nadpłaty</h3><div className="mortgage-chart-grid"><div><h4>Bez nadpłat</h4><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={costs} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>{costs.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => formatPln(Number(value))} /><Legend /></PieChart></ResponsiveContainer></div><div><h4>Po nadpłatach</h4><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={updatedCosts} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>{updatedCosts.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => formatPln(Number(value))} /><Legend /></PieChart></ResponsiveContainer></div></div></div><div className="panel"><h3>Saldo kredytu w czasie</h3><ResponsiveContainer width="100%" height={300}><LineChart data={months} margin={{ left: 18, right: 18, top: 14, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tickFormatter={(value) => `${Math.ceil(value / 12)} r.`} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => formatPln(Number(value))} labelFormatter={(value) => `Miesiąc ${value}`} /><Legend /><Line type="monotone" dataKey="bezNadplat" name="Bez nadpłat" stroke="#d8954c" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="poNadplatach" name="Po nadpłatach" stroke="#1f6f5f" strokeWidth={4} dot={false} /></LineChart></ResponsiveContainer></div></section>;
}
*/
function MortgageDonut({ label, principal, interest, extra }: { label: string; principal: number; interest: number; extra: number }) { const total = Math.max(1, principal + interest); const capitalSlice = (principal / total) * 100; return <div className="mortgage-donut-card"><div className="mortgage-donut" style={{ background: `conic-gradient(#1f6f5f 0 ${capitalSlice}%, #d8954c ${capitalSlice}% 100%)` }}><span>{formatPln(total)}</span></div><strong>{label}</strong><small><i className="legend-capital" /> Kapitał: {formatPln(principal)}</small><small><i className="legend-interest" /> Odsetki: {formatPln(interest)}</small>{extra > 0 ? <small>Nadpłaty: {formatPln(extra)}</small> : null}</div>; }
function MortgageInput({ label, value, onChange, integer = false }: { label: string; value: number; onChange: (value: number) => void; integer?: boolean }) { return <label className="detail-field"><span>{label}</span><input className="text-input" inputMode="decimal" value={String(value)} onChange={(event) => onChange(Math.max(0, integer ? Math.round(Number(event.target.value.replace(",", "."))) : Number(event.target.value.replace(",", "."))) || 0)} /></label>; }
function MortgageStat({ label, value }: { label: string; value: string }) { return <div className="mortgage-stat"><span>{label}</span><strong>{value}</strong></div>; }

function ListingSection(input: {
  title: string;
  listings: ListingSummary[];
  onOpen: (listingId: string) => void | Promise<void>;
  onToggleShortlist: (listingId: string, shortlisted: boolean) => void | Promise<void>;
  updatingShortlistId: string | null;
  isLoading: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div><p className="eyebrow">Oferty</p><h2>{input.title}</h2></div>
        <div className="pill">{input.isLoading ? <><LoaderCircle size={14} className="icon-spin" aria-hidden="true" /> Odświeżam oferty</> : `${input.listings.length} rekordow`}</div>
      </div>
      <div className={input.isLoading ? "listing-grid is-loading" : "listing-grid"} aria-busy={input.isLoading}>
        {input.isLoading ? <div className="listing-loading-overlay"><LoaderCircle size={28} className="icon-spin" aria-hidden="true" /><span>Ładowanie wyników…</span></div> : null}
        {input.listings.map((listing) => {
          const commercialBadges = filterCommercialBadges(listing.badges);
          const imageBadges = filterImageBadges(listing.badges);
          const nonCommercialBadges = filterNonCommercialBadges(listing.badges);
          const rcnIndicator = getRcnIndicator(listing.rcnDeltaLabel);

          return (
            <article key={listing.id} className="listing-card clickable-card" onClick={() => void input.onOpen(listing.id)}>
              <button className={listing.isShortlisted ? "favorite-star active" : "favorite-star"} aria-label={listing.isShortlisted ? "Usuń z ulubionych" : "Dodaj do ulubionych"} onClick={(event) => { event.stopPropagation(); void input.onToggleShortlist(listing.id, !listing.isShortlisted); }} disabled={input.updatingShortlistId === listing.id}>
                {listing.isShortlisted ? "★" : "☆"}
              </button>
              {listing.thumbnailUrl ? (
                <div className="listing-thumb-wrap">
                  <div className="listing-chip-stack">
                    {imageBadges.length > 0 ? (
                      <div className="listing-image-badges">
                        {imageBadges.map((badge) => <span key={`${listing.id}-${badge}`} className="listing-image-badge" title={badge === "Brak miejsca postojowego" ? "Oferta nie potwierdza miejsca postojowego dostępnego dla mieszkania." : undefined}>{badge}</span>)}
                      </div>
                    ) : null}
                  </div>
                  {typeof listing.dreamScore === "number" ? (
                    <div className="listing-bottom-left-stack">
                      {typeof listing.dreamScore === "number" ? (
                        <span className="listing-dream-chip" aria-label={`Dopasowanie: ${listing.dreamScore}%`}>
                          <strong>{listing.dreamScore}%</strong>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="listing-status-group">
                    {listing.relisting ? (
                      <span
                        className={`listing-relisting-chip is-${listing.relisting.priceChange}`}
                        title={`Oferta wystawiona ponownie: ${formatOptionalPln(listing.relisting.previousPriceAmount)} → ${formatOptionalPln(listing.relisting.relistedPriceAmount)}`}
                        aria-label={`Oferta wystawiona ponownie; cena ${listing.relisting.priceChange === "higher" ? "wyższa" : listing.relisting.priceChange === "lower" ? "niższa" : "bez zmian"}`}
                      >
                        <RefreshCw size={17} aria-hidden="true" />
                      </span>
                    ) : null}
                    {rcnIndicator ? <span className={`listing-rcn-chip ${rcnIndicator}`} title={listing.rcnDeltaLabel}>RCN</span> : null}
                    {Math.abs(listing.priceChangePercent) > 0 ? (
                      <span className={listing.priceChangePercent < 0 ? "listing-price-update-chip price-down" : "listing-price-update-chip price-up"}>
                        Nowa cena
                      </span>
                    ) : null}
                    <span className={listing.isActive === false ? "listing-status-chip is-inactive" : "listing-status-chip is-active"} aria-label={listing.isActive === false ? "Oferta nieaktywna" : "Oferta aktywna"}>
                      {listing.isActive === false ? "✕" : "✓"}
                    </span>
                  </div>
                  <ListingImageSlide listing={listing} />
                  {listing.sourceLabel ? <span className="listing-source-chip listing-source-chip-footer">{listing.sourceLabel}</span> : null}
                  <SunExposureCompass description={listing.description} compact />
                </div>
              ) : null}
              <div className="listing-card-content">
              <div className="listing-topline"><span>{listing.city}</span><span className={listing.priceChangePercent < 0 ? "badge-drop" : "badge-flat"}>{listing.priceChangePercent}%</span></div>
              <h3><a className="listing-detail-link" href={listingHref(listing.id)} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void input.onOpen(listing.id); }}>{listing.title}</a></h3>
              <p className="listing-location-line">
                {buildListingPrimaryLocation(listing)}
              </p>
              {listing.viewingScheduledAt ? <p className="viewing-line">Oglądanie: {formatViewingDate(listing.viewingScheduledAt)}</p> : null}
              <dl>
                <div className="listing-metric metric-price"><dt>Cena</dt><dd>{listing.priceLabel}</dd></div>
                <div className="listing-metric metric-area"><dt>Metraż</dt><dd>{listing.areaLabel}</dd></div>
                <div className="listing-metric metric-pps"><dt>PLN/m²</dt><dd>{listing.pricePerSqmLabel ?? "-"}</dd></div>
                <div className="listing-metric metric-rooms"><dt>Pokoje</dt><dd>{listing.roomsCount ? String(listing.roomsCount) : "-"}</dd></div>
              </dl>
              <ListingBadgeRow badges={nonCommercialBadges} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ListingImageSlide({ listing }: { listing: ListingSummary }) {
  const imageUrls = listing.imageUrls.length > 0
    ? listing.imageUrls
    : listing.thumbnailUrl ? [listing.thumbnailUrl] : [];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  const [visitedImages, setVisitedImages] = useState<Set<string>>(() => new Set());
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const didSwipeRef = useRef(false);
  const activeImageUrl = imageUrls[activeImageIndex] ?? imageUrls[0];

  useEffect(() => {
    setActiveImageIndex(0);
    setImagesReady(false);
    setVisitedImages(new Set());
  }, [listing.id]);

  if (!activeImageUrl) {
    return null;
  }

  const changeImage = (direction: -1 | 1) => {
    setActiveImageIndex((current) => (current + direction + imageUrls.length) % imageUrls.length);
  };

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || imageUrls.length < 2) {
      return;
    }

    didSwipeRef.current = false;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 36 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      didSwipeRef.current = true;
      event.stopPropagation();
      changeImage(deltaX < 0 ? 1 : -1);
    }
  }

  return (
    <>
      <div
        className="listing-image-track"
        style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { swipeStartRef.current = null; }}
        onClick={(event) => {
          if (didSwipeRef.current) {
            event.stopPropagation();
            didSwipeRef.current = false;
          }
        }}
      >
        {imageUrls.map((imageUrl, index) => (index === activeImageIndex || visitedImages.has(imageUrl) || (imagesReady && (index === (activeImageIndex + 1) % imageUrls.length || index === (activeImageIndex - 1 + imageUrls.length) % imageUrls.length))) ? <img key={imageUrl} className="listing-thumb" src={imageUrl} alt={`${listing.title}, zdjecie ${index + 1}`} loading={imagesReady ? "eager" : "lazy"} decoding="async" onLoad={() => { setImagesReady(true); setVisitedImages(current => current.has(imageUrl) ? current : new Set([...current, imageUrl])); }} /> : <div key={imageUrl} className="listing-thumb" aria-hidden="true" />)}
      </div>
      {imageUrls.length > 1 ? (
        <>
          <button className="listing-image-nav listing-image-prev" type="button" aria-label="Poprzednie zdjecie" onClick={(event) => { event.stopPropagation(); changeImage(-1); }}><ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" /></button>
          <button className="listing-image-nav listing-image-next" type="button" aria-label="Nastepne zdjecie" onClick={(event) => { event.stopPropagation(); changeImage(1); }}><ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" /></button>
          <div className="listing-image-dots" aria-label="Wybierz zdjecie">
            {imageUrls.map((imageUrl, index) => <button key={imageUrl} className={index === activeImageIndex ? "active" : ""} type="button" aria-label={`Zdjecie ${index + 1}`} onClick={(event) => { event.stopPropagation(); setActiveImageIndex(index); }} />)}
          </div>
          <span className="listing-image-counter">{activeImageIndex + 1} / {imageUrls.length}</span>
          {(() => { const total = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0; const payment = calculateMortgage(Math.max(0, total - 400_000), 5.8, 360, 0).basePayment; return total > 400_000 ? <span className="listing-mortgage-chip">Rata: {formatPln(payment)}</span> : null; })()}
        </>
      ) : null}
    </>
  );
}

function SunExposureCompass(input: { description?: string; compact?: boolean }) {
  const exposure = getSunExposure(input.description);
  if (exposure.directions.length === 0 && exposure.sideCount === undefined) return null;

  const positions: Record<ExposureDirection, { left: string; top: string; label: string }> = {
    N: { left: "50%", top: "11%", label: "Północ" }, NE: { left: "76%", top: "24%", label: "Północny wschód" },
    E: { left: "89%", top: "50%", label: "Wschód" }, SE: { left: "76%", top: "76%", label: "Południowy wschód" },
    S: { left: "50%", top: "89%", label: "Południe" }, SW: { left: "24%", top: "76%", label: "Południowy zachód" },
    W: { left: "11%", top: "50%", label: "Zachód" }, NW: { left: "24%", top: "24%", label: "Północny zachód" }
  };
  const sideCountLabel = exposure.sideCount === 2
    ? "mieszkanie dwustronne"
    : exposure.sideCount !== undefined
      ? `okna na ${exposure.sideCount} strony świata`
      : "";
  const label = exposure.directions.length > 0
    ? `Ekspozycja: ${exposure.directions.map((direction) => positions[direction].label.toLowerCase()).join(", ")}${sideCountLabel ? `; ${sideCountLabel}` : ""}`
    : `${sideCountLabel}; kierunki nie zostały podane`;

  return (
    <div className={input.compact ? "sun-compass sun-compass-compact" : "sun-compass"} role="img" aria-label={label} title={label}>
      <span className="sun-compass-label sun-compass-n">N</span><span className="sun-compass-label sun-compass-e">E</span><span className="sun-compass-label sun-compass-s">S</span><span className="sun-compass-label sun-compass-w">W</span>
      {exposure.directions.map((direction) => <span key={direction} className="sun-compass-marker" style={positions[direction]} />)}
      {exposure.sideCount !== undefined ? (
        <span className="sun-compass-sides" aria-hidden="true">{exposure.sideCount === 2 ? "↔" : `${exposure.sideCount}×`}</span>
      ) : null}
    </div>
  );
}

function listingHref(listingId: string) {
  return `${window.location.pathname}?listing=${encodeURIComponent(listingId)}`;
}

function ListingDetailPanel(input: {
  listing: ListingDetail;
  duplicateCandidates: DuplicateCandidate[];
  onClose: () => void;
  onOpenRelatedListing: (listingId: string) => void | Promise<void>;
  onReviewDuplicate: (pair: DuplicateCandidate, status: "same_listing" | "different_listing") => void | Promise<void>;
  onToggleShortlist: (listingId: string, shortlisted: boolean) => void | Promise<void>;
  onDismiss: (listingId: string) => void | Promise<void>;
  onArchive: (listingId: string) => void | Promise<void>;
  isCompared: boolean;
  onToggleCompare: (listingId: string) => void;
  isUpdatingShortlist: boolean;
  isDismissing: boolean;
  isArchiving: boolean;
  isLoadingDuplicateCandidates: boolean;
  isReviewingDuplicatePair: string | null;
  onSaveManual: (manual: ListingDetail["manual"]) => void | Promise<void>;
  onAddContactEvent: (event: {
    eventType: ListingContactEventType;
    occurredAt: string;
    title?: string;
    notes?: string;
    contactName?: string;
    amount?: number;
  }) => void | Promise<void>;
  onScheduleViewing: (input: { listingId: string; scheduledAt: string; notes?: string }) => void | Promise<void>;
  onDeleteViewing: (listingId: string) => void | Promise<void>;
  onBackfillMedia: (listingId: string) => void | Promise<void>;
  onRefreshFromSource: (listing: Pick<ListingDetail, "id" | "canonicalUrl" | "sourceLabel">) => void | Promise<void>;
  refreshConfirmation: { listingId: string; refreshedAt: Date; action: CollectorRunResponse["action"] } | null;
  isBackfillingMedia: boolean;
  isRefreshingFromSource: boolean;
  isSavingManual: boolean;
  isSavingContactEvent: boolean;
  isLoadingInsights: boolean;
  onRefreshInsights: () => void | Promise<void>;
  onAddToMortgage: (listing: ListingDetail) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState(toDatetimeInputValue(input.listing.viewing?.scheduledAt));
  const [viewingNotes, setViewingNotes] = useState(input.listing.viewing?.notes ?? "");
  const [manual, setManual] = useState<ListingDetail["manual"]>(input.listing.manual);
  const [contactEvent, setContactEvent] = useState(createEmptyContactEventDraft(input.listing.manual.contactName));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(null);
  const [photoRotation, setPhotoRotation] = useState(0);
  useEffect(() => setPhotoRotation(0), [lightboxImageIndex]);
  const [isDismissConfirmOpen, setIsDismissConfirmOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "manual" | "contact" | "features">("overview");
  const [copiedId, setCopiedId] = useState(false);
  const detailPanelRef = useRef<HTMLElement | null>(null);
  const imageSwipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const didSwipeImageRef = useRef(false);
  const lightboxSwipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  useEffect(() => {
    setScheduledAt(toDatetimeInputValue(input.listing.viewing?.scheduledAt));
    setViewingNotes(input.listing.viewing?.notes ?? "");
    setManual(input.listing.manual);
  }, [input.listing.viewing, input.listing.manual]);
  useEffect(() => {
    setContactEvent(createEmptyContactEventDraft(input.listing.manual.contactName));
    setActiveImageIndex(0);
    setLightboxImageIndex(null);
    setIsDismissConfirmOpen(false);
    setActiveDetailTab("overview");
  }, [input.listing.id]);
  useEffect(() => {
    detailPanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [input.listing.id]);
  useEffect(() => {
    if (lightboxImageIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxImageIndex(null);
      }

      if (event.key === "ArrowLeft") {
        showPreviousLightboxImage();
      }

      if (event.key === "ArrowRight") {
        showNextLightboxImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImageIndex, input.listing.imageUrls.length]);
  const mapQuery = [input.listing.street, input.listing.district, input.listing.city, "Polska"].filter(Boolean).join(", ");
  const mapHref = input.listing.latitude && input.listing.longitude
    ? `https://www.openstreetmap.org/?mlat=${input.listing.latitude}&mlon=${input.listing.longitude}#map=16/${input.listing.latitude}/${input.listing.longitude}`
    : buildOsmSearchHref(input.listing, mapQuery);
  const activeImageUrl = input.listing.imageUrls[activeImageIndex] ?? input.listing.imageUrls[0];
  const duplicateCandidates = input.duplicateCandidates.filter((candidate) => candidate.left.id === input.listing.id || candidate.right.id === input.listing.id);
  const maintenanceFee = input.listing.features.find((feature) => feature.key === "fees")?.value;
  const changeDetailImage = (direction: -1 | 1) => {
    setActiveImageIndex((current) => (current + direction + input.listing.imageUrls.length) % input.listing.imageUrls.length);
  };

  function handleImagePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" || input.listing.imageUrls.length < 2) {
      return;
    }

    didSwipeImageRef.current = false;
    imageSwipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleImagePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = imageSwipeStartRef.current;
    imageSwipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    // A deliberate horizontal swipe, without stealing normal vertical page scrolling.
    if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      didSwipeImageRef.current = true;
      changeDetailImage(deltaX < 0 ? 1 : -1);
    }
  }

  function handleLightboxImagePointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    if (event.pointerType === "mouse" || input.listing.imageUrls.length < 2) {
      return;
    }

    lightboxSwipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleLightboxImagePointerUp(event: ReactPointerEvent<HTMLImageElement>) {
    const start = lightboxSwipeStartRef.current;
    lightboxSwipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      event.stopPropagation();
      if (deltaX < 0) {
        showNextLightboxImage();
      } else {
        showPreviousLightboxImage();
      }
    }
  }

  return (
    <aside className="detail-overlay" onClick={input.onClose}>
      <section ref={detailPanelRef} className="detail-panel" onClick={(event) => event.stopPropagation()}>
        <div className="detail-topbar">
          <button className="detail-close-icon" type="button" aria-label="Zamknij okno" title="Zamknij" onClick={input.onClose}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="panel-header detail-header">
          <div>
            <p className="eyebrow">Szczegół oferty</p>
            <h2>{input.listing.title}</h2>
            <div className="listing-id-row"><code className="listing-record-id">ID: {input.listing.id}</code><button className={copiedId ? "icon-button copied" : "icon-button"} type="button" title="Kopiuj ID" aria-label="Kopiuj ID" onClick={async () => { try { if (navigator.clipboard) await navigator.clipboard.writeText(input.listing.id); else { const area=document.createElement("textarea"); area.value=input.listing.id; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); } setCopiedId(true); window.setTimeout(() => setCopiedId(false), 1600); } catch { setCopiedId(false); } }}>{copiedId ? "✓" : <ClipboardCheck size={14} aria-hidden="true" />}</button></div>
            <ListingBadgeRow badges={input.listing.badges} />
          </div>
          <div className="detail-actions">
            <button className="action-button secondary-button detail-refresh-button" type="button" onClick={() => void input.onRefreshFromSource(input.listing)} disabled={input.isRefreshingFromSource || !input.listing.canonicalUrl}>
              <RefreshCw size={16} aria-hidden="true" className={input.isRefreshingFromSource ? "icon-spin" : ""} /> {input.isRefreshingFromSource ? "Dociągam ofertę…" : "Dociągnij ofertę"}
            </button>
            <button className={input.listing.isShortlisted ? "action-button shortlist-active" : "action-button secondary-button"} onClick={() => void input.onToggleShortlist(input.listing.id, !input.listing.isShortlisted)} disabled={input.isUpdatingShortlist}>
              <Star size={16} aria-hidden="true" fill={input.listing.isShortlisted ? "currentColor" : "none"} /> {input.listing.isShortlisted ? "W ulubionych" : "Dodaj do ulubionych"}
            </button>
            <button className={input.isCompared ? "action-button shortlist-active" : "action-button secondary-button"} type="button" onClick={() => input.onToggleCompare(input.listing.id)}>
              <GitCompareArrows size={16} aria-hidden="true" /> {input.isCompared ? "W porównaniu" : "Porównaj"}
            </button>
            <button className="action-button secondary-button" type="button" onClick={() => void input.onArchive(input.listing.id)} disabled={input.isArchiving}>
              <Archive size={16} aria-hidden="true" /> {input.isArchiving ? "Oznaczanie..." : "Oznacz jako archiwalną"}
            </button>
            <button className="action-button danger-button" type="button" onClick={() => setIsDismissConfirmOpen(true)} disabled={input.isDismissing}>
              <Trash2 size={16} aria-hidden="true" /> {input.isDismissing ? "Odrzucanie..." : "Odrzuć ofertę"}
            </button>
            <button className="action-button secondary-button" type="button" onClick={() => input.onAddToMortgage(input.listing)}>
              <Calculator size={16} aria-hidden="true" /> Dodaj do kalkulacji kredytowej
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-gallery">
              {activeImageUrl ? (
                <button
                  className="detail-image-button"
                  type="button"
                  onPointerDown={handleImagePointerDown}
                  onPointerUp={handleImagePointerUp}
                  onPointerCancel={() => { imageSwipeStartRef.current = null; }}
                  onClick={(event) => {
                    if (didSwipeImageRef.current) {
                      event.preventDefault();
                      didSwipeImageRef.current = false;
                      return;
                    }
                    setLightboxImageIndex(activeImageIndex);
                  }}
                  aria-label="Otwórz zdjęcie na pełnym ekranie. Przesuń palcem w lewo lub prawo, aby zmienić zdjęcie."
                >
                  <div className="detail-image-track" style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}>
                    {input.listing.imageUrls.map((imageUrl, index) => <img key={`${input.listing.id}-${imageUrl}`} className="detail-image detail-image-primary" src={imageUrl} alt={`${input.listing.title}, zdjęcie ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} />)}
                  </div>
                </button>
              ) : (
                <div className="detail-image detail-image-empty">Brak zdjęć</div>
              )}
              {input.listing.imageUrls.length > 1 ? (
                <div className="detail-thumbs" role="tablist" aria-label="Miniatury zdjęć oferty">
                  {input.listing.imageUrls.map((imageUrl, index) => (
                    <button
                      key={`${input.listing.id}-${index}`}
                      type="button"
                      className={index === activeImageIndex ? "detail-thumb active" : "detail-thumb"}
                      onClick={() => {
                        setActiveImageIndex(index);
                      }}
                    >
                      <img
                        className="detail-thumb-image"
                        src={imageUrl}
                        alt={`${input.listing.title} miniatura ${index + 1}`}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              <SunExposureCompass description={input.listing.description} />
              {input.listing.imageUrls.length > 1 ? (
                <>
                  <button className="detail-gallery-nav detail-gallery-prev" type="button" aria-label="Poprzednie zdjęcie" onClick={() => changeDetailImage(-1)}><ChevronLeft size={22} aria-hidden="true" /></button>
                  <button className="detail-gallery-nav detail-gallery-next" type="button" aria-label="Następne zdjęcie" onClick={() => changeDetailImage(1)}><ChevronRight size={22} aria-hidden="true" /></button>
                  <div className="detail-image-dots" aria-label="Wybierz zdjęcie">
                    {input.listing.imageUrls.map((imageUrl, index) => <button key={`${imageUrl}-${index}`} type="button" className={index === activeImageIndex ? "active" : ""} aria-label={`Zdjęcie ${index + 1}`} onClick={() => setActiveImageIndex(index)} />)}
                  </div>
                  <span className="detail-gallery-counter">{activeImageIndex + 1} / {input.listing.imageUrls.length}</span>
                </>
              ) : null}
            </div>
            <MortgageQuickPreview listing={input.listing} />
            <div className="detail-section-tabs">
              <button className={tabClass(activeDetailTab === "overview")} type="button" onClick={() => setActiveDetailTab("overview")}><LayoutDashboard size={16} aria-hidden="true" /> Przegląd</button>
              <button className={tabClass(activeDetailTab === "manual")} type="button" onClick={() => setActiveDetailTab("manual")}><NotebookPen size={16} aria-hidden="true" /> Notatki</button>
              <button className={tabClass(activeDetailTab === "features")} type="button" onClick={() => setActiveDetailTab("features")}><ClipboardCheck size={16} aria-hidden="true" /> Cechy</button>
            </div>
            <div className={activeDetailTab === "overview" ? "detail-tab-section" : "detail-section-hidden"}>
            <table className="listing-facts-table">
              <tbody>
                <tr><th>Adres</th><td colSpan={3}>{input.listing.addressText ?? "Brak adresu"}</td></tr>
                <tr><th>Okolica</th><td>{input.listing.district}{input.listing.neighborhood ? ` / ${input.listing.neighborhood}` : ""}</td><th>Data</th><td>{formatListingDateLabel(input.listing)}</td></tr>
                <tr><th>Cena</th><td className="fact-price">{input.listing.priceLabel}</td><th>Metraż</th><td>{input.listing.areaLabel ?? "-"}</td></tr>
                {input.listing.additionalPurchaseCosts ? <tr><th>Dodatki do zakupu</th><td>{formatPln(input.listing.additionalPurchaseCosts.total)}{input.listing.additionalPurchaseCosts.garage ? ` (garaż: ${formatPln(input.listing.additionalPurchaseCosts.garage)})` : ""}{input.listing.additionalPurchaseCosts.storage ? ` (komórka: ${formatPln(input.listing.additionalPurchaseCosts.storage)})` : ""}</td><th>Łączna cena zakupu</th><td className="fact-price">{input.listing.totalAcquisitionPrice ? formatPln(input.listing.totalAcquisitionPrice) : "-"}</td></tr> : null}
                {input.listing.additionalPurchaseCosts ? <tr><th>Cena całkowita</th><td className="fact-price">{input.listing.totalAcquisitionPrice ? formatPln(input.listing.totalAcquisitionPrice) : input.listing.priceLabel}</td><th>Cena mieszkania</th><td>{input.listing.priceLabel}</td></tr> : null}
                <tr><th>PLN/m2</th><td>{input.listing.pricePerSqmLabel ?? "-"}</td><th>Pokoje</th><td>{input.listing.rooms ?? "-"}</td></tr>
                <tr><th>RCN</th><td colSpan={3}>{input.listing.rcnDeltaLabel}</td></tr>
                <tr><th>Piętro</th><td>{input.listing.floor ?? "-"} / {input.listing.totalFloors ?? "-"}</td><th>Czynsz</th><td>{maintenanceFee ?? "-"}</td></tr>
                {input.listing.additionalPurchaseCosts?.garage ? (
                  <>
                    <tr><th>Rok budowy</th><td>{input.listing.yearBuilt ?? "-"}</td><th>Garaż / parking</th><td>{formatPln(input.listing.additionalPurchaseCosts.garage)}</td></tr>
                    <tr><th>Telefon</th><td colSpan={3}>{manual.contactPhone ?? input.listing.sourceContactPhone ?? "Brak"}</td></tr>
                  </>
                ) : <tr><th>Rok budowy</th><td>{input.listing.yearBuilt ?? "-"}</td><th>Telefon</th><td>{manual.contactPhone ?? input.listing.sourceContactPhone ?? "Brak"}</td></tr>}
                <tr><th>Po rozmowie</th><td>{manual.askingPriceOverride ? formatPln(manual.askingPriceOverride) : "-"}</td><th>Do utargowania</th><td>{manual.negotiatedPriceAmount ? formatPln(manual.negotiatedPriceAmount) : "-"}</td></tr>
                <tr className="listing-portals-row"><th>Portale</th><td colSpan={3}><div className="source-links-list">{input.listing.canonicalUrl ? <a href={input.listing.canonicalUrl} target="_blank" rel="noreferrer">{input.listing.sourceLabel ?? "Główna oferta"}</a> : <span>Brak</span>}{input.listing.relatedListings.map((related) => related.canonicalUrl ? <a key={related.id} href={related.canonicalUrl} target="_blank" rel="noreferrer">{related.sourceLabel ?? "Inny portal"}</a> : null)}</div></td></tr>
              </tbody>
            </table>
            <ListingParcelCard listing={input.listing} />
            <div className="quick-contact-card">
              <div><Phone size={18} aria-hidden="true" /><span><strong>Telefon do oferty</strong><small>Możesz poprawić numer bez wchodzenia w osobny moduł kontaktu.</small></span></div>
              <label className="detail-field"><span>Numer telefonu</span><input className="text-input" inputMode="tel" value={manual.contactPhone ?? input.listing.sourceContactPhone ?? ""} onChange={(event) => setManual((current) => ({ ...current, contactPhone: event.target.value }))} placeholder="np. 600 000 000" /></label>
              <button className="action-button secondary-button" type="button" disabled={input.isSavingManual} onClick={() => void input.onSaveManual(manual)}>{input.isSavingManual ? "Zapisuję…" : "Zapisz numer"}</button>
            </div>
            {maintenanceFee ? <p className="muted listing-facts-hint">Czynsz odczytano informacyjnie z opisu oferty (np. „czynsz administracyjny” z zaliczkami). Podobne zapisy automatycznie uzupełniają tę wartość.</p> : null}
            <DescriptionReview description={input.listing.description} />
            <ListingDescription value={input.listing.description} />
            <section className="subsection rcn-transactions">
              <div className="section-topline"><div><h3>Transakcje RCN z tej ulicy · do 150 m</h3><p className="muted">Rzeczywiste ceny transakcyjne z ostatnich 4 lat, sortowane od najbliższej lokalizacji.</p></div></div>
              {input.listing.rcnTransactions.length > 0 ? <div className="rcn-transaction-list">{input.listing.rcnTransactions.map((transaction) => <div className="rcn-transaction" key={transaction.id}><strong>{transaction.areaSqm.toFixed(1)} m² · {formatPln(transaction.priceAmount)}</strong><span>{Math.round(transaction.pricePerSqm).toLocaleString("pl-PL")} PLN/m² · {transaction.distanceMeters} m · {transaction.marketType === "primary" ? "pierwotny" : "wtórny"}</span><small>{new Date(transaction.transactionDate).toLocaleDateString("pl-PL")}</small></div>)}</div> : <p className="muted">Brak transakcji z ostatnich 4 lat z tej samej ulicy w promieniu 150 m. Benchmark tej oferty: {input.listing.rcnDeltaLabel}.</p>}
            </section>
            </div>

            <section className={activeDetailTab === "manual" ? "subsection detail-tab-section" : "detail-section-hidden"}>
              <div className="section-topline">
                <div>
                  <h3>Wasze notatki i ustalenia</h3>
                  <p className="muted">Tu zapisujesz to, co uslyszysz od posrednika albo wlasciciela.</p>
                </div>
              </div>
              <div className="ops-form viewing-form">
                <fieldset className="manual-feature-corrections">
                  <legend>Korekta automatycznego odczytu</legend>
                  <p className="muted">Potwierdź po rozmowie lub oglądaniu. Te wartości mają pierwszeństwo przed tekstem ogłoszenia.</p>
                  <label><input
                    type="checkbox"
                    checked={manual.hasLiftOverride === true}
                    onChange={(event) => setManual((current) => ({ ...current, hasLiftOverride: event.target.checked ? true : undefined }))}
                  /> Jest winda</label>
                  <label><input
                    type="checkbox"
                    checked={manual.hasGarageOverride === true}
                    onChange={(event) => setManual((current) => ({ ...current, hasGarageOverride: event.target.checked ? true : undefined }))}
                  /> Jest miejsce w garażu</label>
                  <label><input
                    type="checkbox"
                    checked={manual.hasStorageOverride === true}
                    onChange={(event) => setManual((current) => ({ ...current, hasStorageOverride: event.target.checked ? true : undefined }))}
                  /> Jest komórka lokatorska</label>
                  <label className="detail-field"><span>Dopłata za garaż / parking</span><input
                    className="text-input"
                    inputMode="numeric"
                    value={stringValue(manual.garageCostOverride)}
                    onChange={(event) => setManual((current) => ({ ...current, garageCostOverride: toOptionalNumber(event.target.value) }))}
                  /></label>
                  <label className="detail-field"><span>Dopłata za komórkę</span><input
                    className="text-input"
                    inputMode="numeric"
                    value={stringValue(manual.storageCostOverride)}
                    onChange={(event) => setManual((current) => ({ ...current, storageCostOverride: toOptionalNumber(event.target.value) }))}
                  /></label>
                </fieldset>
                <label className="detail-field"><span>Etap decyzji</span><select
                  className="text-input"
                  value={manual.decisionStage ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, decisionStage: toDecisionStage(event.target.value) }))}
                >
                  <option value="">Etap decyzji</option>
                  <option value="new">Nowa oferta</option>
                  <option value="to_call">Do telefonu</option>
                  <option value="after_call">Po rozmowie</option>
                  <option value="to_viewing">Do oglądania</option>
                  <option value="after_viewing">Po oglądaniu</option>
                  <option value="to_offer">Do oferty</option>
                  <option value="rejected">Odrzucona</option>
                  <option value="bought">Kupiona</option>
                </select></label>
                <label className="detail-field"><span>Status kontaktu</span><select
                  className="text-input"
                  value={manual.contactStatus ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, contactStatus: toContactStatus(event.target.value) }))}
                >
                  <option value="">Status kontaktu</option>
                  <option value="new">Nowa</option>
                  <option value="contacted">Po kontakcie</option>
                  <option value="negotiating">W negocjacji</option>
                  <option value="viewing_scheduled">Oglądanie umówione</option>
                  <option value="rejected">Odrzucone</option>
                  <option value="closed">Zamkniete</option>
                </select></label>
                <label className="detail-field"><span>Osoba kontaktowa</span><input
                  className="text-input"
                  value={manual.contactName ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, contactName: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Rola</span><input
                  className="text-input"
                  value={manual.contactRole ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, contactRole: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Telefon</span><input
                  className="text-input"
                  value={manual.contactPhone ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, contactPhone: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Ostatni kontakt</span><input
                  className="text-input"
                  type="datetime-local"
                  value={toDatetimeInputValue(manual.lastContactAt)}
                  onChange={(event) => setManual((current) => ({ ...current, lastContactAt: event.target.value ? new Date(event.target.value).toISOString() : undefined }))}
                /></label>
                <label className="detail-field"><span>Cena po rozmowie</span><input
                  className="text-input"
                  value={stringValue(manual.askingPriceOverride)}
                  onChange={(event) => setManual((current) => ({ ...current, askingPriceOverride: toOptionalNumber(event.target.value) }))}
                /></label>
                <label className="detail-field"><span>Cena po negocjacji</span><input
                  className="text-input"
                  value={stringValue(manual.negotiatedPriceAmount)}
                  onChange={(event) => setManual((current) => ({ ...current, negotiatedPriceAmount: toOptionalNumber(event.target.value) }))}
                /></label>
                <label className="detail-field"><span>Informacje od sprzedajacego</span><textarea
                  className="text-input"
                  rows={4}
                  value={manual.sourceNotes ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, sourceNotes: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Wasze notatki</span><textarea
                  className="text-input"
                  rows={5}
                  value={manual.notes ?? ""}
                  onChange={(event) => setManual((current) => ({ ...current, notes: event.target.value }))}
                /></label>
                <button className="action-button" disabled={input.isSavingManual} onClick={() => void input.onSaveManual(manual)}>
                  {input.isSavingManual ? "Zapisywanie..." : "Zapisz notatki do oferty"}
                </button>
              </div>
            </section>

            <section className={activeDetailTab === "contact" ? "subsection detail-tab-section" : "detail-section-hidden"}>
              <div className="section-topline">
                <div>
                  <h3>Historia kontaktow</h3>
                  <p className="muted">Kazdy telefon, wiadomosc, negocjacje i ustalenia zapisujesz jako osobne zdarzenie.</p>
                </div>
              </div>
              {input.listing.sourceContactPhone ? (
                <div className="result-box">
                  <strong>Kontakt z portalu</strong>
                  <p>{input.listing.sourceContactPhone}</p>
                </div>
              ) : null}
              <div className="ops-form">
                <label className="detail-field"><span>Rodzaj zdarzenia</span><select
                  className="text-input"
                  value={contactEvent.eventType}
                  onChange={(event) => setContactEvent((current) => ({ ...current, eventType: event.target.value as ListingContactEventType }))}
                >
                  <option value="call">Telefon</option>
                  <option value="message">Wiadomosc</option>
                  <option value="email">E-mail</option>
                  <option value="meeting">Spotkanie</option>
                  <option value="viewing_note">Notatka po ogladaniu</option>
                  <option value="negotiation">Negocjacje</option>
                  <option value="status_change">Zmiana statusu</option>
                  <option value="other">Inne</option>
                </select></label>
                <label className="detail-field"><span>Data i godzina</span><input
                  className="text-input"
                  type="datetime-local"
                  value={contactEvent.occurredAt}
                  onChange={(event) => setContactEvent((current) => ({ ...current, occurredAt: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Osoba kontaktowa</span><input
                  className="text-input"
                  value={contactEvent.contactName}
                  onChange={(event) => setContactEvent((current) => ({ ...current, contactName: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Tytul zdarzenia</span><input
                  className="text-input"
                  value={contactEvent.title}
                  onChange={(event) => setContactEvent((current) => ({ ...current, title: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Kwota</span><input
                  className="text-input"
                  value={contactEvent.amount}
                  onChange={(event) => setContactEvent((current) => ({ ...current, amount: event.target.value }))}
                /></label>
                <label className="detail-field"><span>Notatka</span><textarea
                  className="text-input"
                  rows={4}
                  value={contactEvent.notes}
                  onChange={(event) => setContactEvent((current) => ({ ...current, notes: event.target.value }))}
                /></label>
                <button
                  className="action-button"
                  disabled={input.isSavingContactEvent || !contactEvent.occurredAt}
                  onClick={() => void saveContactEvent()}
                >
                  {input.isSavingContactEvent ? "Zapisywanie..." : "Dodaj zdarzenie"}
                </button>
              </div>
              <div className="result-box">
                <strong>Timeline</strong>
                {input.listing.contactHistory.length > 0 ? (
                  <ul className="result-list">
                    {input.listing.contactHistory.map((event) => (
                      <li key={event.id}>
                        {formatContactEvent(event)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Brak zapisanej historii kontaktow.</p>
                )}
              </div>
            </section>

            <section className={activeDetailTab === "features" ? "subsection detail-tab-section" : "detail-section-hidden"}>
              <h3>Cechy wyciagniete z oferty</h3>
              <div className="feature-grid">
                {input.listing.features.map((feature) => (
                  <article key={`${feature.key}-${feature.value}`} className="feature-card">
                    <span>{feature.label}</span>
                    <strong>{feature.value}</strong>
                  </article>
                ))}
              </div>
            </section>
            </div>

          <div>
            <div className="result-box detail-sidebar-box">
              <strong>Oglądanie mieszkania</strong>
              {input.listing.viewing?.scheduledAt ? <p className="viewing-line">Aktualny termin: {formatViewingDate(input.listing.viewing.scheduledAt)}</p> : <p className="muted">Brak umówionego oglądania.</p>}
              <div className="ops-form viewing-form">
                <label className="detail-field"><span>Termin</span><input className="text-input" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
                <label className="detail-field"><span>Notatka do oglądania</span><textarea className="text-input" rows={3} value={viewingNotes} onChange={(event) => setViewingNotes(event.target.value)} placeholder="Na co zwrócić uwagę?" /></label>
                <button className="action-button" disabled={!scheduledAt} onClick={() => void input.onScheduleViewing({ listingId: input.listing.id, scheduledAt: new Date(scheduledAt).toISOString(), notes: viewingNotes || undefined })}>
                  Zapisz termin oglądania
                </button>
                {input.listing.viewing?.scheduledAt ? <button className="action-button secondary-button" onClick={() => void input.onDeleteViewing(input.listing.id)}>Usuń termin</button> : null}
              </div>
            </div>

            {input.listing.relatedListings.length > 0 ? (
              <div className="result-box detail-sidebar-box">
                <strong>Powiązane oferty z innych portali</strong>
                <ul className="result-list">
                  {input.listing.relatedListings.map((related) => (
                    <li key={related.id}>
                      <button className="map-card-title" onClick={() => void input.onOpenRelatedListing(related.id)}>
                        {related.sourceLabel ?? "Inny portal"}: {related.title}
                      </button>
                      {related.canonicalUrl ? (
                        <div>
                          <a href={related.canonicalUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                            Otworz link zrodlowy
                          </a>
                        </div>
                      ) : null}
                      {related.relationNote ? <div className="muted">{related.relationNote}</div> : null}
                      <div className="muted">{related.priceLabel}{related.areaLabel ? ` / ${related.areaLabel}` : ""}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="result-box detail-sidebar-box">
              <strong>Potencjalne duplikaty</strong>
              {input.isLoadingDuplicateCandidates ? <p className="muted">Sprawdzanie kandydatów...</p> : null}
              {!input.isLoadingDuplicateCandidates && duplicateCandidates.length === 0 && input.listing.relatedListings.length > 0 ? (
                <p className="muted">Brak nierozstrzygniętych kandydatów. Ta oferta ma już powiązane rekordy z innych portali powyżej.</p>
              ) : null}
              {!input.isLoadingDuplicateCandidates && duplicateCandidates.length === 0 && input.listing.relatedListings.length === 0 ? <p className="muted">Brak nierozstrzygniętych kandydatów dla tej oferty.</p> : null}
              {duplicateCandidates.map((candidate) => {
                const counterpart = candidate.left.id === input.listing.id ? candidate.right : candidate.left;
                return (
                  <div className="duplicate-candidate-card" key={candidate.pairKey}>
                    <button className="map-card-title" onClick={() => void input.onOpenRelatedListing(counterpart.id)}>
                      {counterpart.sourceLabel ?? "Inny portal"}: {counterpart.title}
                    </button>
                    <div className="muted">{counterpart.priceLabel}{counterpart.areaLabel ? ` / ${counterpart.areaLabel}` : ""}{counterpart.roomsLabel ? ` / ${counterpart.roomsLabel}` : ""}</div>
                    <div className="muted">{counterpart.addressText ?? `${counterpart.city}${counterpart.district ? ` / ${counterpart.district}` : ""}`}</div>
                    <div className="muted">Pewność: {candidate.confidenceScore}% · {candidate.reasons.join(", ")}</div>
                    <div className="panel-inline-actions">
                      <button
                        className="action-button secondary-button"
                        type="button"
                        onClick={() => void input.onReviewDuplicate(candidate, "different_listing")}
                        disabled={input.isReviewingDuplicatePair === candidate.pairKey}
                      >
                        To nie duplikat
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        onClick={() => void input.onReviewDuplicate(candidate, "same_listing")}
                        disabled={input.isReviewingDuplicatePair === candidate.pairKey}
                      >
                        Zostaw tę, ukryj duplikat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="result-box detail-sidebar-box">
              <strong>Historia cen</strong>
              {input.listing.priceHistory.length > 0 ? (
                <ul className="result-list">
                  {[...input.listing.priceHistory]
                    .sort((left, right) => new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime())
                    .map((event, index) => (
                      <li key={`${event.changedAt}-${index}`}>
                        {formatPriceEvent(event)}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="muted">Brak zapisanej historii zmian ceny.</p>
              )}
            </div>

            <div className="result-box detail-sidebar-box">
              <strong>Dojazdy do pracy</strong>
              {input.isLoadingInsights && input.listing.commutes.length === 0 ? (
                <p className="muted">Ładowanie dojazdów...</p>
              ) : (
                <ul className="result-list">
                  {input.listing.commutes.map((commute) => <li key={commute.key}>{commute.label}: {commute.durationMinutes ? `${commute.durationMinutes} min` : "brak"}{commute.distanceKm ? ` / ${commute.distanceKm} km` : ""}</li>)}
                </ul>
              )}
            </div>

            <div className="result-box detail-sidebar-box">
              <strong>Okolica</strong>
              {input.isLoadingInsights ? (
                <p className="muted">Pobieram aktualne dane o okolicy...</p>
              ) : input.listing.amenityAnalysis?.status === "unavailable" ? (
                <div className="amenity-unavailable">
                  <p className="muted">Publiczne serwery OpenStreetMap chwilowo nie odpowiedziały. To nie oznacza, że w okolicy niczego nie ma.</p>
                  <button className="action-button secondary-button" type="button" onClick={() => void input.onRefreshInsights()}>
                    <RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie
                  </button>
                </div>
              ) : input.listing.amenityAnalysis?.status === "missing_location" ? (
                <p className="muted">Do analizy okolicy potrzebna jest dokładna lokalizacja.</p>
              ) : !input.listing.amenityAnalysis && input.listing.amenities.length === 0 ? (
                <div className="amenity-unavailable">
                  <p className="muted">Nie udało się jeszcze przygotować analizy okolicy dla tej oferty.</p>
                  <button className="action-button secondary-button" type="button" onClick={() => void input.onRefreshInsights()}>
                    <RefreshCw size={15} aria-hidden="true" /> Pobierz analizę
                  </button>
                </div>
              ) : (
                <>
                  <div className="amenity-analysis-list">
                    {input.listing.amenities.map((amenity) => <div className="amenity-analysis-row" key={amenity.key}>
                      <div><span>{amenity.label}</span><strong>{amenity.count}</strong></div>
                      <div className="amenity-distance-bands">
                        <small>≤ 500 m: {amenity.within500m ?? 0}</small>
                        <small>≤ 1 km: {amenity.within1000m ?? 0}</small>
                      </div>
                      {amenity.nearestPlaces?.[0] ? <p>{amenity.nearestPlaces[0].name} · {formatDistance(amenity.nearestPlaces[0].distanceMeters)}</p> : amenity.nearestDistanceMeters ? <p>Najbliżej · {formatDistance(amenity.nearestDistanceMeters)}</p> : null}
                    </div>)}
                  </div>
                  {input.listing.amenityAnalysis?.plannedFacilities.length ? <div className="planned-facilities">
                    <strong>Planowane / w budowie</strong>
                    {input.listing.amenityAnalysis.plannedFacilities.slice(0, 5).map((facility) => <p key={facility.osmKey}>
                      {facility.name} · {formatDistance(facility.distanceMeters)} <span>{facility.stage === "construction" ? "w budowie" : "propozycja"}</span>
                    </p>)}
                  </div> : null}
                  {input.listing.amenityAnalysis?.mapUrl ? <a className="map-link amenity-source-link" href={input.listing.amenityAnalysis.mapUrl} target="_blank" rel="noreferrer">Zobacz okolicę w OpenStreetMap</a> : null}
                  {input.listing.amenityAnalysis?.partial ? <p className="amenity-partial-note">Część serwerów nie odpowiedziała — pokazujemy dostępny fragment analizy. Możesz ponowić pobranie.</p> : null}
                  <p className="amenity-attribution">Promień 2 km · dane © OpenStreetMap contributors</p>
                </>
              )}
            </div>

            <div className="map-block detail-sidebar-box">
              {isValidMapPoint(input.listing.latitude, input.listing.longitude) ? <ListingTransitMap listing={input.listing} /> : <div className="map-placeholder">Brak geokodu, dostepny link do wyszukiwania OSM.</div>}
              {input.listing.coordinateAccuracy === "approximate" ? <p className="muted">Punkt orientacyjny: brak numeru budynku albo dokladnego geokodu z portalu.</p> : null}
              <a className="map-link" href={mapHref} target="_blank" rel="noreferrer">Otworz w OpenStreetMap</a>
            </div>
          </div>
        </div>
        <div className="detail-footer">
          <button className="action-button secondary-button" type="button" onClick={input.onClose}>Zamknij</button>
        </div>
        {isDismissConfirmOpen ? (
          <div className="dismiss-confirm-backdrop" role="presentation" onClick={() => setIsDismissConfirmOpen(false)}>
            <section className="dismiss-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dismiss-confirm-title" onClick={(event) => event.stopPropagation()}>
              <h3 id="dismiss-confirm-title">Odrzucić tę ofertę?</h3>
              <p>Oferta zostanie oznaczona jako usunięta. Nie usuniemy jej z bazy, ale nie pojawi się już na dashboardzie, mapie ani w archiwum.</p>
              <div className="panel-inline-actions">
                <button className="action-button secondary-button" type="button" onClick={() => setIsDismissConfirmOpen(false)}>Anuluj</button>
                <button className="action-button danger-button" type="button" onClick={() => void input.onDismiss(input.listing.id)} disabled={input.isDismissing}>{input.isDismissing ? "Odrzucanie..." : "Tak, odrzuć ofertę"}</button>
              </div>
            </section>
          </div>
        ) : null}
        {lightboxImageIndex !== null ? (
          <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia" onClick={() => setLightboxImageIndex(null)}>
            <FullscreenFrame label="Zdjęcia oferty" className="photo-fullscreen" modal>
            <button className="photo-rotate" type="button" onClick={(event) => { event.stopPropagation(); setPhotoRotation((value) => (value + 90) % 360); }} aria-label="Obróć zdjęcie o 90 stopni"><RotateCcw size={20} /></button>
            <button className="image-lightbox-close" type="button" onClick={() => setLightboxImageIndex(null)} aria-label="Zamknij podgląd">X</button>
            {input.listing.imageUrls.length > 1 ? (
              <button className="image-lightbox-nav image-lightbox-prev" type="button" onClick={(event) => {
                event.stopPropagation();
                showPreviousLightboxImage();
              }} aria-label="Poprzednie zdjęcie">‹</button>
            ) : null}
            <img
              className={photoRotation % 180 ? "image-lightbox-image is-rotated" : "image-lightbox-image"}
              style={{ transform: `rotate(${photoRotation}deg)` }}
              src={input.listing.imageUrls[lightboxImageIndex]}
              alt={`${input.listing.title} zdjęcie ${lightboxImageIndex + 1}`}
              onPointerDown={handleLightboxImagePointerDown}
              onPointerUp={handleLightboxImagePointerUp}
              onPointerCancel={() => { lightboxSwipeStartRef.current = null; }}
              onClick={(event) => event.stopPropagation()}
            />
            {input.listing.imageUrls.length > 1 ? (
              <button className="image-lightbox-nav image-lightbox-next" type="button" onClick={(event) => {
                event.stopPropagation();
                showNextLightboxImage();
              }} aria-label="Następne zdjęcie">›</button>
            ) : null}
            <div className="image-lightbox-counter">{lightboxImageIndex + 1} / {input.listing.imageUrls.length}</div>
            </FullscreenFrame>
          </div>
        ) : null}
      </section>
    </aside>
  );

  function showPreviousLightboxImage() {
    setLightboxImageIndex((current) => {
      if (current === null || input.listing.imageUrls.length === 0) {
        return current;
      }

      const nextIndex = current - 1;
      return nextIndex < 0 ? input.listing.imageUrls.length - 1 : nextIndex;
    });
  }

  function showNextLightboxImage() {
    setLightboxImageIndex((current) => {
      if (current === null || input.listing.imageUrls.length === 0) {
        return current;
      }

      return (current + 1) % input.listing.imageUrls.length;
    });
  }

  async function saveContactEvent() {
    await input.onAddContactEvent({
      eventType: contactEvent.eventType,
      occurredAt: new Date(contactEvent.occurredAt).toISOString(),
      title: contactEvent.title.trim() || undefined,
      notes: contactEvent.notes.trim() || undefined,
      contactName: contactEvent.contactName.trim() || undefined,
      amount: toOptionalNumber(contactEvent.amount)
    });
    setContactEvent(createEmptyContactEventDraft(manual.contactName));
  }

}

function ListingBadgeRow({ badges }: { badges: string[] }) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="listing-badges">
      {badges.map((badge) => (
        <span key={badge} className="listing-badge">{badge}</span>
      ))}
    </div>
  );
}

function filterCommercialBadges(badges: string[]) {
  return badges.filter((badge) =>
    badge === "Bez prowizji"
    || badge === "Z prowizją"
    || badge === "Oferta pośrednika"
    || badge === "Oferta prywatna"
    || badge === "Oferta bezpośrednia"
  );
}

function filterNonCommercialBadges(badges: string[]) {
  return badges.filter((badge) =>
    !filterCommercialBadges([badge]).length
    && !filterImageAmenityBadge(badge)
    && !badge.startsWith("Mieszkanie docelowe:")
  );
}

function ListingParcelCard({ listing }: { listing: Pick<ListingDetail, "id" | "latitude" | "longitude"> }) {
  const [context, setContext] = useState<ParcelContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parcelRefreshAttempt, setParcelRefreshAttempt] = useState(0);
  const [planning, setPlanning] = useState<PlanningContextResponse | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setContext(null);
    setError(null);
    setPlanning(null);
    setPlanningError(null);
    setLoading(true);
    fetch(`${apiBaseUrl}/api/listings/${listing.id}/parcel${parcelRefreshAttempt ? "?refresh=true" : ""}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Nie udało się pobrać działki.")))
      .then((value: ParcelContextResponse) => {
        setContext(value);
        if (value.status === "available") void loadPlanning(false, controller.signal);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Nie udało się pobrać działki.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [listing.id, parcelRefreshAttempt]);

  async function loadPlanning(refresh = false, signal?: AbortSignal) {
    setPlanningLoading(true);
    setPlanningError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/listings/${listing.id}/planning${refresh ? "?refresh=true" : ""}`, { signal });
      if (!response.ok) throw new Error("Nie udało się pobrać analizy planistycznej.");
      setPlanning((await response.json()) as PlanningContextResponse);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setPlanningError(cause instanceof Error ? cause.message : "Nie udało się pobrać analizy planistycznej.");
    } finally {
      if (!signal?.aborted) setPlanningLoading(false);
    }
  }

  if (loading) {
    return <section className="listing-parcel-card"><div className="parcel-card-heading"><MapIcon size={19} aria-hidden="true" /><div><strong>Działka i planowanie</strong><span>Sprawdzam ULDK GUGiK…</span></div></div></section>;
  }
  if (error) {
    return <section className="listing-parcel-card is-muted"><div className="parcel-card-heading"><CircleAlert size={19} aria-hidden="true" /><div><strong>Działka i planowanie</strong><span>{error} To chwilowy błąd usługi ULDK, nie informacja o braku działki.</span></div></div><button className="action-button secondary-button" type="button" onClick={() => setParcelRefreshAttempt((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie</button></section>;
  }
  if (!context || context.status === "missing_location") {
    return <section className="listing-parcel-card is-muted"><div className="parcel-card-heading"><MapPin size={19} aria-hidden="true" /><div><strong>Działka i planowanie</strong><span>Potrzebna jest dokładna lokalizacja oferty.</span></div></div></section>;
  }
  if (context.status === "not_found" || !context.parcel) {
    return <section className="listing-parcel-card is-muted"><div className="parcel-card-heading"><MapPin size={19} aria-hidden="true" /><div><strong>Działka i planowanie</strong><span>ULDK nie odnalazł działki dla tego punktu.</span></div></div></section>;
  }

  const parcel = context.parcel;
  return <section className="listing-parcel-card">
    <div className="parcel-card-heading"><MapIcon size={19} aria-hidden="true" /><div><strong>Działka i planowanie</strong><span>Dane ewidencyjne z ULDK GUGiK{context.isStale ? " · ostatni poprawny wynik" : ""}</span></div></div>
    <div className="parcel-card-grid">
      <ParcelShape geometry={parcel.geometry} latitude={listing.latitude} longitude={listing.longitude} />
      <div className="parcel-card-data">
        <dl>
          <div><dt>Numer działki</dt><dd>{parcel.number ?? "—"}</dd></div>
          <div><dt>Identyfikator</dt><dd><code>{parcel.id}</code></dd></div>
          <div><dt>Obręb</dt><dd>{parcel.region ?? "—"}</dd></div>
          <div><dt>Gmina</dt><dd>{parcel.commune ?? "—"}</dd></div>
        </dl>
        <div className="parcel-card-actions">
          <a className="action-button secondary-button" href={parcel.geoportalUrl} target="_blank" rel="noreferrer">Otwórz działkę w Geoportalu</a>
        </div>
      </div>
    </div>
    <div className="planning-analysis">
      <div className="planning-analysis-heading">
        <div><strong>Najbliższe otoczenie działki</strong><span>Infrastruktura i potencjalne uciążliwości w OpenStreetMap · promień 50 m</span></div>
      </div>
      {planningLoading ? <p className="muted">Sprawdzam obiekty, zabudowę i sposób użytkowania terenu…</p> : planning?.immediateSurroundings?.status === "available" && planning.immediateSurroundings.findings.length ? <div className="surroundings-findings">
        <SurroundingsSummary findings={planning.immediateSurroundings.findings} />
      </div> : planning?.immediateSurroundings?.status === "available" ? <div className="surroundings-assessment is-clear"><span>W danych OSM nie znaleziono w promieniu 50 m oznaczonej fabryki, hali przemysłowej, składowiska, budowy, stacji paliw, torów ani drogi głównej.</span></div> : !planningError ? <div className="planning-feedback"><p className="muted">Nie udało się teraz sprawdzić bezpośredniego otoczenia.</p><button className="action-button secondary-button" type="button" onClick={() => void loadPlanning(true)}><RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie</button></div> : null}
      <p className="parcel-card-note">Brak ostrzeżenia oznacza tylko brak odpowiedniego oznaczenia w OSM — warto potwierdzić sąsiednie działki na mapie i podczas oględzin.</p>
      <div className="urban-registry-analysis">
        <div className="planning-analysis-heading">
          <div><strong>Formalne akty planistyczne</strong><span>Rejestr Urbanistyczny · działka {parcel.number ?? parcel.id}</span></div>
          {planning?.isStale ? <span className="planning-status is-warning">ostatni poprawny wynik</span> : null}
        </div>
      {planningLoading ? <p className="muted">Szukam planów przypisanych do tej działki…</p> : planningError || planning?.status === "unavailable" ? <div className="planning-feedback">
        <p className="muted">{planningError ?? planning?.message}</p>
        <button className="action-button secondary-button" type="button" onClick={() => void loadPlanning(true)}><RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie</button>
      </div> : planning?.status === "available" ? <div className="planning-act-list">
        {planning.acts.map((act) => <article className="planning-act" key={act.id}>
          <div className="planning-act-top"><span>{act.planTypeLabel}</span>{act.status ? <span className="planning-status">{act.status}</span> : null}</div>
          <strong>{act.title}</strong>
          <p>{act.validFrom ? `Obowiązuje od ${formatPlanningDate(act.validFrom)}` : act.publishDate ? `Opublikowano ${formatPlanningDate(act.publishDate)}` : "Brak daty obowiązywania"}{act.validTo ? ` do ${formatPlanningDate(act.validTo)}` : ""}</p>
          <a className="text-link-button" href={act.detailsUrl} target="_blank" rel="noreferrer">Otwórz konkretny akt w RU</a>
        </article>)}
      </div> : planning?.status === "not_found" ? <div className="planning-feedback">
        <p>{planning.message}</p>
        <a className="text-link-button" href={planning.registryUrl} target="_blank" rel="noreferrer">Sprawdź wyszukiwarkę RU</a>
      </div> : null}
      <p className="parcel-card-note">RU pokazuje opublikowane akty planowania przestrzennego przypisane do identyfikatora działki. Do 30 listopada 2026 r. rejestr jest nadal uzupełniany, dlatego brak wyniku nie przesądza o braku planu.</p>
      </div>
    </div>
  </section>;
}

function formatPlanningDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pl-PL");
}

function ParcelShape({ geometry, latitude, longitude }: { geometry: ParcelGeometry; latitude?: number; longitude?: number }) {
  const rings = geometry.type === "Polygon"
    ? geometry.coordinates.map((ring) => ring)
    : geometry.coordinates.flatMap((polygon) => polygon.slice(0, 1));
  const points = rings.flat();
  if (!points.length) return <div className="parcel-shape-empty">Brak geometrii</div>;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.000001);
  const height = Math.max(maxY - minY, 0.000001);
  const project = (point: [number, number]) => `${12 + (point[0] - minX) / width * 216},${128 - (point[1] - minY) / height * 116}`;
  const pointX = longitude == null ? null : 12 + (longitude - minX) / width * 216;
  const pointY = latitude == null ? null : 128 - (latitude - minY) / height * 116;
  return <svg className="parcel-shape" viewBox="0 0 240 140" role="img" aria-label="Granica działki ewidencyjnej">
    {rings.map((ring, index) => <polygon key={index} points={ring.map(project).join(" ")} />)}
    {pointX !== null && pointY !== null && pointX >= 0 && pointX <= 240 && pointY >= 0 && pointY <= 140 ? <circle cx={pointX} cy={pointY} r="4" /> : null}
  </svg>;
}

function filterImageAmenityBadge(badge: string) {
  return badge === "Brak miejsca postojowego"
    || badge === "Prywatne miejsce postojowe"
    || badge === "Garaż"
    || badge === "Garaż (platforma)"
    || badge === "Miejsce na platformie"
    || badge === "Garaż na wynajem"
    || badge === "Miejsce postojowe na terenie osiedla"
    || badge === "Naziemne miejsce postojowe"
    || /^\d+\s+miejsca w garażu$/.test(badge)
    || /^\d+\s+prywatne miejsca postojowe$/.test(badge)
    || /^\d+\s+(?:naziemne miejsca postojowe|miejsca postojowe na osiedlu)$/.test(badge)
    || badge === "Brak windy"
    || badge === "Stan deweloperski";
}

function PipelineBoard(input: {
  listings: ListingSummary[];
  onOpen: (listingId: string) => void | Promise<void>;
}) {
  const columns: Array<{ stage: NonNullable<ListingSummary["decisionStage"]>; label: string }> = [
    { stage: "new", label: "Nowe" },
    { stage: "to_call", label: "Do telefonu" },
    { stage: "after_call", label: "Po rozmowie" },
    { stage: "to_viewing", label: "Do ogladania" },
    { stage: "after_viewing", label: "Po ogladaniu" },
    { stage: "to_offer", label: "Do oferty" },
    { stage: "bought", label: "Kupione" }
  ];
  const trackedListings = input.listings.filter((listing) => listing.isShortlisted || listing.decisionStage);
  const rejectedListings = trackedListings.filter((listing) => listing.decisionStage === "rejected");

  return (
    <div className="ops-grid">
      {columns.map((column) => {
        const items = trackedListings.filter((listing) => (listing.decisionStage ?? "new") === column.stage);
        return (
          <article key={column.stage} className="ops-card">
            <h3>{column.label}</h3>
            <p className="muted">{items.length} ofert</p>
            {items.length > 0 ? items.map((listing) => (
              <button key={listing.id} type="button" className="map-card" onClick={() => void input.onOpen(listing.id)}>
                <div className="map-card-row">
                  <strong>{listing.title}</strong>
                </div>
                <p className="muted">{listing.priceLabel}</p>
                <p className="muted">{listing.district}{listing.neighborhood ? ` / ${listing.neighborhood}` : ""}</p>
                <ListingBadgeRow badges={listing.badges.slice(0, 4)} />
              </button>
            )) : <div className="result-box">Brak ofert w tym etapie.</div>}
          </article>
        );
      })}
      <article className="ops-card">
        <h3>Odrzucone</h3>
        <p className="muted">{rejectedListings.length} ofert</p>
        {rejectedListings.length > 0 ? rejectedListings.map((listing) => (
          <button key={listing.id} type="button" className="map-card" onClick={() => void input.onOpen(listing.id)}>
            <div className="map-card-row">
              <strong>{listing.title}</strong>
            </div>
            <p className="muted">{listing.priceLabel}</p>
            <ListingBadgeRow badges={(listing.badges ?? []).slice(0, 3)} />
          </button>
        )) : <div className="result-box">Brak odrzuconych ofert.</div>}
      </article>
    </div>
  );
}

function CompareBoard(input: {
  listings: ListingSummary[];
  onOpen: (listingId: string) => void | Promise<void>;
  onRemove: (listingId: string) => void;
}) {
  if (input.listings.length === 0) {
    return <div className="result-box">Dodaj 2-5 ofert z kart przez przycisk `Porównaj`.</div>;
  }

  return (
    <div className="compare-board">
      {input.listings.map((listing) => (
        <article key={listing.id} className="compare-card">
          <div className="compare-card-header">
            <div className="compare-card-heading">
              <button type="button" className="map-card-title" onClick={() => void input.onOpen(listing.id)}>{listing.title}</button>
              <p className="muted">{listing.district}{listing.neighborhood ? ` / ${listing.neighborhood}` : ""}</p>
              <ListingBadgeRow badges={listing.badges.slice(0, 4)} />
            </div>
            <button type="button" className="action-button secondary-button" onClick={() => input.onRemove(listing.id)}>Usuń</button>
          </div>

          <div className="compare-card-body">
            {listing.thumbnailUrl ? <img className="compare-card-image" src={listing.thumbnailUrl} alt={listing.title} loading="lazy" /> : null}
            <div className="compare-card-grid">
              <CompareField label="Cena" value={listing.priceLabel} />
              <CompareField label="Metraz" value={listing.areaLabel} />
              <CompareField label="PLN/m2" value={listing.pricePerSqmLabel ?? "-"} />
              <CompareField label="Etap" value={decisionStageDisplay(listing.decisionStage)} />
              <CompareField label="Kontakt" value={contactStatusDisplay(listing.contactStatus)} />
              <CompareField label="Oglądanie" value={listing.viewingScheduledAt ? formatViewingDate(listing.viewingScheduledAt) : "-"} />
              <CompareField label="Wymarzone mieszkanie" value={typeof listing.dreamScore === "number" ? `${listing.dreamScore}%` : "-"} />
              <CompareField label="RCN" value={listing.rcnDeltaLabel} />
              <CompareField label="Podsumowanie" value={listing.summary} wide />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompareField(input: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={input.wide ? "compare-field compare-field-wide" : "compare-field"}>
      <span className="compare-field-label">{input.label}</span>
      <strong className="compare-field-value">{input.value}</strong>
    </div>
  );
}

function SettingsPanel(input: {
  settings: FamilySettings;
  onClose: () => void;
  onSave: (settings: FamilySettings) => void | Promise<void>;
  isSaving: boolean;
  saveError: string | null;
}) {
  const [local, setLocal] = useState<FamilySettings>(input.settings);
  const [selectedDreamDistrict, setSelectedDreamDistrict] = useState<string>("");
  const [selectedDreamSubdivision, setSelectedDreamSubdivision] = useState<string>("__district__");
  const activeDreamDistrict = warsawDreamDistrictCatalog.find((item) => item.district === selectedDreamDistrict);

  function getSelectedDreamLocation() {
    return selectedDreamSubdivision === "__district__" ? selectedDreamDistrict : selectedDreamSubdivision;
  }

  function settingsWithPendingDreamLocation() {
    const value = getSelectedDreamLocation();
    if (!value || local.dreamProfile.preferredDistricts.includes(value)) {
      return local;
    }

    return {
      ...local,
      dreamProfile: {
        ...local.dreamProfile,
        preferredDistricts: [...local.dreamProfile.preferredDistricts, value]
      }
    };
  }

  function addPreferredDreamLocation() {
    const value = getSelectedDreamLocation();
    if (!value) {
      return;
    }

    setLocal((current) => ({
      ...current,
      dreamProfile: {
        ...current.dreamProfile,
        preferredDistricts: current.dreamProfile.preferredDistricts.includes(value)
          ? current.dreamProfile.preferredDistricts
          : [...current.dreamProfile.preferredDistricts, value]
      }
    }));
    setSelectedDreamDistrict("");
    setSelectedDreamSubdivision("__district__");
  }

  function removePreferredDreamLocation(value: string) {
    setLocal((current) => ({
      ...current,
      dreamProfile: {
        ...current.dreamProfile,
        preferredDistricts: current.dreamProfile.preferredDistricts.filter((item) => item !== value)
      }
    }));
  }

  return (
    <aside className="detail-overlay" onClick={input.onClose}>
      <section className="detail-panel settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header settings-header">
          <div className="settings-title"><div><p className="settings-kicker"><Settings2 size={15} aria-hidden="true" /> Ustawienia aplikacji</p><h2>Preferencje wyszukiwania</h2><p>W jednym miejscu ustaw dojazdy, zakres ofert i profil wymarzonego mieszkania.</p></div></div>
          <button className="icon-button" onClick={input.onClose} aria-label="Zamknij ustawienia"><X size={20} aria-hidden="true" /></button>
        </div>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span className="settings-section-icon"><MapPin size={19} aria-hidden="true" /></span>
            <div><h3>Dojazdy do pracy</h3><p>Adresy używane do liczenia czasu i wygody codziennych dojazdów.</p></div>
          </div>
          <div className="settings-workplaces-grid">
            {local.workplaces.map((workplace, index) => (
              <div key={workplace.key} className="settings-workplace-card">
                <span className="settings-card-index">{index + 1}</span>
                <label className="field-label"><span>Nazwa miejsca</span><input className="text-input" value={workplace.label} onChange={(event) => setLocal((current) => ({ ...current, workplaces: current.workplaces.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></label>
                <label className="field-label settings-address-field"><span>Adres</span><input className="text-input" value={workplace.address} onChange={(event) => setLocal((current) => ({ ...current, workplaces: current.workplaces.map((item, itemIndex) => itemIndex === index ? { ...item, address: event.target.value } : item) }))} /></label>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span className="settings-section-icon"><Search size={19} aria-hidden="true" /></span>
            <div><h3>Zakres pobieranych ofert</h3><p>Te zasady sterują wyszukiwaniem na portalach; filtrów na liście nie ograniczają.</p></div>
          </div>
          <div className="ops-form">
            <label className="field-label">
              <span>Miasto</span>
              <small className="field-hint">Bazowa lokalizacja, dla której collector buduje URL-e wyników.</small>
              <input
                className="text-input"
                value={local.searchContract.city}
                onChange={(event) => setLocal((current) => ({ ...current, searchContract: { ...current.searchContract, city: event.target.value } }))}
                placeholder="Miasto"
              />
            </label>
            <label className="field-label">
              <span>Min metraż</span>
              <small className="field-hint">Dolna granica powierzchni. Mniejsze mieszkania nie wpadają do discovery.</small>
              <input
                className="text-input"
                value={String(local.searchContract.minArea)}
                onChange={(event) => setLocal((current) => ({ ...current, searchContract: { ...current.searchContract, minArea: Number(event.target.value) || 0 } }))}
                placeholder="Min metraż"
              />
            </label>
            <label className="field-label">
              <span>Cena od</span>
              <small className="field-hint">Dolna granica budżetu dla discover i collect page.</small>
              <input
                className="text-input"
                value={String(local.searchContract.minPrice)}
                onChange={(event) => setLocal((current) => ({ ...current, searchContract: { ...current.searchContract, minPrice: Number(event.target.value) || 0 } }))}
                placeholder="Cena od"
              />
            </label>
            <label className="field-label">
              <span>Cena do</span>
              <small className="field-hint">Górna granica budżetu dla discover i collect page.</small>
              <input
                className="text-input"
                value={String(local.searchContract.maxPrice)}
                onChange={(event) => setLocal((current) => ({ ...current, searchContract: { ...current.searchContract, maxPrice: Number(event.target.value) || 0 } }))}
                placeholder="Cena do"
              />
            </label>
            <label className="field-label">
              <span>Min pokoje</span>
              <small className="field-hint">Minimalna liczba pokoi, od której collector bierze oferty.</small>
              <input
                className="text-input"
                value={String(local.searchContract.roomsMin)}
                onChange={(event) => setLocal((current) => ({ ...current, searchContract: { ...current.searchContract, roomsMin: Math.max(1, Number(event.target.value) || 1) } }))}
                placeholder="Min pokoje"
              />
            </label>
          </div>
          <p className="settings-footnote">Zmiana zadziała przy następnym sprawdzaniu portali. Przygotowane już adresy pozostaną w kolejce.</p>
        </section>

        <section className="settings-section dream-profile-panel">
          <div className="settings-section-heading">
            <span className="settings-section-icon"><Star size={19} aria-hidden="true" /></span>
            <div><h3>Wymarzone mieszkanie</h3><p>Profil dopasowania, z którego powstaje procentowy wynik widoczny na kartach ofert.</p></div>
          </div>
          <div className="ops-form dream-profile-form">
            <label className="field-label">
              <span>Nazwa profilu</span>
              <small className="field-hint">Etykieta badge na kartach ofert.</small>
              <input
                className="text-input"
                value={local.dreamProfile.label}
                onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, label: event.target.value } }))}
                placeholder="Nazwa profilu"
              />
            </label>
            <div className="settings-grid">
              <label className="field-label">
                <span>Dzielnica</span>
                <small className="field-hint">Wybierasz bazową dzielnicę Warszawy do dodania do profilu.</small>
                <select
                  className="text-input"
                  value={selectedDreamDistrict}
                  onChange={(event) => {
                    setSelectedDreamDistrict(event.target.value);
                    setSelectedDreamSubdivision("__district__");
                  }}
                >
                  <option value="" disabled>Wybierz dzielnicę</option>
                  {warsawDreamDistrictCatalog.map((item) => (
                    <option key={item.district} value={item.district}>{item.district}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                <span>Poddzielnica / osiedle</span>
                <small className="field-hint">Możesz dodać całą dzielnicę albo konkretną poddzielnicę, np. Gocław.</small>
                <select
                  className="text-input"
                  value={selectedDreamSubdivision}
                  disabled={!selectedDreamDistrict}
                  onChange={(event) => setSelectedDreamSubdivision(event.target.value)}
                >
                  <option value="__district__">{selectedDreamDistrict ? `Cała dzielnica: ${selectedDreamDistrict}` : "Najpierw wybierz dzielnicę"}</option>
                  {(activeDreamDistrict?.subdistricts ?? []).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="panel-inline-actions">
              <button className="action-button secondary-button" type="button" disabled={!selectedDreamDistrict} onClick={addPreferredDreamLocation}>
                <MapPin size={16} aria-hidden="true" /> Dodaj lokalizację
              </button>
            </div>
            <div className="preferred-location-list" aria-label="Preferowane lokalizacje">
              {local.dreamProfile.preferredDistricts.map((item) => (
                <button key={item} type="button" className="preferred-location-item" onClick={() => removePreferredDreamLocation(item)} aria-label={`Usun lokalizacje ${item}`}>
                  <span>{item}</span><X size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="settings-grid">
              <label className="field-label">
                <span>Metraż od</span>
                <small className="field-hint">Dolna granica optymalnej powierzchni dla mieszkania docelowego.</small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.minArea)}
                  onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, minArea: Number(event.target.value) || 0 } }))}
                  placeholder="Metraż od"
                />
              </label>
              <label className="field-label">
                <span>Metraż do</span>
                <small className="field-hint">Górna granica optymalnej powierzchni dla mieszkania docelowego.</small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxArea)}
                  onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, maxArea: Number(event.target.value) || 0 } }))}
                  placeholder="Metraż do"
                />
              </label>
              <label className="field-label">
                <span>Pokoje od</span>
                <small className="field-hint">Minimalna liczba pokoi dla sensownego dopasowania do Waszego celu.</small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.minRooms)}
                  onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, minRooms: Number(event.target.value) || 0 } }))}
                  placeholder="Pokoje od"
                />
              </label>
              <label className="field-label">
                <span>Cena do</span>
                <small className="field-hint">Maksymalna łączna cena mieszkania, po której nadal ma wysoki wynik.</small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxPrice)}
                  onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, maxPrice: Number(event.target.value) || 0 } }))}
                  placeholder="Cena do"
                />
              </label>
              <label className="field-label">
                <span>Cena za m2 do</span>
                <small className="field-hint">Górny limit ceny jednostkowej za metr kwadratowy.</small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxPricePerSqm)}
                  onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, maxPricePerSqm: Number(event.target.value) || 0 } }))}
                  placeholder="Cena za m2 do"
                />
              </label>
              <label className="field-label">
                <span>Metro do</span>
                <small className="field-hint">Odległość po linii prostej do najbliższej stacji metra, domyślnie 1000 m.</small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxMetroDistanceMeters)}
                  onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, maxMetroDistanceMeters: Number(event.target.value) || 0 } }))}
                  placeholder="Metro do, m"
                />
              </label>
            </div>
            <div className="dream-preferences" aria-label="Dodatkowe wymagania">
            <label className="dream-toggle">
              <input
                type="checkbox"
                checked={local.dreamProfile.requiresGarage}
                onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, requiresGarage: event.target.checked } }))}
              />
              <span>Garaż</span>
            </label>
            <label className="dream-toggle">
              <input
                type="checkbox"
                checked={local.dreamProfile.prefersBalcony}
                onChange={(event) => setLocal((current) => ({ ...current, dreamProfile: { ...current.dreamProfile, prefersBalcony: event.target.checked } }))}
              />
              <span>Balkon</span>
            </label>
            </div>
          </div>
        </section>

        {input.saveError ? <div className="settings-save-error" role="alert"><CircleAlert size={18} aria-hidden="true" /><span><strong>Nie udało się zapisać ustawień.</strong>{input.saveError}</span></div> : null}
        <div className="settings-save-bar">
          <p>Zmiany zaczną obowiązywać po zapisaniu.</p>
          <div>
            <button className="action-button secondary-button" type="button" onClick={input.onClose}><X size={17} aria-hidden="true" /> Anuluj</button>
            <button className="action-button" disabled={input.isSaving} onClick={() => void input.onSave(settingsWithPendingDreamLocation())}>
              {input.isSaving ? <LoaderCircle size={17} className="icon-spin" aria-hidden="true" /> : <ClipboardCheck size={17} aria-hidden="true" />} {input.isSaving ? "Zapisywanie…" : "Zapisz ustawienia"}
            </button>
          </div>
        </div>
      </section>
    </aside>
  );
}

function CalendarPanel(input: {
  upcomingViewings: UpcomingViewingsResponse;
  onClose: () => void;
  onOpenListing: (listingId: string) => void | Promise<void>;
}) {
  return (
    <aside className="detail-overlay" onClick={input.onClose}>
      <section className="detail-panel settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div><p className="eyebrow">Kalendarz</p><h2>Najblizsze wizyty</h2></div>
          <button className="action-button secondary-button" onClick={input.onClose}>Zamknij</button>
        </div>
        <div className="calendar-grid">
          {input.upcomingViewings.items.length > 0 ? input.upcomingViewings.items.map((viewing) => (
            <article key={viewing.id} className="calendar-card" onClick={() => void input.onOpenListing(viewing.listingId)}>
              <span>{formatViewingDate(viewing.scheduledAt)}</span>
              <strong>{viewing.listingTitle}</strong>
              <p>{viewing.city}{viewing.district ? ` / ${viewing.district}` : ""}</p>
              <p>{viewing.addressText ?? "Brak adresu"}</p>
              {viewing.notes ? <p className="muted">{viewing.notes}</p> : null}
            </article>
          )) : <div className="result-box">Brak zaplanowanych oglądań.</div>}
        </div>
      </section>
    </aside>
  );
}

function ListingTransitMap(input: { listing: Pick<ListingDetail, "id" | "title" | "latitude" | "longitude"> }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const focusedListingIdRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [tramStops, setTramStops] = useState<Array<MapCoordinate & { routes: string[] }>>([]);
  const [railwayMap, setRailwayMap] = useState<{ stations: Array<MapCoordinate & { kind?: string }>; lines: Array<Array<[number, number]>> } | null>(null);
  const latitude = input.listing.latitude!;
  const longitude = input.listing.longitude!;

  useEffect(() => {
    let cancelled = false;
    setMapError(null);
    void ensureLeafletLoaded().then(() => {
      if (cancelled || !mapContainerRef.current || !window.L || mapRef.current) return;
      mapRef.current = window.L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: false, preferCanvas: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([latitude, longitude], 14);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(mapRef.current);
      layerRef.current = window.L.layerGroup().addTo(mapRef.current);
      setMapReady(true);
      window.setTimeout(() => mapRef.current?.invalidateSize(), 120);
    }).catch(() => { if (!cancelled) setMapError("Nie udało się załadować mapy. Sprawdź połączenie i spróbuj ponownie."); });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapAttempt]);


  useEffect(() => {
    void fetch(`${apiBaseUrl}/api/map/railway`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setRailwayMap(data))
      .catch(() => setRailwayMap(null));
    void fetch(`${apiBaseUrl}/api/map/tramway`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setTramStops(data?.stops ?? []))
      .catch(() => setTramStops([]));
  }, []);

  useEffect(() => {
    if (!mapReady || !window.L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    if (focusedListingIdRef.current !== input.listing.id) {
      mapRef.current.setView([latitude, longitude], 14);
      focusedListingIdRef.current = input.listing.id;
    }

    const listingMarker = window.L.marker([latitude, longitude], {
      zIndexOffset: 1000,
      icon: window.L.divIcon({
        className: "leaflet-detail-listing-marker",
        html: mapLocationIconHtml,
        iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -26]
      })
    });
    listingMarker.bindPopup(`<strong>${escapeHtml(input.listing.title)}</strong>`).addTo(layerRef.current);

    const railwayStations = new Map<string, MapCoordinate>();
    const railLines = railwayMap?.lines ?? warsawRailLines.map((line) => line.stations.map((station) => [station.latitude, station.longitude] as [number, number]));
    const railStations = railwayMap?.stations ?? warsawRailLines.flatMap((line) => line.stations);
    for (const line of railLines) window.L.polyline(line, { color: "#17202a", weight: 2.5, opacity: 0.76 }).addTo(layerRef.current);
    for (const station of railStations) railwayStations.set(`${station.latitude.toFixed(5)}:${station.longitude.toFixed(5)}`, station);
    for (const station of railwayStations.values()) {
      const marker = window.L.circleMarker([station.latitude, station.longitude], { radius: 5, color: "#fff", weight: 1.5, fillColor: "#17202a", fillOpacity: 0.95 });
      marker.bindPopup(`<strong>${escapeHtml(station.name)}</strong><br/>PKP / SKM / KM / WKD`).addTo(layerRef.current);
    }

    const metroStations = new Map<string, { latitude: number; longitude: number; codes: string[]; names: string[] }>();
    for (const line of warsawMetroLines) {
      for (const station of line.stations) {
        const key = `${station.latitude.toFixed(6)}:${station.longitude.toFixed(6)}`;
        const group = metroStations.get(key) ?? { latitude: station.latitude, longitude: station.longitude, codes: [], names: [] };
        group.codes.push(line.code);
        group.names.push(station.name);
        metroStations.set(key, group);
      }
    }
    for (const station of metroStations.values()) {
      const codes = [...new Set(station.codes)];
      const marker = window.L.marker([station.latitude, station.longitude], {
        zIndexOffset: 500,
        icon: window.L.divIcon({ className: `leaflet-metro-marker leaflet-metro-${codes[0].toLowerCase()}${codes.length > 1 ? " is-interchange" : ""}`, html: `<span>${codes.join("/")}</span>`, iconSize: [codes.length > 1 ? 43 : 27, 27], iconAnchor: [codes.length > 1 ? 21 : 13, 13], popupAnchor: [0, -15] })
      });
      marker.bindPopup(`<strong>Metro ${codes.join("/")}</strong><br/>${station.names.map(escapeHtml).join("<br/>")}`).addTo(layerRef.current);
    }

    for (const stop of tramStops) {
      const marker = window.L.circleMarker([stop.latitude, stop.longitude], { radius: 5, color: "#fff", weight: 1.5, fillColor: "#55b8ea", fillOpacity: 0.95 });
      marker.bindPopup(`<strong>${escapeHtml(stop.name)}</strong><br/><small>Tramwaje: ${escapeHtml(stop.routes.join(", ") || "brak danych o linii")}</small>`).addTo(layerRef.current);
    }
    window.setTimeout(() => mapRef.current?.invalidateSize(), 60);
  }, [input.listing.id, input.listing.title, latitude, longitude, mapReady, railwayMap, tramStops]);

  useMapResize(mapContainerRef, mapRef, mapReady);
  return <FullscreenFrame label="Mapa otoczenia oferty" className="listing-map-shell">
    {mapError ? <div className="map-load-error" role="alert"><p>{mapError}</p><button className="action-button secondary-button" onClick={() => setMapAttempt((attempt) => attempt + 1)}>Ponów ładowanie mapy</button></div> : null}
    <div ref={mapContainerRef} className="listing-map listing-transit-map" aria-label="Mapa oferty z metrem i przystankami tramwajowymi" />
  </FullscreenFrame>;
}

function mapDistanceMeters(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(toLatitude - fromLatitude);
  const dLng = radians(toLongitude - fromLongitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h));
}

function buildMapListingPreview(listing: ListingSummary) {
  const location = [listing.district, listing.neighborhood].filter(Boolean).join(" · ") || listing.city;
  const details = [listing.areaLabel, listing.roomsCount ? `${listing.roomsCount} pok.` : undefined].filter(Boolean).join(" · ");
  const image = listing.thumbnailUrl
    ? `<img class="map-offer-preview-image" src="${escapeHtml(listing.thumbnailUrl)}" alt="" loading="lazy" />`
    : `<div class="map-offer-preview-image map-offer-preview-empty">Brak zdjęcia</div>`;
  const accuracy = listing.coordinateAccuracy === "approximate" ? `<span class="map-offer-preview-accuracy">Punkt orientacyjny</span>` : "";
  const source = listing.sourceLabel ? `<span class="map-offer-preview-source">${escapeHtml(listing.sourceLabel)}</span>` : "";
  return `<article class="map-offer-preview">
    <div class="map-offer-preview-media">${image}${source}</div>
    <div class="map-offer-preview-body">
      <strong class="map-offer-preview-title">${escapeHtml(listing.title)}</strong>
      <span class="map-offer-preview-location">${escapeHtml(location)}</span>
      <div class="map-offer-preview-metrics"><strong>${escapeHtml(listing.priceLabel)}</strong>${details ? `<span>${escapeHtml(details)}</span>` : ""}</div>
      ${accuracy}<span class="map-offer-preview-hint">Kliknij, żeby otworzyć ofertę</span>
    </div>
  </article>`;
}

function MapView(input: {
  listings: ListingSummary[];
  selectedListingId?: string;
  onOpen: (listingId: string) => void | Promise<void>;
  workplaces?: FamilySettings["workplaces"];
  isLoading: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const onOpenRef = useRef(input.onOpen);
  const hasFittedInitialBoundsRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  useMapResize(mapContainerRef, mapRef, mapReady);
  const [maximumPrice, setMaximumPrice] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [rooms, setRooms] = useState<number[]>([]);
  const [maximumAgeDays, setMaximumAgeDays] = useState("");
  const [minimumArea, setMinimumArea] = useState("");
  const [maximumArea, setMaximumArea] = useState("");
  const [offerSearch, setOfferSearch] = useState("");
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const [railwayMap, setRailwayMap] = useState<{ stations: Array<MapCoordinate & { kind?: string }>; lines: Array<Array<[number, number]>> } | null>(null);
  const [tramwayMap, setTramwayMap] = useState<{ stops: Array<MapCoordinate & { routes: string[] }>; routes: Array<{ id: string; ref: string; name: string; colour?: string; lines: Array<Array<[number, number]>> }> } | null>(null);
  const [transitLayerVisibility, setTransitLayerVisibility] = useState({ metro: true, railway: true, tramway: true });
  const [selectedTramRoute, setSelectedTramRoute] = useState<string | null>(null);
  onOpenRef.current = input.onOpen;
  const hasListingFilters = Boolean(minimumPrice || maximumPrice || rooms.length || maximumAgeDays || minimumArea || maximumArea || offerSearch.trim());
  const geoListings = useMemo(() => !hasListingFilters ? [] : input.listings
    .filter((listing) => isValidMapPoint(listing.latitude, listing.longitude))
    .filter((listing) => {
      const price = listingPriceAmount(listing.priceLabel);
      const area = Number.parseFloat((listing.areaLabel ?? "").replace(",", "."));
      const publishedAt = listing.publishedAt ?? listing.firstSeenAt;
      const ageDays = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / 86_400_000 : undefined;
      const searchable = `${listing.title} ${listing.addressText ?? ""} ${listing.district} ${listing.city}`.toLocaleLowerCase("pl-PL");
      return (!minimumPrice || (price !== null && price >= Number(minimumPrice)))
        && (!maximumPrice || (price !== null && price <= Number(maximumPrice)))
        && (!rooms.length || (listing.roomsCount !== undefined && rooms.includes(listing.roomsCount)))
        && (!maximumAgeDays || (ageDays !== undefined && ageDays <= Number(maximumAgeDays)))
        && (!minimumArea || (Number.isFinite(area) && area >= Number(minimumArea.replace(",", "."))))
        && (!maximumArea || (Number.isFinite(area) && area <= Number(maximumArea.replace(",", "."))))
        && (!offerSearch.trim() || searchable.includes(offerSearch.trim().toLocaleLowerCase("pl-PL")));
    }), [input.listings, hasListingFilters, minimumPrice, maximumPrice, rooms, maximumAgeDays, minimumArea, maximumArea, offerSearch]);
  const geoWorkplaces = useMemo(() => (input.workplaces ?? []).filter((workplace) => isValidMapPoint(workplace.latitude, workplace.longitude)), [input.workplaces]);
  const activeFilters = [minimumPrice ? `od ${Number(minimumPrice).toLocaleString("pl-PL")} PLN` : "", maximumPrice ? `do ${Number(maximumPrice).toLocaleString("pl-PL")} PLN` : "", rooms.length ? `${rooms.join(", ")} pokoje` : "", maximumAgeDays ? `do ${maximumAgeDays} dni` : ""].filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    setMapError(null);
    void ensureLeafletLoaded().then(() => {
      if (cancelled || !mapContainerRef.current || !window.L || mapRef.current) return;
      mapRef.current = window.L.map(mapContainerRef.current, { preferCanvas: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([52.2297, 21.0122], 11);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(mapRef.current);
      layerRef.current = window.L.layerGroup().addTo(mapRef.current);
      setMapReady(true);
      window.setTimeout(() => mapRef.current?.invalidateSize(), 120);
    }).catch(() => { if (!cancelled) setMapError("Nie udało się załadować mapy. Sprawdź połączenie i spróbuj ponownie."); });
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [mapAttempt]);

  useEffect(() => {
    void fetch(`${apiBaseUrl}/api/map/railway`).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setRailwayMap(data); }).catch(() => undefined);
    void fetch(`${apiBaseUrl}/api/map/tramway`).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setTramwayMap(data); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mapReady || !window.L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const bounds: Array<[number, number]> = [];
    for (const district of warsawDistrictCoordinates) {
      const marker = window.L.marker([district.latitude, district.longitude], {
        interactive: false,
        icon: window.L.divIcon({ className: "leaflet-district-label", html: `<span>${escapeHtml(district.name)}</span>`, iconSize: [88, 20], iconAnchor: [44, 10] })
      });
      marker.addTo(layerRef.current);
    }
    if (transitLayerVisibility.railway) {
    const railMarkers = new Map<string, MapCoordinate>();
    const railLines = railwayMap?.lines ?? warsawRailLines.map((line) => line.stations.map((station) => [station.latitude, station.longitude] as [number, number]));
    const railStations = railwayMap?.stations ?? warsawRailLines.flatMap((line) => line.stations);
    for (const line of railLines) window.L.polyline(line, { className: "rail-line", color: "#34404d", weight: 3, opacity: 0.85 }).addTo(layerRef.current);
    for (const station of railStations) {
      railMarkers.set(`${station.latitude.toFixed(5)}:${station.longitude.toFixed(5)}`, station);
    }
    for (const station of railMarkers.values()) {
      const marker = window.L.marker([station.latitude, station.longitude], { zIndexOffset: 350, icon: window.L.divIcon({ className: "leaflet-rail-marker", html: "<span>●</span>", iconSize: [13, 13], iconAnchor: [6, 6], popupAnchor: [0, -9] }) });
      marker.bindPopup(`<strong>${escapeHtml(station.name)}</strong><br/>PKP / SKM / KM / WKD`);
      marker.bindTooltip(escapeHtml(station.name), { direction: "top", offset: [0, -7] });
      marker.addTo(layerRef.current);
    }
    }

    if (transitLayerVisibility.tramway) {
      const tramStops = new Map<string, MapCoordinate & { routes: string[] }>();
      const visibleTramRoutes = selectedTramRoute ? (tramwayMap?.routes ?? []).filter((route) => route.ref === selectedTramRoute) : (tramwayMap?.routes ?? []);
      for (const route of visibleTramRoutes) {
        for (const line of route.lines) window.L.polyline(line, { className: selectedTramRoute ? "tram-line is-selected" : "tram-line", color: selectedTramRoute ? "#c8248d" : "#279bc7", weight: selectedTramRoute ? 5 : 3, opacity: selectedTramRoute ? 0.96 : 0.76 }).addTo(layerRef.current);
      }
      for (const stop of tramwayMap?.stops ?? []) tramStops.set(`${stop.latitude.toFixed(5)}:${stop.longitude.toFixed(5)}`, stop);
      for (const stop of tramStops.values()) {
        const marker = window.L.circleMarker([stop.latitude, stop.longitude], { radius: 6, className: "leaflet-tram-stop-dot", color: "#fff", weight: 2, fillColor: "#55b8ea", fillOpacity: 0.95 });
        const routeButtons = stop.routes.map((route) => `<button type="button" class="tram-route-button" data-tram-route="${escapeHtml(route)}">${escapeHtml(route)}</button>`).join("");
        marker.bindPopup(`<strong>${escapeHtml(stop.name)}</strong><br/><small>Tramwaje: ${routeButtons || "brak danych o linii"}</small>`);
        marker.on("popupopen", () => {
          const popupElement = marker.getPopup()?.getElement() as HTMLElement | undefined;
          for (const element of Array.from(popupElement?.querySelectorAll("[data-tram-route]") ?? [])) {
            const button = element as HTMLButtonElement;
            button.addEventListener("click", () => setSelectedTramRoute(button.dataset.tramRoute ?? null));
          }
        });
        marker.bindTooltip(escapeHtml(stop.name), { direction: "top", offset: [0, -9] });
        marker.addTo(layerRef.current);
      }
    }

    if (transitLayerVisibility.metro) {
    const metroMarkers = new Map<string, { latitude: number; longitude: number; stations: Array<{ code: MetroMapLine["code"]; name: string; planned: boolean }> }>();
    for (const line of warsawMetroLines) {
      const points = line.stations.map((station) => [station.latitude, station.longitude]);
      window.L.polyline(points, { color: metroLineColors[line.code], className: `metro-line metro-line-${line.code.toLowerCase()}${line.planned ? " metro-line-planned" : ""}`, weight: line.planned ? 3 : 4, opacity: line.planned ? 0.8 : 0.95, dashArray: line.planned ? "7 6" : undefined }).addTo(layerRef.current);
      for (const station of line.stations) {
        const key = `${station.latitude.toFixed(6)}:${station.longitude.toFixed(6)}`;
        const marker = metroMarkers.get(key) ?? { latitude: station.latitude, longitude: station.longitude, stations: [] };
        marker.stations.push({ code: line.code, name: station.name, planned: Boolean(line.planned) });
        metroMarkers.set(key, marker);
      }
    }
    for (const stationGroup of metroMarkers.values()) {
      const codes = [...new Set(stationGroup.stations.map((station) => station.code))];
      const isPlanned = stationGroup.stations.every((station) => station.planned);
      const marker = window.L.marker([stationGroup.latitude, stationGroup.longitude], {
        zIndexOffset: isPlanned ? 400 : 500,
        icon: window.L.divIcon({ className: `leaflet-metro-marker leaflet-metro-${codes[0].toLowerCase()}${isPlanned ? " is-planned" : ""}${codes.length > 1 ? " is-interchange" : ""}`, html: `<span>${codes.join("/")}</span>`, iconSize: [codes.length > 1 ? 43 : 27, 27], iconAnchor: [codes.length > 1 ? 21 : 13, 13], popupAnchor: [0, -15] })
      });
      marker.bindPopup(stationGroup.stations.map((station) => `<strong>${station.code}${station.planned ? " (planowana)" : ""}</strong><br/>${escapeHtml(station.name)}`).join("<hr/>"));
      marker.addTo(layerRef.current);
    }
    }
    for (const listing of geoListings) {
      const markerClass = listing.priceChangePercent < 0
        ? "leaflet-price-down-marker"
        : listing.priceChangePercent > 0
          ? "leaflet-price-up-marker"
          : "leaflet-default-marker";
      const marker = window.L.marker([listing.latitude, listing.longitude], {
        icon: window.L.divIcon({
          className: `${markerClass}${listing.isShortlisted ? " is-shortlisted" : ""}`,
          html: listing.isShortlisted ? mapOfferIconHtml.shortlisted : mapOfferIconHtml.regular,
          iconSize: [30, 38],
          iconAnchor: [15, 38],
          popupAnchor: [0, -24]
        })
      });
      marker.on("click", () => { void onOpenRef.current(listing.id); });
      const preview = buildMapListingPreview(listing);
      marker.bindPopup(preview, { className: "listing-map-popup", minWidth: 350, maxWidth: 390, keepInView: true });
      marker.bindTooltip(preview, { className: "listing-map-tooltip", direction: "top", offset: [0, -28], opacity: 1, sticky: true });
      marker.addTo(layerRef.current);
      bounds.push([listing.latitude!, listing.longitude!]);
    }

    for (const workplace of geoWorkplaces) {
      const label = workplace.key === "user-office" ? "L" : workplace.key === "spouse-office" ? "K" : workplace.label.charAt(0).toUpperCase();
      const marker = window.L.marker([workplace.latitude, workplace.longitude], {
        zIndexOffset: 1000,
        icon: window.L.divIcon({
          className: "leaflet-work-marker",
          html: `<span>${label}</span>`,
          iconSize: [20, 30],
          iconAnchor: [10, 30],
          popupAnchor: [0, -24]
        })
      });

      marker.bindPopup(`<strong>${escapeHtml(workplace.label)}</strong><br/>${escapeHtml(workplace.address)}`);
      marker.addTo(layerRef.current);
      bounds.push([workplace.latitude!, workplace.longitude!]);
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 60);
    if (bounds.length > 0 && !hasFittedInitialBoundsRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [36, 36] });
      hasFittedInitialBoundsRef.current = true;
    } else if (bounds.length === 0 && !hasFittedInitialBoundsRef.current) {
      mapRef.current.setView([52.2297, 21.0122], 11);
    }
  }, [geoListings, geoWorkplaces, mapReady, railwayMap, tramwayMap, transitLayerVisibility, selectedTramRoute]);

  useEffect(() => {
    const timeout = window.setTimeout(() => mapRef.current?.invalidateSize(), 180);
    return () => window.clearTimeout(timeout);
  }, [geoListings.length, geoWorkplaces.length, input.selectedListingId]);

  return (
    <>
      <section className="map-filter-shell">
      <div className="map-filter-heading"><div><p className="eyebrow">Widok mapy</p><h3>Znajdź oferty na mapie</h3><p>Ustaw przynajmniej jeden filtr, żeby pokazać dopasowane punkty.</p></div><div><span className="map-result-count">{geoListings.length} ofert</span><button className="action-button secondary-button map-filter-toggle" type="button" onClick={() => setMapFiltersOpen((current) => !current)}><SlidersHorizontal size={17} aria-hidden="true" /> {mapFiltersOpen ? "Ukryj filtry" : "Pokaż filtry"}</button></div></div>
      <div className={mapFiltersOpen ? "map-filter-panel is-open" : "map-filter-panel"} aria-label="Filtry ofert na mapie">
        <label className="map-search-field"><span>Szukaj w ofertach</span><input className="text-input" value={offerSearch} placeholder="tytuł, ulica, dzielnica" onChange={(event) => setOfferSearch(event.target.value)} /></label>
        <label><span>Cena od</span><input className="text-input" inputMode="numeric" value={minimumPrice} placeholder="np. 700 000" onChange={(event) => setMinimumPrice(event.target.value.replace(/\D/g, ""))} /></label>
        <label><span>Cena do</span><input className="text-input" inputMode="numeric" value={maximumPrice} placeholder="np. 1 500 000" onChange={(event) => setMaximumPrice(event.target.value.replace(/\D/g, ""))} /></label>
        <fieldset className="map-room-filters"><legend>Pokoje</legend>{[1, 2, 3, 4, 5, 6].map((count) => <label key={count}><input type="checkbox" checked={rooms.includes(count)} onChange={() => setRooms((current) => current.includes(count) ? current.filter((value) => value !== count) : [...current, count])} /> {count}</label>)}</fieldset>
        <label><span>Nowe dane</span><select className="text-input" value={maximumAgeDays} onChange={(event) => setMaximumAgeDays(event.target.value)}><option value="">Dowolnie</option><option value="1">do 1 dnia</option><option value="5">do 5 dni</option><option value="14">do 14 dni</option><option value="30">do 30 dni</option></select></label>
        <label><span>Metraż od</span><input className="text-input" inputMode="decimal" value={minimumArea} placeholder="np. 50" onChange={(event) => setMinimumArea(event.target.value.replace(/[^\d,.]/g, ""))} /></label>
        <label><span>Metraż do</span><input className="text-input" inputMode="decimal" value={maximumArea} placeholder="np. 90" onChange={(event) => setMaximumArea(event.target.value.replace(/[^\d,.]/g, ""))} /></label>
        <fieldset className="map-transit-filters"><legend>Transport</legend>
          <label><input type="checkbox" checked={transitLayerVisibility.metro} onChange={(event) => setTransitLayerVisibility((current) => ({ ...current, metro: event.target.checked }))} /> Metro</label>
          <label><input type="checkbox" checked={transitLayerVisibility.railway} onChange={(event) => setTransitLayerVisibility((current) => ({ ...current, railway: event.target.checked }))} /> Pociągi</label>
          <label><input type="checkbox" checked={transitLayerVisibility.tramway} onChange={(event) => setTransitLayerVisibility((current) => ({ ...current, tramway: event.target.checked }))} /> Tramwaje</label>
        </fieldset>
        {selectedTramRoute ? <button className="action-button secondary-button" type="button" onClick={() => setSelectedTramRoute(null)}>Pokaż wszystkie tramwaje</button> : null}
        {hasListingFilters ? <button className="action-button secondary-button" type="button" onClick={() => { setOfferSearch(""); setMinimumPrice(""); setMaximumPrice(""); setRooms([]); setMaximumAgeDays(""); setMinimumArea(""); setMaximumArea(""); }}>Wyczyść</button> : null}
      </div>
      </section>
    <div className="map-layout">
      <FullscreenFrame label="Mapa ofert" className="map-canvas-wrap">
    {mapError ? <div className="map-load-error" role="alert"><p>{mapError}</p><button className="action-button secondary-button" onClick={() => setMapAttempt((attempt) => attempt + 1)}>Ponów ładowanie mapy</button></div> : null}
        <div ref={mapContainerRef} className="map-canvas" />
        <details className="map-legend" aria-label="Legenda mapy" open={window.innerWidth > 700}>
          <summary>Legenda · oferty i transport</summary>
          <div className="map-legend-items">
          <span><i className="map-legend-dot map-flat" /> Bez zmiany</span>
          <span><i className="map-legend-dot map-down" /> Cena spadła</span>
          <span><i className="map-legend-dot map-up" /> Cena wzrosła</span>
          <span><i className="map-legend-star">&#9733;</i> Ulubione</span>
          {(["M1", "M2", "M3", "M4", "M5"] as const).map(code => <span key={code}><i className={`metro-legend-badge metro-legend-${code.toLowerCase()}`}>{code}</i>{code === "M1" ? "Istniejąca" : code === "M2" ? "Istniejąca + rozbudowa" : "Planowana"}</span>)}
          <span><i className="map-legend-planned-line" /> Linia przerywana: plan / budowa</span>
          <span><i className="rail-legend-line" /> PKP / SKM / KM / WKD</span>
          <span><i className="tram-legend-line" /> Tramwaje</span>
          </div>
        </details>
        <p className="map-caption">{input.isLoading ? "Ładowanie wszystkich ofert na mapę..." : `${geoListings.length} ofert z geokodem${geoWorkplaces.length ? ` · ${geoWorkplaces.length} punktów pracy` : ""}`}</p>
      </FullscreenFrame>
      <div className="map-list">
        <div className="result-box">
          <strong>Widoczne punkty</strong>
          <p>Oferty z geokodem: {geoListings.length}</p>
          <p>Punkty pracy z geokodem: {geoWorkplaces.length}</p>
          {activeFilters.length > 0 ? (
            <div className="active-filters">
              {activeFilters.map((filter) => <span key={filter} className="active-filter-chip">{filter}</span>)}
            </div>
          ) : null}
        </div>
        {geoWorkplaces.map((workplace) => {
          const label = workplace.key === "user-office" ? "L" : workplace.key === "spouse-office" ? "K" : workplace.label.charAt(0).toUpperCase();
          return (
            <article key={workplace.key} className="map-card">
              <div className="map-card-row">
                <strong>{label}</strong>
                <span>{workplace.label}</span>
              </div>
              <p className="muted">{workplace.address}</p>
            </article>
          );
        })}
        {geoListings.map((listing) => (
          <article key={listing.id} className={listing.id === input.selectedListingId ? "map-card active" : "map-card"}>
            <div className="map-card-row">
              <button className="map-card-title" onClick={() => void input.onOpen(listing.id)}>{listing.title}</button>
              <span>{listing.isShortlisted ? "S" : "O"}</span>
            </div>
            <p className="muted">{listing.district}{listing.neighborhood ? ` / ${listing.neighborhood}` : ""}</p>
            <p className="muted">{listing.priceLabel}</p>
            <ListingBadgeRow badges={(listing.badges ?? []).slice(0, 3)} />
          </article>
        ))}
      </div>
    </div>
    </>
  );
}

function ListingDescription({ value }: { value?: string }) {
  const paragraphs = (value ?? "Brak opisu.")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return <div className="listing-description">{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{highlightListingDescription(paragraph, index)}</p>)}</div>;
}

function highlightListingDescription(value: string, paragraphIndex: number) {
  return getDescriptionHighlightParts(value).map((part, index) => part.tone
    ? <strong className={`listing-description-highlight ${part.tone}`} key={`${paragraphIndex}-${index}`}>{part.text}</strong>
    : part.text);
}

function filterImageBadges(badges: string[]) {
  return badges.filter((badge) => filterCommercialBadges([badge]).length > 0 || filterImageAmenityBadge(badge));
}

function getRcnIndicator(label: string) {
  if (!label || label === "brak danych RCN") return null;
  return label.startsWith("-") ? "is-below" : label.startsWith("+") ? "is-above" : null;
}

function Shell({ title, subtitle, error, onRetry }: { title: string; subtitle: string; error?: boolean; onRetry?: () => void }) {
  return (
    <main className="startup-shell">
      <section className={`startup-card ${error ? "is-error" : ""}`} aria-busy={!error}>
        <div className="startup-brand"><Building2 size={22} aria-hidden="true" /> Mieszkania</div>
        <div className="startup-symbol">{error ? <WifiOff size={32} aria-hidden="true" /> : <LoaderCircle size={32} className="icon-spin" aria-hidden="true" />}</div>
        <p className="eyebrow">{error ? "Połączenie przerwane" : "Twój przegląd rynku"}</p>
        <h1>{error ? "Jeszcze chwila — wrócimy do mieszkań" : "Przygotowujemy Twoje oferty"}</h1>
        <p className="startup-copy" role={error ? "alert" : "status"}>{error ? "Nie możemy teraz pobrać danych. Spróbuj połączyć się ponownie." : "Wczytujemy oferty, zapisane kryteria i ustawienia."}</p>
        {onRetry ? <button className="action-button" onClick={onRetry}><RefreshCw size={18} aria-hidden="true" /> Spróbuj ponownie</button> : <div className="startup-progress" aria-hidden="true"><i /></div>}
        {error ? <details className="startup-details"><summary>Szczegóły połączenia</summary><p>{subtitle}</p></details> : null}
      </section>
    </main>
  );
}

function toOptionalNumber(value: string) {
  const numeric = Number(value);
  return value === "" || Number.isNaN(numeric) ? undefined : numeric;
}

function stringValue(value?: number) {
  return value === undefined ? "" : String(value);
}

function toContactStatus(value: string): ListingContactStatus | undefined {
  const allowed: ListingContactStatus[] = ["new", "contacted", "negotiating", "viewing_scheduled", "rejected", "closed"];
  return allowed.includes(value as ListingContactStatus) ? (value as ListingContactStatus) : undefined;
}

function contactStatusDisplay(status?: ListingContactStatus) {
  if (!status) {
    return "-";
  }

  return (
    {
      new: "Nowa",
      contacted: "Po kontakcie",
      negotiating: "W negocjacjach",
      viewing_scheduled: "Oglądanie umówione",
      rejected: "Odrzucone",
      closed: "Zamkniete"
    } satisfies Record<ListingContactStatus, string>
  )[status];
}

function createEmptyContactEventDraft(contactName?: string) {
  return {
    eventType: "call" as ListingContactEventType,
    occurredAt: toDatetimeInputValue(new Date().toISOString()),
    title: "",
    notes: "",
    contactName: contactName ?? "",
    amount: ""
  };
}

function toDecisionStage(value: string): ListingDetail["manual"]["decisionStage"] {
  const allowed: NonNullable<ListingDetail["manual"]["decisionStage"]>[] = ["new", "to_call", "after_call", "to_viewing", "after_viewing", "to_offer", "rejected", "bought"];
  return allowed.includes(value as NonNullable<ListingDetail["manual"]["decisionStage"]>)
    ? (value as NonNullable<ListingDetail["manual"]["decisionStage"]>)
    : undefined;
}

function decisionStageDisplay(stage?: ListingSummary["decisionStage"]) {
  if (!stage) {
    return "-";
  }

  return (
    {
      new: "Nowa",
      to_call: "Do telefonu",
      after_call: "Po rozmowie",
      to_viewing: "Do ogladania",
      after_viewing: "Po ogladaniu",
      to_offer: "Do oferty",
      rejected: "Odrzucona",
      bought: "Kupiona"
    } satisfies Record<NonNullable<ListingSummary["decisionStage"]>, string>
  )[stage];
}

function buildListingInsights(
  stats: DashboardStat[],
  dashboardListings: ListingSummary[]
) {
  void dashboardListings;
  return stats;
}

function buildMultiPortalSyncSummary(input: {
  discoverAllResult: OtodomDiscoverAllResponse | null;
  gratkaDiscoverAllResult: OtodomDiscoverAllResponse | null;
  olxDiscoverAllResult: OtodomDiscoverAllResponse | null;
  queueProcessResult: OtodomQueueProcessResponse | null;
  gratkaQueueProcessResult: OtodomQueueProcessResponse | null;
  olxQueueProcessResult: OtodomQueueProcessResponse | null;
  runAllResult: OtodomRunAllResponse | null;
  gratkaRunAllResult: OtodomRunAllResponse | null;
  mediaBackfillResult: MediaBackfillResponse | null;
}) {
  const summary: Array<{ label: string; value: string }> = [];

  if (input.discoverAllResult || input.gratkaDiscoverAllResult || input.olxDiscoverAllResult) {
    summary.push({
      label: "Discovery",
      value: `${(input.discoverAllResult?.queued ?? 0) + (input.gratkaDiscoverAllResult?.queued ?? 0) + (input.olxDiscoverAllResult?.queued ?? 0)} dodanych do kolejek`
    });
  }

  if (input.queueProcessResult || input.gratkaQueueProcessResult || input.olxQueueProcessResult) {
    summary.push({
      label: "Process queue",
      value: `${(input.queueProcessResult?.completed ?? 0) + (input.gratkaQueueProcessResult?.completed ?? 0) + (input.olxQueueProcessResult?.completed ?? 0)} OK / ${(input.queueProcessResult?.failed ?? 0) + (input.gratkaQueueProcessResult?.failed ?? 0) + (input.olxQueueProcessResult?.failed ?? 0)} fail`
    });
  }

  if (input.runAllResult || input.gratkaRunAllResult) {
    summary.push({
      label: "Run all",
      value: `${(input.runAllResult?.totalCompleted ?? 0) + (input.gratkaRunAllResult?.totalCompleted ?? 0)} completed, ${(input.runAllResult?.totalFailed ?? 0) + (input.gratkaRunAllResult?.totalFailed ?? 0)} failed`
    });
  }

  if (input.mediaBackfillResult) {
    summary.push({
      label: "Brakujące zdjęcia",
      value: `${input.mediaBackfillResult.downloaded} pobranych / ${input.mediaBackfillResult.skipped} pominiętych / ${input.mediaBackfillResult.failed} błędów`
    });
  }

  return summary;
}

function sumQueueCounts(...statuses: Array<OtodomQueueStatusResponse | null>) {
  return {
    pending: statuses.reduce((sum, status) => sum + (status?.counts.pending ?? 0), 0),
    pendingNew: statuses.reduce((sum, status) => sum + (status?.pendingNew ?? 0), 0),
    pendingPriceUpdates: statuses.reduce((sum, status) => sum + (status?.pendingPriceUpdates ?? 0), 0),
    readyPending: statuses.reduce((sum, status) => sum + (status?.readyPending ?? status?.counts.pending ?? 0), 0),
    delayedPending: statuses.reduce((sum, status) => sum + (status?.delayedPending ?? 0), 0),
    processing: statuses.reduce((sum, status) => sum + (status?.counts.processing ?? 0), 0),
    completed: statuses.reduce((sum, status) => sum + (status?.counts.completed ?? 0), 0),
    failed: statuses.reduce((sum, status) => sum + (status?.counts.failed ?? 0), 0)
  };
}

function getNextQueueAttemptAt(...statuses: Array<OtodomQueueStatusResponse | null>) {
  return statuses
    .map((status) => status?.nextAttemptAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

function getNextProcessAttemptAt(...results: OtodomQueueProcessResponse[]) {
  return results
    .map((result) => result.pausedUntil)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

function formatQueueAttemptTime(value: string) {
  return new Date(value).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function formatStaleRefreshTime(value: string, includeDate = false) {
  return new Date(value).toLocaleString("pl-PL", includeDate
    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" });
}


function tabClass(active: boolean) {
  return active ? "tab-button active" : "tab-button";
}

function formatViewingDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatListingDateLabel(listing: Pick<ListingSummary, "publishedAt" | "firstSeenAt">) {
  const value = listing.publishedAt ?? listing.firstSeenAt;
  if (!value) {
    return "Brak daty dodania";
  }

  const label = listing.publishedAt ? "Dodano" : "W bazie od";
  return `${label}: ${new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function formatPriceEvent(event: ListingDetail["priceHistory"][number]) {
  const dateLabel = new Date(event.changedAt).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  if (event.eventType === "created") {
    return `${dateLabel}: dodanie oferty${event.newPriceAmount ? `, cena startowa ${formatPln(event.newPriceAmount)}` : ""}`;
  }

  if (event.eventType === "price_drop") {
    return `${dateLabel}: spadek ceny z ${formatOptionalPln(event.previousPriceAmount)} do ${formatOptionalPln(event.newPriceAmount)}`;
  }

  if (event.eventType === "price_increase") {
    return `${dateLabel}: wzrost ceny z ${formatOptionalPln(event.previousPriceAmount)} do ${formatOptionalPln(event.newPriceAmount)}`;
  }

  if (event.eventType === "relisted") {
    return `${dateLabel}: oferta pojawila sie ponownie${event.newPriceAmount ? `, cena ${formatPln(event.newPriceAmount)}` : ""}`;
  }

  if (event.eventType === "removed") {
    return `${dateLabel}: oferta zniknela z portalu`;
  }

  return `${dateLabel}: ${event.eventType}${event.newPriceAmount ? `, cena ${formatPln(event.newPriceAmount)}` : ""}`;
}

function formatContactEvent(event: ListingDetail["contactHistory"][number]) {
  const dateLabel = new Date(event.occurredAt).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = [`${dateLabel}: ${contactEventTypeLabel(event.eventType)}`];

  if (event.title) {
    parts.push(event.title);
  }

  if (event.contactName) {
    parts.push(`kontakt ${event.contactName}`);
  }

  if (typeof event.amount === "number") {
    parts.push(formatPln(event.amount));
  }

  if (event.notes) {
    parts.push(event.notes);
  }

  return parts.join(" | ");
}

function contactEventTypeLabel(type: ListingContactEventType) {
  return (
    {
      call: "Telefon",
      message: "Wiadomosc",
      email: "E-mail",
      meeting: "Spotkanie",
      viewing_note: "Notatka po ogladaniu",
      negotiation: "Negocjacje",
      status_change: "Zmiana statusu",
      other: "Inne"
    } satisfies Record<ListingContactEventType, string>
  )[type];
}

function formatOptionalPln(value?: number) {
  return typeof value === "number" ? formatPln(value) : "brak";
}

function formatDistance(distanceMeters: number) {
  return distanceMeters < 1_000
    ? `${distanceMeters} m`
    : `${(distanceMeters / 1_000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
}

function formatPln(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0
  }).format(value);
}

function buildOsmSearchHref(listing: Pick<ListingSummary, "street" | "district" | "city" | "addressText">, fallbackQuery?: string) {
  const query = [
    listing.addressText,
    listing.street,
    listing.district,
    listing.city,
    "Polska"
  ].filter(Boolean).join(", ") || fallbackQuery || "Warszawa, Polska";

  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function isGratkaUrl(value: string) {
  try {
    return new URL(value).hostname.includes("gratka");
  } catch {
    return false;
  }
}

function resolveCollectorEndpoint(value: string) {
  try {
    const hostname = new URL(value).hostname;
    if (hostname.includes("nieruchomosci-online")) {
      return `${apiBaseUrl}/api/collectors/nieruchomosci-online/collect-one`;
    }
    if (hostname.includes("domiporta")) {
      return `${apiBaseUrl}/api/collectors/domiporta/collect-one`;
    }
    if (hostname.includes("maxon.pl")) {
      return `${apiBaseUrl}/api/collectors/maxon/collect-one`;
    }
    if (hostname.includes("adresowo.pl")) {
      return `${apiBaseUrl}/api/collectors/adresowo/collect-one`;
    }
    if (hostname.includes("morizon.pl")) {
      return `${apiBaseUrl}/api/collectors/morizon/collect-one`;
    }
    if (hostname.includes("gratka")) {
      return `${apiBaseUrl}/api/collectors/gratka/collect-one`;
    }
    if (hostname.includes("olx")) {
      return `${apiBaseUrl}/api/collectors/olx/collect-one`;
    }
  } catch {
    // fall through to default collector
  }

  return `${apiBaseUrl}/api/collectors/otodom/collect-one`;
}

function isValidMapPoint(latitude?: number, longitude?: number) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  return latitude >= 51.8 && latitude <= 52.5 && longitude >= 20.7 && longitude <= 21.3;
}

function listingPriceAmount(priceLabel: string) {
  const digits = priceLabel.replace(/[^\d]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getActiveFilterBadges(filters: ListingFilters) {
  const badges: string[] = [];

  if (filters.city) badges.push(`Miasto: ${filters.city}`);
  if (filters.district) badges.push(`Dzielnica: ${filters.district}`);
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) badges.push(`Cena: ${filters.minPrice ?? 0}-${filters.maxPrice ?? "max"}`);
  if (filters.minArea !== undefined || filters.maxArea !== undefined) badges.push(`Metraz: ${filters.minArea ?? 0}-${filters.maxArea ?? "max"} m2`);
  if (filters.minYearBuilt !== undefined || filters.maxYearBuilt !== undefined) badges.push(`Rok budowy: ${filters.minYearBuilt ?? "min"}-${filters.maxYearBuilt ?? "max"}`);
  if (filters.roomsMin !== undefined || filters.roomsMax !== undefined) badges.push(`Pokoje: ${filters.roomsMin ?? 0}-${filters.roomsMax ?? "max"}`);
  if (filters.search) badges.push(`Fraza: ${filters.search}`);
  if (filters.shortlistedOnly) badges.push("Tylko ulubione");
  if (filters.priceChangedOnly) badges.push("Tylko zmiana ceny");
  if (filters.archivedOnly) badges.push("Tylko archiwalne");
  if (filters.hiddenOnly) badges.push("Tylko ukryte (2 pokoje)");

  return badges;
}

function resolveCompareListings(compareIds: string[], ...sources: ListingSummary[][]) {
  const byId = new Map<string, ListingSummary>();

  for (const source of sources) {
    for (const listing of source) {
      if (!byId.has(listing.id)) {
        byId.set(listing.id, listing);
      }
    }
  }

  return compareIds.map((id) => byId.get(id)).filter((listing): listing is ListingSummary => Boolean(listing));
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);
  return Array.from({ length: end - normalizedStart + 1 }, (_value, index) => normalizedStart + index);
}

function buildListingPrimaryLocation(listing: ListingSummary) {
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

function buildListingSecondaryLocation(listing: ListingSummary) {
  if (!listing.addressText) {
    return undefined;
  }

  const segments = listing.addressText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return undefined;
  }

  const normalizedPrimary = normalizeComparable(buildListingPrimaryLocation(listing));
  const remaining = segments.filter((segment, index) => {
    if (index === 0 && listing.street) {
      return false;
    }

    return !normalizedPrimary.includes(normalizeComparable(segment));
  });

  const city = normalizeComparable(listing.city ?? "");
  const withoutCity = remaining.filter((segment) => normalizeComparable(segment) !== city);
  return withoutCity.length > 0 ? withoutCity.join(" • ") : undefined;
}

function applyDreamProfile(listings: ListingSummary[], settings: FamilySettings) {
  return listings.map((listing) => {
    // For `dream_desc` the API already calculates and globally sorts the exact
    // score. Do not overwrite it here with the presentation fallback.
    const dreamScore = typeof listing.dreamScore === "number"
      ? listing.dreamScore
      : computeDreamScore(listing, settings.dreamProfile, settings.workplaces);

    return {
      ...listing,
      dreamScore
    };
  });
}

function sortListingsForView(listings: ListingSummary[], sortKey: ListingSortKey) {
  if (sortKey === "dream_desc") {
    return listings;
  }

  return listings;
}

function computeDreamScore(listing: ListingSummary, profile: FamilySettings["dreamProfile"], workplaces: FamilySettings["workplaces"]) {
  const districtNeedle = normalizeLocationComparable(`${listing.district} ${listing.neighborhood ?? ""}`);
  const preferredDistricts = profile.preferredDistricts
    .map((value) => normalizeLocationComparable(value))
    .filter(Boolean);
  const area = parseNumericLabel(listing.areaLabel);
  const price = parseNumericLabel(listing.priceLabel);
  const pricePerSqm = parseNumericLabel(listing.pricePerSqmLabel);
  const rooms = listing.roomsCount;
  let points = 0;
  let maxPoints = 0;

  if (preferredDistricts.length > 0) {
    maxPoints += 20;
    if (preferredDistricts.some((district) => districtNeedle.includes(district) || district.includes(districtNeedle))) {
      points += 20;
    }
  }

  if (profile.minArea > 0 || profile.maxArea > 0) {
    maxPoints += 20;
    if (typeof area === "number") {
      const fitsMin = profile.minArea <= 0 || area >= profile.minArea;
      const fitsMax = profile.maxArea <= 0 || area <= profile.maxArea;
      if (fitsMin && fitsMax) {
        points += 20;
      } else if ((profile.minArea > 0 && area >= profile.minArea - 5) || (profile.maxArea > 0 && area <= profile.maxArea + 5)) {
        points += 10;
      }
    }
  }

  if (profile.minRooms > 0) {
    maxPoints += 18;
    if (typeof rooms === "number") {
      if (rooms === 4) {
        points += 18;
      } else if (rooms > 4) {
        points += 14;
      } else if (rooms >= profile.minRooms) {
        points += 11;
      }
    }
  }

  if (profile.maxPrice > 0) {
    maxPoints += 15;
    if (typeof price === "number") {
      if (price <= profile.maxPrice) {
        points += 15;
      } else if (price <= profile.maxPrice * 1.07) {
        points += 7;
      }
    }
  }

  if (profile.maxPricePerSqm > 0) {
    maxPoints += 20;
    if (typeof pricePerSqm === "number") {
      if (pricePerSqm <= profile.maxPricePerSqm) {
        const discountRatio = Math.min(1, Math.max(0, (profile.maxPricePerSqm - pricePerSqm) / (profile.maxPricePerSqm * 0.25)));
        points += Math.round(6 + discountRatio * 14);
      } else if (pricePerSqm <= profile.maxPricePerSqm * 1.07) {
        points += 3;
      }
    }
  }

  maxPoints += 12;
  if (listing.finishQuality === "ready") {
    points += 12;
  } else if (listing.finishQuality === "unknown") {
    points += 6;
  }

  const garageBonus = profile.requiresGarage ? 20 : 15;
  const garagePenalty = profile.requiresGarage ? 32 : 9;
  maxPoints += garageBonus;
  points += listing.hasGarage ? garageBonus : -garagePenalty;

  maxPoints += 6;
  if (listing.hasStorage) {
    points += 6;
  }

  const liftBonus = 18;
  maxPoints += liftBonus;
  points += listing.hasLift ? liftBonus : -12;

  maxPoints += 10;
  if (listing.hasGarage && listing.hasLift) {
    points += 10;
  }

  if (typeof listing.yearBuilt === "number") {
    maxPoints += 12;
    if (listing.yearBuilt >= 2000) {
      const progress = Math.min(1, (listing.yearBuilt - 2000) / Math.max(1, new Date().getFullYear() - 2000));
      points += 2 + Math.round(progress * 10);
    }
  }

  if (typeof listing.floor === "number") {
    maxPoints += 5;
    if (listing.floor <= 0) {
      points -= 2;
    } else if (typeof listing.totalFloors === "number" && listing.totalFloors > 0) {
      points += listing.floor >= listing.totalFloors ? 5 : Math.max(1, Math.round((listing.floor / listing.totalFloors) * 4));
    } else {
      points += Math.min(5, Math.max(1, listing.floor));
    }
  }

  if (profile.prefersBalcony) {
    maxPoints += 5;
    if (listing.hasBalcony) {
      points += 5;
    }
  }

  const listingText = normalizeListingText(`${listing.title} ${listing.description ?? ""}`);
  if (/\b(?:drewnian\w*\s+(?:podlog\w*|parkiet\w*)|podlog\w*[^.!?;]{0,70}?(?:(?:egzotyczn\w*\s+)?drewn\w*|dab\w*\s+wedzon\w*)|egzotyczn\w*\s+drewn\w*|debow\w*\s+desk\w*|merbau\w*|parkiet\w*|desk\w*\s+podlogow\w*)\b/.test(listingText)) {
    maxPoints += 3;
    points += 3;
  }
  if (/\b(?:ogrzewan\w*\s+podlogow\w*|podlogow\w*\s+ogrzewan\w*)\b/.test(listingText)) {
    maxPoints += 3;
    points += 3;
  }
  if (/\b(?:(?:zaaranzowan\w*|zaprojektowan\w*|urzadzon\w*)\s+przez\s+(?:renomowan\w*\s+)?architekt\w*|projekt\w*\s+architekt\w*)\b/.test(listingText)) {
    maxPoints += 5;
    points += 5;
  }
  if (listing.hasAirConditioning) {
    maxPoints += 4;
    points += 4;
  }

  if (profile.maxMetroDistanceMeters > 0) {
    maxPoints += 10;
    const nearestMetro = findNearestWarsawMetroStation(listing.latitude, listing.longitude);
    if (nearestMetro && nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters) {
      points += 10;
    } else if (nearestMetro && nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters * 1.5) {
      points += 5;
    }
  }

  const commuteDistances = workplaces
    .map((workplace) => straightLineDistanceKm(listing.latitude, listing.longitude, workplace.latitude, workplace.longitude))
    .filter((distance): distance is number => typeof distance === "number");
  if (commuteDistances.length > 0) {
    maxPoints += 12;
    const averageDistance = commuteDistances.reduce((sum, distance) => sum + distance, 0) / commuteDistances.length;
    if (averageDistance <= 7) {
      points += 12;
    } else if (averageDistance <= 12) {
      points += 8;
    } else if (averageDistance <= 18) {
      points += 4;
    }
  }

  // Broker listing without commission is neutral. A commission reduces the
  // effective budget, while a private listing earns a small direct-deal bonus.
  if (listing.badges.includes("Z prowizją")) {
    points -= 12;
  } else if (listing.badges.includes("Oferta prywatna") || listing.badges.includes("Oferta bezpośrednia")) {
    points += 8;
  }

  return maxPoints > 0 ? Math.max(0, Math.round((points / maxPoints) * 100)) : 0;
}

function straightLineDistanceKm(latitude?: number, longitude?: number, targetLatitude?: number, targetLongitude?: number) {
  if ([latitude, longitude, targetLatitude, targetLongitude].some((value) => typeof value !== "number")) {
    return undefined;
  }

  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(targetLatitude! - latitude!);
  const longitudeDelta = toRadians(targetLongitude! - longitude!);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(latitude!)) * Math.cos(toRadians(targetLatitude!)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseNumericLabel(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/-?\d[\d\s.]*(?:,\d+)?/);
  if (!match?.[0]) {
    return undefined;
  }

  const numeric = Number(match[0].replace(/\s+/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeLocationComparable(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bna\b/g, " "],
    [/\bw\b/g, " "],
    [/\bwe\b/g, " "],
    [/\bprzy\b/g, " "],
    [/\bpradze\b/g, "praga"],
    [/\bpoludniu\b/g, "poludnie"],
    [/\bpolnocy\b/g, "polnoc"],
    [/\bsrodmiesciu\b/g, "srodmiescie"],
    [/\bzoliborzu\b/g, "zoliborz"],
    [/\bmokotowie\b/g, "mokotow"],
    [/\bwoli\b/g, "wola"],
    [/\bbemowie\b/g, "bemowo"],
    [/\bbialolece\b/g, "bialoleka"],
    [/\bbielanach\b/g, "bielany"],
    [/\bochocie\b/g, "ochota"],
    [/\bursynowie\b/g, "ursynow"],
    [/\bursusie\b/g, "ursus"],
    [/\bwilanowie\b/g, "wilanow"],
    [/\bwawrze\b/g, "wawer"],
    [/\bwesolej\b/g, "wesola"],
    [/\bwlochach\b/g, "wlochy"],
    [/\bgoclawiu\b/g, "goclaw"],
    [/\bsaskiej kepie\b/g, "saska kepa"],
    [/\bstarych bielanach\b/g, "stare bielany"],
    [/\bstarym mokotowie\b/g, "stary mokotow"],
    [/\bmlocinach\b/g, "mlociny"],
    [/\bkabatach\b/g, "kabaty"],
    [/\bnatolinie\b/g, "natolin"],
    [/\bimielinie\b/g, "imielin"],
    [/\bstoklosach\b/g, "stoklosy"]
  ];

  let normalized = normalizeComparable(value).replace(/-/g, " ");
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function toDatetimeInputValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let leafletLoading: Promise<void> | null = null;
let mapLocationIconHtml = "";
const mapOfferIconHtml = { regular: "", shortlisted: "" };
async function ensureLeafletLoaded() {
  if (window.L && mapLocationIconHtml) return;
  if (leafletLoading) return leafletLoading;
  leafletLoading = Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css"), import("react-dom/server")])
    .then(([leaflet, , { renderToStaticMarkup }]) => {
      window.L = leaflet.default ?? leaflet;
      mapLocationIconHtml = renderToStaticMarkup(<MapPin size={32} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />);
      for (const key of ["regular", "shortlisted"] as const) {
        mapOfferIconHtml[key] = renderToStaticMarkup(<span className="map-marker-icon"><MapPin size={30} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />{key === "shortlisted" ? <Star className="map-marker-star" size={12} fill="currentColor" aria-hidden="true" /> : null}</span>);
      }
    })
    .catch((error) => { leafletLoading = null; throw error; });
  return leafletLoading;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createListingsQuery(filters: ListingFilters, page: number, sort: ListingSortKey) {
  const query = new URLSearchParams();
  const requestFilters: ListingFilters = {
    ...filters,
    page,
    pageSize: listingsPerPage,
    sort
  };

  for (const [key, value] of Object.entries(requestFilters)) {
    if (value !== undefined && value !== "" && value !== false) query.set(key, String(value));
  }
  return query.toString();
}

function readListingsSession(): ListingsSession {
  const fallback: ListingsSession = {
    activeTab: "dashboard",
    filters: defaultFilters,
    listingSort: "newest",
    currentListingsPage: 1
  };

  try {
    const saved = window.sessionStorage.getItem(listingsSessionStorageKey);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      activeTab: isAppTab(parsed.activeTab) ? parsed.activeTab : fallback.activeTab,
      filters: sanitizeListingFilters(parsed.filters),
      listingSort: isListingSortKey(parsed.listingSort) ? parsed.listingSort : fallback.listingSort,
      currentListingsPage: typeof parsed.currentListingsPage === "number" && Number.isInteger(parsed.currentListingsPage) && parsed.currentListingsPage > 0
        ? parsed.currentListingsPage
        : fallback.currentListingsPage
    };
  } catch {
    return fallback;
  }
}

function writeListingsSession(value: ListingsSession) {
  try {
    window.sessionStorage.setItem(listingsSessionStorageKey, JSON.stringify(value));
  } catch {
    // The application remains usable when storage is disabled by the browser.
  }
}

function sanitizeListingFilters(value: unknown): ListingFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultFilters;
  const input = value as Record<string, unknown>;
  const output: ListingFilters = {};
  const stringKeys = ["city", "district", "search"] as const;
  const numberKeys = ["minPrice", "maxPrice", "minArea", "maxArea", "minYearBuilt", "maxYearBuilt", "minPricePerSqm", "maxPricePerSqm", "roomsMin", "roomsMax"] as const;
  const booleanKeys = ["shortlistedOnly", "priceChangedOnly", "archivedOnly", "hiddenOnly", "includeAllCities"] as const;

  for (const key of stringKeys) {
    if (typeof input[key] === "string" && input[key]) output[key] = input[key];
  }
  for (const key of numberKeys) {
    if (typeof input[key] === "number" && Number.isFinite(input[key])) output[key] = input[key];
  }
  for (const key of booleanKeys) {
    if (input[key] === true) output[key] = true;
  }
  return output;
}

function isAppTab(value: unknown): value is AppTab {
  return typeof value === "string" && ["dashboard", "compare", "map", "operations", "backfill", "mortgage", "duplicates", "stats"].includes(value);
}

function isOutboundNetworkError(error?: string) {
  if (!error) return false;
  return /\bEACCES\b|\bEPERM\b|fetch failed|AggregateError|NETWORK_ACCESS_DENIED|connect [A-Z]+ .*:443|Refusing TLS fallback/i.test(error);
}

function friendlyPortalError(error: string) {
  if (isOutboundNetworkError(error)) return "brak połączenia HTTPS";
  return error.length > 120 ? `${error.slice(0, 117)}…` : error;
}

function isListingSortKey(value: unknown): value is ListingSortKey {
  return typeof value === "string" && ["newest", "oldest", "price_desc", "price_asc", "area_desc", "area_asc", "dream_desc"].includes(value);
}
