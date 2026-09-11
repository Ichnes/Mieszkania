import { useScrollSession } from "./useScrollSession";
import { hasActiveMarketFilters } from "../features/statistics/types";
import { hasExposureFilter } from "@mieszkania/shared";
import { apiFetch } from "../shared/lib/http";
import { useStatisticsPreferences } from "../features/statistics/useStatisticsPreferences";
import type {
  AlertsResponse,
  CollectorRunResponse,
  DashboardResponse,
  DuplicateCandidate,
  DuplicateCandidatesResponse,
  FamilySettings,
  ListingContactEventType,
  ListingDetail,
  ListingFilters,
  ListingsResponse,
  ListingSummary,
  MarketStatsResponse,
  SupportedRegion,
  UpcomingViewingsResponse,
} from "@mieszkania/shared";
import { useEffect, useRef, useState } from "react";
import { resolveCompareListings } from "../features/compare/lib/selection";
import { DuplicateGroupOverview } from "../features/duplicates/types";
import { isGratkaUrl, resolveCollectorEndpoint } from "../features/imports/lib/portals";
import { getNextQueueAttemptAt } from "../features/imports/lib/queue";
import { useImportController } from "../features/imports/useImportController";
import { applyDreamProfile } from "../features/listings/lib/dream-profile";
import { buildListingInsights } from "../features/listings/lib/insights";
import { listingHref } from "../features/listings/lib/links";
import { MortgageDraft } from "../features/mortgage/types";
import { MarketStatsFilters } from "../features/statistics/types";
import { apiBaseUrl } from "../shared/lib/api";
import { useAppRoute } from "./routes";
import {
  createListingsQuery,
  listingsPerPage,
  readListingsSession,
  writeListingsSession,
} from "./session";
import { ListingSortKey, LoadState } from "./types";

export function useWorkspaceController() {
  const [initialListingsSession] = useState(readListingsSession);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const { activeTab, setActiveTab, location, navigate } = useAppRoute();
  const [filters, setFilters] = useState<ListingFilters>(initialListingsSession.filters);
  const [filtersPanelCollapsed, setFiltersPanelCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("mieszkania-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [listingSort, setListingSort] = useState<ListingSortKey>(
    initialListingsSession.listingSort,
  );
  const [filteredListings, setFilteredListings] = useState<ListingSummary[]>([]);
  const [mapListings, setMapListings] = useState<ListingSummary[]>([]);
  const [isLoadingMapListings, setIsLoadingMapListings] = useState(false);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [mortgageDraft, setMortgageDraft] = useState<MortgageDraft>({
    principal: 0,
    propertyTotal: 0,
  });
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroupOverview[]>([]);
  const [isLoadingDuplicateGroups, setIsLoadingDuplicateGroups] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<string | null>(null);
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [duplicateTotals, setDuplicateTotals] = useState({ members: 0, copies: 0 });
  const [marketStatsError, setMarketStatsError] = useState<string | null>(null);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [currentListingsPage, setCurrentListingsPage] = useState(
    initialListingsSession.currentListingsPage,
  );
  const listingsMainRef = useRef<HTMLDivElement | null>(null);
  const listingRequest = useRef<{ id: string; controller: AbortController } | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingDetail | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStatsResponse | null>(null);
  const [marketStatsLoading, setMarketStatsLoading] = useState(false);
  const {
    marketStatsFilters,
    setMarketStatsFilters,
    marketStatsDraftFilters,
    setMarketStatsDraftFilters,
    marketStatsPeriod,
    setMarketStatsPeriod,
  } = useStatisticsPreferences();
  const [marketStatsBaseline, setMarketStatsBaseline] = useState<MarketStatsResponse | null>(null);
  const [selectedListingDuplicateCandidates, setSelectedListingDuplicateCandidates] = useState<
    DuplicateCandidate[]
  >([]);
  const [listingOpenError, setListingOpenError] = useState<string | null>(null);
  const [isOpeningListing, setIsOpeningListing] = useState(false);
  const [isLoadingListingInsights, setIsLoadingListingInsights] = useState(false);
  const [isLoadingDuplicateCandidates, setIsLoadingDuplicateCandidates] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [compareSnapshots, setCompareSnapshots] = useState<ListingSummary[]>([]);
  const [compareListingIds, setCompareListingIds] = useState<string[]>([]);
  const [mediaBackfillError, setMediaBackfillError] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isRunningGratkaAll, setIsRunningGratkaAll] = useState(false);
  const [isUpdatingShortlist, setIsUpdatingShortlist] = useState<string | null>(null);
  const [isDismissingListing, setIsDismissingListing] = useState<string | null>(null);
  const [isArchivingListing, setIsArchivingListing] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingListingManual, setIsSavingListingManual] = useState(false);
  const [isSavingContactEvent, setIsSavingContactEvent] = useState(false);
  const [isBackfillingListingMedia, setIsBackfillingListingMedia] = useState<string | null>(null);
  const [isRefreshingListingData, setIsRefreshingListingData] = useState<string | null>(null);
  const [listingRefreshConfirmation, setListingRefreshConfirmation] = useState<{
    listingId: string;
    refreshedAt: Date;
    action: CollectorRunResponse["action"];
  } | null>(null);
  const [isReviewingDuplicatePair, setIsReviewingDuplicatePair] = useState<string | null>(null);
  const initialLoadInFlightRef = useRef(false);
  const {
    refreshQueueStatus,
    refreshStaleListingStatus,
    isProcessingAllPortals,
    staleListingRefresh,
    queueStatus,
    gratkaQueueStatus,
    olxQueueStatus,
    nieruchomosciOnlineQueueStatus,
    domiportaQueueStatus,
    maxonQueueStatus,
    adresowoQueueStatus,
    morizonQueueStatus,
    combinedQueueCounts,
    isRetryingFailedQueue,
    isRetryingFailedGratkaQueue,
    isRetryingFailedOlxQueue,
    isRetryingFailedNieruchomosciOnlineQueue,
    isRetryingFailedDomiportaQueue,
    isRetryingFailedMaxonQueue,
    isRetryingFailedAdresowoQueue,
    isRetryingFailedMorizonQueue,
    runCollector,
    collectUrl,
    setCollectUrl,
    isCollecting,
    collectError,
    collectResult,
    runBulkCollector,
    bulkCity,
    setBulkCity,
    bulkStartPage,
    setBulkStartPage,
    bulkPages,
    setBulkPages,
    bulkLimit,
    setBulkLimit,
    isBulkCollecting,
    bulkError,
    bulkResult,
    runRcnImport,
    isImportingRcn,
    rcnError,
    rcnResult,
    queueStatusError,
    queueStatusCheckedAt,
    isRefreshingQueueStatus,
    discoverAllCity,
    discoverAllMaxPages,
    setDiscoverAllMaxPages,
    runDiscoverAllPortals,
    isDiscoveringAllPortals,
    queueLimit,
    setQueueLimit,
    runProcessAllPortals,
    isTogglingListingAutomation,
    stopListingAutomation,
    queueNotice,
    queueError,
    queueErrorAction,
    retryAllFailedQueues,
    resetAllProcessingQueues,
    isResettingProcessingQueue,
    enrichListingsFromStreets,
    isEnrichingListingsFromStreets,
    streetEnrichmentResult,
    runDuplicateAutoMerge,
    isRunningDuplicateAutoMerge,
    duplicateAutoMergeResult,
    runRelistingScan,
    isScanningRelistedListings,
    relistingScanResult,
    duplicateAutoMergeError,
    relistingScanError,
    setCollectError,
  } = useImportController({
    refreshDashboard,
    applyFilters,
    searchCity: state.status === "ready" ? state.settings.searchContract.city : "",
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("mieszkania-theme", theme);
  }, [theme]);

  useEffect(() => {
    writeListingsSession({ activeTab, filters, listingSort, currentListingsPage });
  }, [activeTab, filters, listingSort, currentListingsPage]);
  useScrollSession(state.status === "ready", location.pathname);
  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    syncListingFromUrl();
  }, [state.status, location.pathname, location.search]);

  useEffect(() => {
    if (state.status !== "ready") return;
    // History can change again before React commits a route transition. Cancel
    // or resume immediately using the actual URL, not a stale rendered location.
    const onHistory = () => syncListingFromUrl();
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, [state.status]);

  useEffect(() => () => listingRequest.current?.controller.abort(), []);

  useEffect(() => {
    void refreshStaleListingStatus();
    const staleStatusIntervalId = window.setInterval(() => {
      if (!document.hidden) void refreshStaleListingStatus();
    }, 60_000);
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
    const statuses = [
      queueStatus,
      gratkaQueueStatus,
      olxQueueStatus,
      nieruchomosciOnlineQueueStatus,
      domiportaQueueStatus,
      maxonQueueStatus,
      adresowoQueueStatus,
      morizonQueueStatus,
    ];
    const delayedPending = statuses.reduce((sum, status) => sum + (status?.delayedPending ?? 0), 0);
    if (isProcessingAllPortals || delayedPending === 0) return;
    const nextAttemptAt = getNextQueueAttemptAt(...statuses);
    const nextAttemptMs = nextAttemptAt ? new Date(nextAttemptAt).getTime() : Date.now() + 10_000;
    const delayMs = Math.max(1_000, Math.min(60_000, nextAttemptMs - Date.now() + 750));
    const timeoutId = window.setTimeout(() => void refreshQueueStatus("passive"), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [
    adresowoQueueStatus,
    domiportaQueueStatus,
    gratkaQueueStatus,
    isProcessingAllPortals,
    maxonQueueStatus,
    morizonQueueStatus,
    nieruchomosciOnlineQueueStatus,
    olxQueueStatus,
    queueStatus,
  ]);

  useEffect(() => {
    if (activeTab === "map") void loadMapListings();
    if (activeTab === "duplicates") void loadDuplicateGroups();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "stats") return;
    setMarketStatsLoading(true);
    const params = new URLSearchParams();
    params.set("period", String(marketStatsPeriod));
    if (marketStatsFilters.minYear) params.set("minYear", marketStatsFilters.minYear);
    if (marketStatsFilters.minArea) params.set("minArea", marketStatsFilters.minArea);
    if (marketStatsFilters.maxArea) params.set("maxArea", marketStatsFilters.maxArea);
    if (marketStatsFilters.elevator) params.set("elevator", "true");
    if (marketStatsFilters.garage) params.set("garage", "true");
    if (marketStatsFilters.storage) params.set("storage", "true");
    if (hasExposureFilter(marketStatsFilters.directions))
      params.set("directions", marketStatsFilters.directions.join(","));
    const controller = new AbortController();
    setMarketStatsError(null);
    apiFetch(`${apiBaseUrl}/api/market-stats?${params}`, { signal: controller.signal })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Nie udało się pobrać statystyk rynku.")),
      )
      .then((data: MarketStatsResponse) => {
        if (!controller.signal.aborted) {
          setMarketStats(data);
          if (!hasActiveMarketFilters(marketStatsFilters)) setMarketStatsBaseline(data);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setMarketStatsError(
            error instanceof Error ? error.message : "Nie udało się pobrać statystyk rynku.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setMarketStatsLoading(false);
      });
    return () => controller.abort();
  }, [activeTab, marketStatsFilters, marketStatsPeriod]);

  useEffect(() => {
    if (activeTab !== "stats" || !hasActiveMarketFilters(marketStatsFilters)) return;
    const controller = new AbortController();
    setMarketStatsBaseline(null);
    apiFetch(`${apiBaseUrl}/api/market-stats?period=${marketStatsPeriod}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: MarketStatsResponse | null) => {
        if (data && !controller.signal.aborted) setMarketStatsBaseline(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeTab, marketStatsPeriod, hasActiveMarketFilters(marketStatsFilters)]);

  if (state.status === "loading") {
    return { status: "loading" as const };
  }

  if (state.status === "error") {
    return {
      status: "error" as const,
      message: state.message,
      retry: () => {
        setState({ status: "loading" });
        void loadInitial();
      },
    };
  }

  const { dashboard, alerts, region, settings, upcomingViewings } = state;
  const statsPriceDelta =
    marketStats && marketStatsBaseline
      ? Math.round(
          marketStats.totals.averagePricePerSqm - marketStatsBaseline.totals.averagePricePerSqm,
        )
      : 0;
  const dashboardListings = applyDreamProfile(dashboard.listings, settings);
  const visibleListings = applyDreamProfile(filteredListings, settings);
  const compareListings = resolveCompareListings(
    compareListingIds,
    dashboardListings,
    visibleListings,
    compareSnapshots,
  );
  const totalListingsPages = Math.max(1, Math.ceil(listingsTotal / listingsPerPage));
  const listingInsights = buildListingInsights(dashboard.stats, dashboardListings);
  const listingSectionTitle = filters.archivedOnly
    ? "Oferty archiwalne"
    : filters.hiddenOnly
      ? "Ukryte oferty 2-pokojowe"
      : "Wszystkie oferty";
  const portalQueueRows = [
    { name: "Otodom", status: queueStatus },
    { name: "Gratka", status: gratkaQueueStatus },
    { name: "OLX", status: olxQueueStatus },
    { name: "Nieruchomości-online", status: nieruchomosciOnlineQueueStatus },
    { name: "Domiporta", status: domiportaQueueStatus },
    { name: "Maxon", status: maxonQueueStatus },
    { name: "Adresowo", status: adresowoQueueStatus },
    { name: "Morizon", status: morizonQueueStatus },
  ];
  const nextQueueAttemptAt = getNextQueueAttemptAt(...portalQueueRows.map(({ status }) => status));
  const isQueueBusy =
    isRunningAll ||
    isRunningGratkaAll ||
    isProcessingAllPortals ||
    combinedQueueCounts.processing > 0;
  const isRetryingAnyQueue =
    isRetryingFailedQueue ||
    isRetryingFailedGratkaQueue ||
    isRetryingFailedOlxQueue ||
    isRetryingFailedNieruchomosciOnlineQueue ||
    isRetryingFailedDomiportaQueue ||
    isRetryingFailedMaxonQueue ||
    isRetryingFailedAdresowoQueue ||
    isRetryingFailedMorizonQueue;

  return {
    status: "ready" as const,
    setActiveTab,
    setTheme,
    theme,
    setSettingsSaveError,
    setSettingsOpen,
    activeTab,
    region,
    upcomingViewings,
    listingsTotal,
    dashboardListings,
    listingInsights,
    openListing,
    marketStatsPeriod,
    marketStatsDraftFilters,
    setMarketStatsPeriod,
    setMarketStatsDraftFilters,
    setMarketStats,
    setMarketStatsFilters,
    marketStatsError,
    marketStatsFilters,
    marketStats,
    marketStatsLoading,
    marketStatsBaseline,
    statsPriceDelta,
    compareListings,
    removeFromCompare,
    mortgageDraft,
    duplicateGroups,
    duplicateTotal,
    duplicateTotals,
    duplicateError,
    duplicateAction,
    loadDuplicateGroups,
    isLoadingDuplicateGroups,
    unmergeDuplicate,
    confirmDuplicateGroup,
    runCollector,
    collectUrl,
    setCollectUrl,
    isCollecting,
    collectError,
    collectResult,
    runBulkCollector,
    bulkCity,
    setBulkCity,
    bulkStartPage,
    setBulkStartPage,
    bulkPages,
    setBulkPages,
    bulkLimit,
    setBulkLimit,
    isBulkCollecting,
    bulkError,
    bulkResult,
    runRcnImport,
    isImportingRcn,
    rcnError,
    rcnResult,
    isQueueBusy,
    combinedQueueCounts,
    queueStatusError,
    queueStatusCheckedAt,
    staleListingRefresh,
    refreshQueueStatus,
    refreshStaleListingStatus,
    isRefreshingQueueStatus,
    discoverAllCity,
    discoverAllMaxPages,
    setDiscoverAllMaxPages,
    runDiscoverAllPortals,
    isDiscoveringAllPortals,
    nextQueueAttemptAt,
    queueLimit,
    setQueueLimit,
    runProcessAllPortals,
    isTogglingListingAutomation,
    isProcessingAllPortals,
    stopListingAutomation,
    queueNotice,
    queueError,
    queueErrorAction,
    portalQueueRows,
    retryAllFailedQueues,
    isRetryingAnyQueue,
    resetAllProcessingQueues,
    isResettingProcessingQueue,
    enrichListingsFromStreets,
    isEnrichingListingsFromStreets,
    streetEnrichmentResult,
    runDuplicateAutoMerge,
    isRunningDuplicateAutoMerge,
    duplicateAutoMergeResult,
    runRelistingScan,
    isScanningRelistedListings,
    relistingScanResult,
    duplicateAutoMergeError,
    relistingScanError,
    filtersPanelCollapsed,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    listingSectionTitle,
    filters,
    setFilters,
    applyFilters,
    listingSort,
    setListingSort,
    isLoadingListings,
    setFiltersPanelCollapsed,
    listingsMainRef,
    visibleListings,
    toggleShortlist,
    isUpdatingShortlist,
    currentListingsPage,
    totalListingsPages,
    mapListings,
    selectedListing,
    settings,
    isLoadingMapListings,
    selectedListingDuplicateCandidates,
    closeListing,
    setSelectedListing,
    reviewDuplicatePair,
    dismissListing,
    archiveListing,
    compareListingIds,
    toggleCompareListing,
    isDismissingListing,
    isArchivingListing,
    isLoadingDuplicateCandidates,
    isReviewingDuplicatePair,
    saveListingManual,
    saveListingContactEvent,
    scheduleViewing,
    deleteViewing,
    runListingMediaBackfill,
    refreshListingFromSource,
    listingRefreshConfirmation,
    isBackfillingListingMedia,
    isRefreshingListingData,
    isSavingListingManual,
    isSavingContactEvent,
    isLoadingListingInsights,
    loadListingInsights,
    setMortgageDraft,
    listingOpenError,
    isOpeningListing,
    settingsOpen,
    saveSettings,
    isSavingSettings,
    settingsSaveError,
  };

  async function loadInitial() {
    if (initialLoadInFlightRef.current) return;
    initialLoadInFlightRef.current = true;
    try {
      const [
        dashboardResponse,
        alertsResponse,
        regionResponse,
        settingsResponse,
        upcomingViewingsResponse,
        listingsResponse,
      ] = await Promise.all([
        apiFetch(`${apiBaseUrl}/api/dashboard`),
        apiFetch(`${apiBaseUrl}/api/alerts`),
        apiFetch(`${apiBaseUrl}/api/region`),
        apiFetch(`${apiBaseUrl}/api/settings/family`),
        apiFetch(`${apiBaseUrl}/api/viewings/upcoming`),
        apiFetch(
          `${apiBaseUrl}/api/listings?${createListingsQuery(filters, currentListingsPage, listingSort)}`,
        ),
      ]);
      const failedResponse = [
        dashboardResponse,
        alertsResponse,
        regionResponse,
        settingsResponse,
        upcomingViewingsResponse,
        listingsResponse,
      ].find((response) => !response.ok);
      if (failedResponse) {
        const endpoint = new URL(failedResponse.url).pathname;
        throw new Error(
          `Nie udało się pobrać danych: ${endpoint} (HTTP ${failedResponse.status}). Spróbuj ponownie.`,
        );
      }

      const listings = (await listingsResponse.json()) as ListingsResponse;
      setState({
        status: "ready",
        dashboard: (await dashboardResponse.json()) as DashboardResponse,
        alerts: (await alertsResponse.json()) as AlertsResponse,
        region: (await regionResponse.json()) as SupportedRegion,
        settings: (await settingsResponse.json()) as FamilySettings,
        upcomingViewings: (await upcomingViewingsResponse.json()) as UpcomingViewingsResponse,
      });
      setFilteredListings(listings.items);
      setListingsTotal(listings.total);
      setCurrentListingsPage(currentListingsPage);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nieznany blad pobierania danych.",
      });
    } finally {
      initialLoadInFlightRef.current = false;
    }
  }

  async function refreshDashboard() {
    const response = await apiFetch(`${apiBaseUrl}/api/dashboard`);
    if (!response.ok) return;
    const dashboardResponse = (await response.json()) as DashboardResponse;
    setState((current) =>
      current.status === "ready" ? { ...current, dashboard: dashboardResponse } : current,
    );
  }

  async function refreshAlerts() {
    const response = await apiFetch(`${apiBaseUrl}/api/alerts`);
    if (!response.ok) return;
    const alertsResponse = (await response.json()) as AlertsResponse;
    setState((current) =>
      current.status === "ready" ? { ...current, alerts: alertsResponse } : current,
    );
  }

  async function refreshUpcomingViewings() {
    const response = await apiFetch(`${apiBaseUrl}/api/viewings/upcoming`);
    if (!response.ok) return;
    const upcomingViewingsResponse = (await response.json()) as UpcomingViewingsResponse;
    setState((current) =>
      current.status === "ready"
        ? { ...current, upcomingViewings: upcomingViewingsResponse }
        : current,
    );
  }

  async function applyFilters(
    nextFilters = filters,
    nextPage = currentListingsPage,
    nextSort = listingSort,
  ) {
    const shouldScrollToListingTop = nextPage !== currentListingsPage;
    setIsLoadingListings(true);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/listings?${createListingsQuery(nextFilters, nextPage, nextSort)}`,
      );
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
      const response = await apiFetch(`${apiBaseUrl}/api/listings/map`);
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
      const response = await apiFetch(
        `${apiBaseUrl}/api/duplicates/groups?limit=${Math.max(limit, duplicateGroups.length)}&summary=true`,
      );
      if (!response.ok) throw new Error("Nie udało się pobrać grup duplikatów.");
      const data = (await response.json()) as {
        items: DuplicateGroupOverview[];
        total: number;
        totalMembers: number;
        totalCopies: number;
      };
      setDuplicateGroups(data.items);
      setDuplicateTotal(data.total);
      setDuplicateTotals({ members: data.totalMembers, copies: data.totalCopies });
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "Błąd odczytu duplikatów.");
    } finally {
      setIsLoadingDuplicateGroups(false);
    }
  }

  async function unmergeDuplicate(primaryListingId: string, duplicateListingId: string) {
    if (duplicateAction) return false;
    setDuplicateAction(primaryListingId);
    setDuplicateError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/duplicates/unmerge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryListingId, duplicateListingId }),
      });
      if (!response.ok)
        throw new Error("Nie udało się rozłączyć ofert. Odśwież grupy i spróbuj ponownie.");
      await Promise.all([
        loadDuplicateGroups(),
        refreshDashboard(),
        loadMapListings(),
        applyFilters(filters, currentListingsPage, listingSort),
        ...(selectedListing ? [openListing(selectedListing.id, false, true)] : []),
      ]);
      return true;
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "Błąd rozłączania.");
      return false;
    } finally {
      setDuplicateAction(null);
    }
  }

  async function confirmDuplicateGroup(primaryListingId: string) {
    if (duplicateAction) return;
    setDuplicateAction(primaryListingId);
    setDuplicateError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/duplicates/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryListingId }),
      });
      if (!response.ok) throw new Error("Nie udało się zatwierdzić grupy.");
      await loadDuplicateGroups();
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "Błąd zatwierdzania.");
    } finally {
      setDuplicateAction(null);
    }
  }

  function syncListingFromUrl() {
    const id = new URLSearchParams(window.location.search).get("listing");
    if (id) {
      if (listingRequest.current?.id !== id) void openListing(id, false);
    } else {
      cancelListingRequests();
      setSelectedListing(null);
      setListingOpenError(null);
    }
  }

  function cancelListingRequests() {
    listingRequest.current?.controller.abort();
    listingRequest.current = null;
    setIsOpeningListing(false);
    setIsLoadingListingInsights(false);
    setIsLoadingDuplicateCandidates(false);
    setSelectedListingDuplicateCandidates([]);
  }

  function closeListing() {
    cancelListingRequests();
    setSelectedListing(null);
    setListingOpenError(null);
    void navigate(location.pathname);
  }

  async function openListing(listingId: string, updateUrl = true, keepOpen = false) {
    cancelListingRequests();
    const controller = new AbortController();
    listingRequest.current = { id: listingId, controller };
    const { signal } = controller;
    if (!keepOpen) {
      window.dispatchEvent(new Event("mieszkania:open-listing"));
      setDuplicateError(null);
    }
    if (!keepOpen) setSelectedListing(null);
    setIsOpeningListing(true);
    setListingOpenError(null);
    if (updateUrl) void navigate(listingHref(listingId));
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/listings/${encodeURIComponent(listingId)}`,
        {
          signal,
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "Nie znaleziono tej oferty w tej lokalnej bazie."
            : "Nie udało się otworzyć oferty. Spróbuj ponownie.",
        );
      const detail = (await response.json()) as ListingDetail;
      if (signal.aborted) return;
      setSelectedListing(detail);
      void loadListingInsights(detail.id, false, signal);
      void loadDuplicateCandidates(detail.id, signal);
    } catch (error) {
      if (!signal.aborted)
        setListingOpenError(
          error instanceof Error ? error.message : "Nie udało się otworzyć oferty.",
        );
    } finally {
      if (!signal.aborted) setIsOpeningListing(false);
    }
  }

  async function loadDuplicateCandidates(
    listingId: string,
    signal = listingRequest.current?.controller.signal,
  ) {
    setIsLoadingDuplicateCandidates(true);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/duplicates/candidates?limit=40&listingId=${encodeURIComponent(listingId)}`,
        { signal },
      );
      if (!response.ok) return;
      const result = (await response.json()) as DuplicateCandidatesResponse;
      if (!signal?.aborted) setSelectedListingDuplicateCandidates(result.items);
    } catch (error) {
      if (!signal?.aborted) setSelectedListingDuplicateCandidates([]);
    } finally {
      if (!signal?.aborted) setIsLoadingDuplicateCandidates(false);
    }
  }

  async function loadListingInsights(
    listingId: string,
    force = false,
    signal = listingRequest.current?.controller.signal,
  ) {
    setIsLoadingListingInsights(true);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/listings/${encodeURIComponent(listingId)}/insights${force ? "?refresh=true" : ""}`,
        { signal },
      );
      if (!response.ok) throw new Error("INSIGHTS_HTTP_" + response.status);
      const insights = (await response.json()) as Pick<
        ListingDetail,
        "commutes" | "amenities" | "amenityAnalysis"
      >;
      if (signal?.aborted) return;
      setSelectedListing((current) =>
        current?.id === listingId ? { ...current, ...insights } : current,
      );
    } catch (error) {
      // Optional enrichment must never reopen a dismissed offer or reject globally.
      if (!signal?.aborted)
        setSelectedListing((current) =>
          current?.id !== listingId
            ? current
            : {
                ...current,
                amenityAnalysis:
                  current.amenityAnalysis?.status === "available"
                    ? {
                        ...current.amenityAnalysis,
                        stale: true,
                        message: "Odświeżenie nie powiodło się. Pokazujemy zapisaną analizę.",
                      }
                    : {
                        status: "unavailable",
                        source: "OpenStreetMap",
                        radiusMeters: 2000,
                        plannedFacilities: [],
                        message:
                          "Nie udało się pobrać analizy z API. Sprawdź połączenie z aplikacją i spróbuj ponownie.",
                      },
              },
        );
    } finally {
      if (!signal?.aborted) setIsLoadingListingInsights(false);
    }
  }

  async function toggleShortlist(listingId: string, shortlisted: boolean) {
    setIsUpdatingShortlist(listingId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/listings/${listingId}/shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortlisted }),
      });
      if (!response.ok) return;

      setFilteredListings((current) =>
        current.map((listing) =>
          listing.id === listingId ? { ...listing, isShortlisted: shortlisted } : listing,
        ),
      );
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              dashboard: {
                ...current.dashboard,
                listings: current.dashboard.listings.map((listing) =>
                  listing.id === listingId ? { ...listing, isShortlisted: shortlisted } : listing,
                ),
              },
            }
          : current,
      );
      setSelectedListing((current) =>
        current?.id === listingId ? { ...current, isShortlisted: shortlisted } : current,
      );
    } finally {
      setIsUpdatingShortlist(null);
    }
  }

  async function saveSettings(nextSettings: FamilySettings) {
    setIsSavingSettings(true);
    setSettingsSaveError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/settings/family`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || `API zwróciło błąd ${response.status}.`);
      }
      const saved = (await response.json()) as FamilySettings;
      const missingLocations = nextSettings.dreamProfile.preferredDistricts.filter(
        (location) => !saved.dreamProfile.preferredDistricts.includes(location),
      );
      if (missingLocations.length > 0) {
        throw new Error(`Nie zapisano lokalizacji: ${missingLocations.join(", ")}.`);
      }
      setState((current) =>
        current.status === "ready" ? { ...current, settings: saved } : current,
      );
      await Promise.all([
        refreshDashboard(),
        refreshAlerts(),
        applyFilters(),
        ...(activeTab === "map" ? [loadMapListings()] : []),
      ]);
      setSettingsOpen(false);
    } catch (error) {
      setSettingsSaveError(
        error instanceof Error ? error.message : "Nie udało się zapisać ustawień.",
      );
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function saveListingManual(manual: ListingDetail["manual"]) {
    if (!selectedListing) return;
    setIsSavingListingManual(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/listings/${selectedListing.id}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Nie udało się zapisać ustaleń. Spróbuj ponownie.");
      }
      const detail = (await response.json()) as ListingDetail;
      setSelectedListing(detail);
      setMapListings((current) =>
        current.map((listing) => (listing.id === detail.id ? { ...listing, ...detail } : listing)),
      );
      setCompareSnapshots((current) =>
        current.map((listing) => (listing.id === detail.id ? detail : listing)),
      );
      await applyFilters();
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
      const response = await apiFetch(
        `${apiBaseUrl}/api/listings/${selectedListing.id}/contact-events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        },
      );
      if (!response.ok) return;
      const detail = (await response.json()) as ListingDetail;
      setSelectedListing(detail);
      await Promise.all([
        refreshDashboard(),
        refreshUpcomingViewings(),
        refreshAlerts(),
        applyFilters(),
      ]);
    } finally {
      setIsSavingContactEvent(false);
    }
  }

  function toggleCompareListing(listingId: string) {
    const snapshot = [
      ...visibleListings,
      ...dashboardListings,
      ...(selectedListing ? [selectedListing] : []),
    ].find((l) => l.id === listingId);
    if (snapshot)
      setCompareSnapshots((current) => [
        ...current.filter((l) => l.id !== listingId && compareListingIds.includes(l.id)),
        snapshot,
      ]);
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

  async function scheduleViewing(input: {
    listingId: string;
    scheduledAt: string;
    notes?: string;
  }) {
    const response = await apiFetch(`${apiBaseUrl}/api/listings/${input.listingId}/viewing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledAt: input.scheduledAt,
        notes: input.notes,
        status: "scheduled",
      }),
    });
    if (!response.ok) return;
    await Promise.all([
      openListing(input.listingId),
      refreshDashboard(),
      refreshUpcomingViewings(),
      refreshAlerts(),
      applyFilters(),
    ]);
  }

  async function deleteViewing(listingId: string) {
    const response = await apiFetch(`${apiBaseUrl}/api/listings/${listingId}/viewing`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    await Promise.all([
      openListing(listingId),
      refreshDashboard(),
      refreshUpcomingViewings(),
      refreshAlerts(),
      applyFilters(),
    ]);
  }

  async function dismissListing(listingId: string) {
    setIsDismissingListing(listingId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/listings/${listingId}/dismiss`, {
        method: "POST",
      });
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
      const response = await apiFetch(`${apiBaseUrl}/api/listings/${listingId}/archive`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Archive listing failed with status ${response.status}`);
      setSelectedListing(null);
      setCompareListingIds((current) => current.filter((id) => id !== listingId));
      await Promise.all([refreshDashboard(), refreshAlerts(), applyFilters(), loadMapListings()]);
    } finally {
      setIsArchivingListing(null);
    }
  }

  async function runListingMediaBackfill(listingId: string) {
    setIsBackfillingListingMedia(listingId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/listings/${listingId}/media/backfill`, {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(`Listing media backfill failed with status ${response.status}`);
      await response.json();
      await Promise.all([refreshDashboard(), applyFilters(), openListing(listingId)]);
    } catch (error) {
      setMediaBackfillError(
        error instanceof Error ? error.message : "Listing media backfill failed.",
      );
    } finally {
      setIsBackfillingListingMedia(null);
    }
  }

  async function refreshListingFromSource(
    listing: Pick<ListingDetail, "id" | "canonicalUrl" | "sourceLabel">,
  ) {
    if (!listing.canonicalUrl) {
      setCollectError("Oferta nie ma zapisanego URL-a źródłowego.");
      return;
    }

    setIsRefreshingListingData(listing.id);
    setCollectError(null);
    try {
      const refreshedAt = new Date();
      const endpoint = resolveCollectorEndpoint(listing.canonicalUrl);
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: listing.canonicalUrl,
          ...(isGratkaUrl(listing.canonicalUrl) ? { refreshMode: "price_only" } : {}),
        }),
      });
      if (!response.ok) throw new Error(`Listing refresh failed with status ${response.status}`);
      const result = (await response.json()) as CollectorRunResponse;
      setListingRefreshConfirmation({ listingId: listing.id, refreshedAt, action: result.action });
      await Promise.all([
        refreshDashboard(),
        applyFilters(filters, currentListingsPage, listingSort),
        openListing(listing.id),
      ]);
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : "Listing refresh failed.");
    } finally {
      setIsRefreshingListingData(null);
    }
  }

  async function reviewDuplicatePair(
    pair: DuplicateCandidate,
    status: "same_listing" | "different_listing",
  ) {
    setIsReviewingDuplicatePair(pair.pairKey);
    setDuplicateError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/duplicates/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftId: pair.left.id,
          rightId: pair.right.id,
          primaryListingId: selectedListing?.id,
          status,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message ?? "Nie udało się zapisać decyzji o duplikacie.");
      }
      if (!selectedListing) return;

      await openListing(selectedListing.id, false, true);
      await refreshDashboard();
      await applyFilters(filters, currentListingsPage, listingSort);
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : "Błąd zapisywania decyzji.");
    } finally {
      setIsReviewingDuplicatePair(null);
    }
  }
}

export type WorkspaceState = Extract<
  ReturnType<typeof useWorkspaceController>,
  { status: "ready" }
>;
