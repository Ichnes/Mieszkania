import { apiFetch } from "../../shared/lib/http";
import type {
  CollectorRunResponse,
  ListingFilters,
  OtodomDiscoverAllResponse,
  OtodomQueueProcessResponse,
  OtodomQueueStatusResponse,
  RcnImportResponse,
  RelistedListingsScanResponse,
} from "@mieszkania/shared";
import { useRef, useState } from "react";
import { ListingSortKey } from "../../app/types";
import { apiBaseUrl } from "../../shared/lib/api";
import { toOptionalNumber } from "../../shared/lib/input";
import {
  friendlyPortalError,
  isOutboundNetworkError,
  resolveCollectorEndpoint,
} from "./lib/portals";
import { formatQueueAttemptTime, getNextProcessAttemptAt, sumQueueCounts } from "./lib/queue";
import { DuplicateAutoMergeResult, StaleListingRefreshStatus } from "./types";

export function useImportController({
  refreshDashboard,
  applyFilters,
  searchCity,
}: {
  searchCity: string;
  refreshDashboard: () => Promise<void>;
  applyFilters: (
    nextFilters?: ListingFilters,
    nextPage?: number,
    nextSort?: ListingSortKey,
  ) => Promise<void>;
}) {
  const [queueStatusError, setQueueStatusError] = useState<string | null>(null);

  const [queueStatusCheckedAt, setQueueStatusCheckedAt] = useState<Date | null>(null);

  const [collectUrl, setCollectUrl] = useState("");

  const [bulkCity, setBulkCity] = useState("warszawa");

  const [bulkStartPage, setBulkStartPage] = useState("1");

  const [bulkPages, setBulkPages] = useState("3");

  const [bulkLimit, setBulkLimit] = useState("12");

  const discoverAllCity = searchCity;

  const [discoverAllMaxPages, setDiscoverAllMaxPages] = useState("50");

  const [discoverAllBatchPages, setDiscoverAllBatchPages] = useState("5");

  const [queueLimit, setQueueLimit] = useState("200");

  const [queueConcurrency, setQueueConcurrency] = useState("8");

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

  const [discoverAllResult, setDiscoverAllResult] = useState<OtodomDiscoverAllResponse | null>(
    null,
  );

  const [gratkaDiscoverAllResult, setGratkaDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [olxDiscoverAllResult, setOlxDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [nieruchomosciOnlineDiscoverAllResult, setNieruchomosciOnlineDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [domiportaDiscoverAllResult, setDomiportaDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [maxonDiscoverAllResult, setMaxonDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [adresowoDiscoverAllResult, setAdresowoDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [morizonDiscoverAllResult, setMorizonDiscoverAllResult] =
    useState<OtodomDiscoverAllResponse | null>(null);

  const [staleListingRefresh, setStaleListingRefresh] = useState<StaleListingRefreshStatus | null>(
    null,
  );

  const [queueProcessResult, setQueueProcessResult] = useState<OtodomQueueProcessResponse | null>(
    null,
  );

  const [gratkaQueueProcessResult, setGratkaQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [olxQueueProcessResult, setOlxQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [nieruchomosciOnlineQueueProcessResult, setNieruchomosciOnlineQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [domiportaQueueProcessResult, setDomiportaQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [maxonQueueProcessResult, setMaxonQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [adresowoQueueProcessResult, setAdresowoQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [morizonQueueProcessResult, setMorizonQueueProcessResult] =
    useState<OtodomQueueProcessResponse | null>(null);

  const [queueStatus, setQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);

  const [gratkaQueueStatus, setGratkaQueueStatus] = useState<OtodomQueueStatusResponse | null>(
    null,
  );

  const [olxQueueStatus, setOlxQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);

  const [nieruchomosciOnlineQueueStatus, setNieruchomosciOnlineQueueStatus] =
    useState<OtodomQueueStatusResponse | null>(null);

  const [domiportaQueueStatus, setDomiportaQueueStatus] =
    useState<OtodomQueueStatusResponse | null>(null);

  const [maxonQueueStatus, setMaxonQueueStatus] = useState<OtodomQueueStatusResponse | null>(null);

  const [adresowoQueueStatus, setAdresowoQueueStatus] = useState<OtodomQueueStatusResponse | null>(
    null,
  );

  const [morizonQueueStatus, setMorizonQueueStatus] = useState<OtodomQueueStatusResponse | null>(
    null,
  );

  const [queueError, setQueueError] = useState<string | null>(null);

  const [queueErrorAction, setQueueErrorAction] = useState<"discover" | "process" | null>(null);

  const [queueNotice, setQueueNotice] = useState<{
    tone: "info" | "success";
    message: string;
  } | null>(null);

  const [duplicateAutoMergeResult, setDuplicateAutoMergeResult] =
    useState<DuplicateAutoMergeResult | null>(null);

  const [duplicateAutoMergeError, setDuplicateAutoMergeError] = useState<string | null>(null);

  const [relistingScanResult, setRelistingScanResult] =
    useState<RelistedListingsScanResponse | null>(null);

  const [relistingScanError, setRelistingScanError] = useState<string | null>(null);

  const [isCollecting, setIsCollecting] = useState(false);

  const [isBulkCollecting, setIsBulkCollecting] = useState(false);

  const [isImportingRcn, setIsImportingRcn] = useState(false);

  const [isDiscoveringAllPortals, setIsDiscoveringAllPortals] = useState(false);

  const [isProcessingAllPortals, setIsProcessingAllPortals] = useState(false);

  const [isTogglingListingAutomation, setIsTogglingListingAutomation] = useState(false);

  const [isRefreshingQueueStatus, setIsRefreshingQueueStatus] = useState(false);

  const [isRetryingFailedQueue, setIsRetryingFailedQueue] = useState(false);

  const [isRetryingFailedGratkaQueue, setIsRetryingFailedGratkaQueue] = useState(false);

  const [isRetryingFailedOlxQueue, setIsRetryingFailedOlxQueue] = useState(false);

  const [isRetryingFailedNieruchomosciOnlineQueue, setIsRetryingFailedNieruchomosciOnlineQueue] =
    useState(false);

  const [isRetryingFailedDomiportaQueue, setIsRetryingFailedDomiportaQueue] = useState(false);

  const [isRetryingFailedMaxonQueue, setIsRetryingFailedMaxonQueue] = useState(false);

  const [isRetryingFailedAdresowoQueue, setIsRetryingFailedAdresowoQueue] = useState(false);

  const [isRetryingFailedMorizonQueue, setIsRetryingFailedMorizonQueue] = useState(false);

  const [isResettingProcessingQueue, setIsResettingProcessingQueue] = useState(false);

  const [isResettingProcessingGratkaQueue, setIsResettingProcessingGratkaQueue] = useState(false);

  const [isResettingProcessingOlxQueue, setIsResettingProcessingOlxQueue] = useState(false);

  const [isEnrichingListingsFromStreets, setIsEnrichingListingsFromStreets] = useState(false);

  const [streetEnrichmentResult, setStreetEnrichmentResult] = useState<{
    scanned: number;
    matched: number;
    addressUpdated: number;
    coordinatesFilled: number;
    coordinatesOverridden: number;
  } | null>(null);

  const [isRunningDuplicateAutoMerge, setIsRunningDuplicateAutoMerge] = useState(false);

  const [isScanningRelistedListings, setIsScanningRelistedListings] = useState(false);

  const processAllAbortRef = useRef<AbortController | null>(null);

  const processAllStartedAtRef = useRef(0);

  const processAllLastProgressAtRef = useRef(0);

  const processAllLastCountsRef = useRef<ReturnType<typeof sumQueueCounts> | null>(null);

  const processAllObservedProgressRef = useRef(false);

  const processAllStopReasonRef = useRef<"completed" | "stalled" | "manual" | null>(null);

  const queueStatusInFlightRef = useRef(false);

  const combinedQueueCounts = sumQueueCounts(
    queueStatus,
    gratkaQueueStatus,
    olxQueueStatus,
    nieruchomosciOnlineQueueStatus,
    domiportaQueueStatus,
    maxonQueueStatus,
    adresowoQueueStatus,
    morizonQueueStatus,
  );

  async function runCollector() {
    setIsCollecting(true);
    setCollectError(null);
    try {
      const response = await apiFetch(resolveCollectorEndpoint(collectUrl.trim()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: collectUrl.trim() }),
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/otodom/collect-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: bulkCity.trim(),
          startPage: Number(bulkStartPage) || 1,
          pages: Number(bulkPages) || 3,
          limit: Number(bulkLimit) || 12,
        }),
      });
      if (!response.ok) throw new Error(`Bulk collector failed with status ${response.status}`);
      setBulkResult(
        (await response.json()) as {
          discovered: number;
          collected: number;
          startPage: number;
          pagesScanned: number;
          limitApplied: number;
          created: number;
          updated: number;
          unchanged: number;
          failed: number;
        },
      );
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/rcn/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "warsaw-metropolitan" }),
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

  async function runDiscoverAllPortals() {
    setIsDiscoveringAllPortals(true);
    setQueueError(null);
    setQueueErrorAction(null);
    try {
      const [
        otodomResponse,
        gratkaResponse,
        olxResponse,
        nieruchomosciOnlineResponse,
        domiportaResponse,
        maxonResponse,
        adresowoResponse,
        morizonResponse,
        staleRefreshResponse,
      ] = await Promise.all([
        apiFetch(`${apiBaseUrl}/api/collectors/otodom/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: toOptionalNumber(discoverAllMaxPages) ?? 50,
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/gratka/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/olx/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/nieruchomosci-online/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/domiporta/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/maxon/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/adresowo/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/morizon/discover-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: discoverAllCity.trim(),
            startPage: 1,
            maxPages: Math.min(toOptionalNumber(discoverAllMaxPages) ?? 250, 250),
            batchPages: toOptionalNumber(discoverAllBatchPages) ?? 5,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/listings/refresh-stale`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
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
      if (!nieruchomosciOnlineResponse.ok)
        throw new Error(
          `Nieruchomosci-online discover-all failed with status ${nieruchomosciOnlineResponse.status}`,
        );
      if (!domiportaResponse.ok)
        throw new Error(`Domiporta discover-all failed with status ${domiportaResponse.status}`);
      if (!maxonResponse.ok)
        throw new Error(`Maxon discover-all failed with status ${maxonResponse.status}`);
      if (!adresowoResponse.ok)
        throw new Error(`Adresowo discover-all failed with status ${adresowoResponse.status}`);
      if (!morizonResponse.ok)
        throw new Error(`Morizon discover-all failed with status ${morizonResponse.status}`);
      if (!staleRefreshResponse.ok)
        throw new Error(`Stale listing refresh failed with status ${staleRefreshResponse.status}`);
      const portalResults = [
        ["Otodom", await otodomResponse.json()],
        ["Gratka", await gratkaResponse.json()],
        ["OLX", await olxResponse.json()],
        ["Nieruchomości-online", await nieruchomosciOnlineResponse.json()],
        ["Domiporta", await domiportaResponse.json()],
        ["Maxon", await maxonResponse.json()],
        ["Adresowo", await adresowoResponse.json()],
        ["Morizon", await morizonResponse.json()],
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
      const stoppedPortals = portalResults.filter(
        ([, result]) => result.stoppedBecause === "error",
      );
      if (stoppedPortals.length > 0) {
        const networkFailures = stoppedPortals.filter(([, result]) =>
          isOutboundNetworkError(result.error),
        );
        if (networkFailures.length === portalResults.length) {
          setQueueError(
            "Backend nie ma obecnie dostępu do internetu (połączenia HTTPS są blokowane). Nie usunęliśmy ani nie zmieniliśmy istniejących ofert. Sprawdź zaporę, VPN lub uruchomienie serwera API i spróbuj ponownie.",
          );
        } else {
          setQueueError(
            `Nie udało się sprawdzić: ${stoppedPortals.map(([name, result]) => `${name}${result.error ? ` (${friendlyPortalError(result.error)})` : ""}`).join(", ")}. Oferty z pozostałych portali zostały zachowane.`,
          );
        }
        setQueueErrorAction("discover");
      }
      await apiFetch(`${apiBaseUrl}/api/listings/automation/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await Promise.all([refreshQueueStatus(), refreshStaleListingStatus()]);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Multi-portal discover-all failed.");
      setQueueErrorAction("discover");
    } finally {
      setIsDiscoveringAllPortals(false);
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
    setQueueNotice({
      tone: "info",
      message: "Pobieranie rozpoczęte. Status kolejek odświeża się automatycznie co 3 sekundy.",
    });
    try {
      const resumeResponse = await apiFetch(`${apiBaseUrl}/api/listings/automation/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!resumeResponse.ok)
        throw new Error(`Automation resume failed with status ${resumeResponse.status}`);
      setStaleListingRefresh((current) =>
        current ? { ...current, automationPaused: false } : current,
      );
      const [
        otodomResponse,
        gratkaResponse,
        olxResponse,
        nieruchomosciOnlineResponse,
        domiportaResponse,
        maxonResponse,
        adresowoResponse,
        morizonResponse,
      ] = await Promise.all([
        apiFetch(`${apiBaseUrl}/api/collectors/otodom/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/gratka/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/olx/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/nieruchomosci-online/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
            force: true,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/domiporta/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/maxon/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/adresowo/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 8,
          }),
        }),
        apiFetch(`${apiBaseUrl}/api/collectors/morizon/process-queue`, {
          method: "POST",
          signal: abortController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: toOptionalNumber(queueLimit) ?? 200,
            concurrency: toOptionalNumber(queueConcurrency) ?? 4,
          }),
        }),
      ]);

      if (!otodomResponse.ok)
        throw new Error(`Otodom process-queue failed with status ${otodomResponse.status}`);
      if (!gratkaResponse.ok)
        throw new Error(`Gratka process-queue failed with status ${gratkaResponse.status}`);
      if (!olxResponse.ok)
        throw new Error(`OLX process-queue failed with status ${olxResponse.status}`);
      if (!nieruchomosciOnlineResponse.ok)
        throw new Error(
          `Nieruchomosci-online process-queue failed with status ${nieruchomosciOnlineResponse.status}`,
        );
      if (!domiportaResponse.ok)
        throw new Error(`Domiporta process-queue failed with status ${domiportaResponse.status}`);
      if (!maxonResponse.ok)
        throw new Error(`Maxon process-queue failed with status ${maxonResponse.status}`);
      if (!adresowoResponse.ok)
        throw new Error(`Adresowo process-queue failed with status ${adresowoResponse.status}`);
      if (!morizonResponse.ok)
        throw new Error(`Morizon process-queue failed with status ${morizonResponse.status}`);

      const portalResults = [
        ["Otodom", await otodomResponse.json()],
        ["Gratka", await gratkaResponse.json()],
        ["OLX", await olxResponse.json()],
        ["Nieruchomości-online", await nieruchomosciOnlineResponse.json()],
        ["Domiporta", await domiportaResponse.json()],
        ["Maxon", await maxonResponse.json()],
        ["Adresowo", await adresowoResponse.json()],
        ["Morizon", await morizonResponse.json()],
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
      const deferredPortals = portalResults.filter(
        ([, result]) => (result.deferred ?? 0) > 0 || Boolean(result.pausedUntil),
      );
      if (failedPortals.length > 0) {
        setQueueError(
          `Część ofert nie została pobrana: ${failedPortals.map(([name, result]) => `${name}: ${result.failed}`).join(" · ")}. Udane oferty są już zapisane; ponowienie obejmie tylko błędne lub oczekujące rekordy.`,
        );
        setQueueErrorAction("process");
        setQueueNotice(null);
      } else if (deferredPortals.length > 0) {
        const completed = portalResults.reduce((sum, [, result]) => sum + result.completed, 0);
        const deferred = portalResults.reduce((sum, [, result]) => sum + (result.deferred ?? 0), 0);
        const pausedUntil = getNextProcessAttemptAt(...portalResults.map(([, result]) => result));
        setQueueNotice({
          tone: "info",
          message: `${completed > 0 ? `Zapisano ${completed} ofert. ` : ""}${deferred > 0 ? `${deferred} ofert odłożono` : "Portal chwilowo wstrzymał pobieranie"}${pausedUntil ? `; automatyczne wznowienie ${formatQueueAttemptTime(pausedUntil)}` : ""}.`,
        });
      } else {
        const completed = portalResults.reduce((sum, [, result]) => sum + result.completed, 0);
        setQueueNotice({
          tone: "success",
          message: `Pobieranie zakończone. Zapisano ${completed} ofert.`,
        });
      }

      // Import zakończył się wraz z odpowiedziami kolektorów. Odświeżanie widoków
      // wykonujemy osobno, aby wolne zapytanie do dashboardu lub listy nie
      // pozostawiało przycisku w stanie "Pobieranie" mimo ukończonego importu.
      if (processAllAbortRef.current === abortController) processAllAbortRef.current = null;
      setIsProcessingAllPortals(false);
      await refreshQueueStatus("passive");
      void Promise.all([refreshStaleListingStatus(), refreshDashboard(), applyFilters()]).catch(
        () => undefined,
      );
    } catch (error) {
      const stopReason = processAllStopReasonRef.current;
      if (stopReason === "manual") {
        setQueueError(null);
        setQueueErrorAction(null);
        setQueueNotice({
          tone: "info",
          message:
            "Automat zatrzymany. Rozpoczęte oferty mogą się jeszcze dokończyć, ale następna partia nie wystartuje.",
        });
        void refreshQueueStatus("passive");
      } else if (stopReason !== "completed" && stopReason !== "stalled") {
        setQueueNotice(null);
        setQueueError(
          error instanceof Error ? error.message : "Multi-portal process-queue failed.",
        );
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
      const response = await apiFetch(`${apiBaseUrl}/api/listings/automation/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error(`Automation pause failed with status ${response.status}`);
      processAllStopReasonRef.current = "manual";
      processAllAbortRef.current?.abort();
      setIsProcessingAllPortals(false);
      setStaleListingRefresh((current) =>
        current ? { ...current, automationPaused: true, running: false } : current,
      );
      setQueueError(null);
      setQueueErrorAction(null);
      setQueueNotice({
        tone: "info",
        message:
          "Automat zatrzymany. Trwająca oferta może zostać dokończona, ale kolejna partia nie wystartuje.",
      });
      await refreshQueueStatus("passive");
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Nie udało się zatrzymać automatu.");
    } finally {
      setIsTogglingListingAutomation(false);
    }
  }

  async function refreshQueueStatus(origin: "manual" | "monitor" | "passive" = "passive") {
    if (origin !== "manual" && document.hidden && !processAllAbortRef.current) return;
    if (queueStatusInFlightRef.current) return;
    queueStatusInFlightRef.current = true;
    if (origin === "manual") setIsRefreshingQueueStatus(true);
    const portals = [
      ["otodom", "Otodom", setQueueStatus],
      ["gratka", "Gratka", setGratkaQueueStatus],
      ["olx", "OLX", setOlxQueueStatus],
      ["nieruchomosci-online", "Nieruchomości-online", setNieruchomosciOnlineQueueStatus],
      ["domiporta", "Domiporta", setDomiportaQueueStatus],
      ["maxon", "Maxon", setMaxonQueueStatus],
      ["adresowo", "Adresowo", setAdresowoQueueStatus],
      ["morizon", "Morizon", setMorizonQueueStatus],
    ] as const;
    try {
      const results = await Promise.allSettled(
        portals.map(async ([key]) => {
          const response = await apiFetch(`${apiBaseUrl}/api/collectors/${key}/queue-status`, {
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) throw new Error(String(response.status));
          return (await response.json()) as OtodomQueueStatusResponse;
        }),
      );
      const statuses: OtodomQueueStatusResponse[] = [];
      const unavailable: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          portals[index][2](result.value);
          statuses.push(result.value);
        } else unavailable.push(portals[index][1]);
      });
      setQueueStatusError(
        unavailable.length
          ? `Brak aktualnego statusu: ${unavailable.join(", ")}. Liczniki tych portali mogą być nieaktualne; ponawiam odczyt automatycznie.`
          : null,
      );
      if (!unavailable.length) setQueueStatusCheckedAt(new Date());
      if (unavailable.length || !processAllAbortRef.current || !processAllStartedAtRef.current)
        return;
      const counts = sumQueueCounts(...statuses);
      const previous = processAllLastCountsRef.current;
      if (
        previous &&
        (counts.pending < previous.pending ||
          counts.completed > previous.completed ||
          counts.failed > previous.failed)
      ) {
        processAllLastProgressAtRef.current = Date.now();
      }
      processAllLastCountsRef.current = counts;
      const inactiveFor = Date.now() - processAllLastProgressAtRef.current;
      // Only collector responses confirm a completed batch. An idle sample can occur between jobs.
      setQueueNotice({
        tone: "info",
        message:
          inactiveFor >= 60_000
            ? `Dłuższe oczekiwanie: ${counts.processing} w toku, ${counts.pending} oczekuje. Pobieranie lub ponowne próby mogą potrwać kilka minut. Możesz zatrzymać automat; rozpoczęte zadania mogą się jeszcze dokończyć.`
            : `Pobieranie trwa: ${counts.processing} w toku, ${counts.pending} oczekuje, ${counts.failed} błędów.`,
      });
    } finally {
      queueStatusInFlightRef.current = false;
      if (origin === "manual") setIsRefreshingQueueStatus(false);
    }
  }

  async function retryFailedQueue() {
    setIsRetryingFailedQueue(true);
    setQueueError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/otodom/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/gratka/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`Gratka retry-failed failed with status ${response.status}`);
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/olx/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/otodom/reset-processing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`Otodom reset-processing failed with status ${response.status}`);
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/gratka/reset-processing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`Gratka reset-processing failed with status ${response.status}`);
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
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/olx/reset-processing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`OLX reset-processing failed with status ${response.status}`);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "OLX reset-processing failed.");
    } finally {
      setIsResettingProcessingOlxQueue(false);
    }
  }

  async function refreshStaleListingStatus() {
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/listings/refresh-stale/status`);
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
      const response = await apiFetch(`${apiBaseUrl}/api/streets/warsaw/enrich-listings`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Street enrichment failed with status ${response.status}`);
      setStreetEnrichmentResult(
        (await response.json()) as {
          scanned: number;
          matched: number;
          addressUpdated: number;
          coordinatesFilled: number;
          coordinatesOverridden: number;
        },
      );
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : "Nie udało się uzupełnić ofert z katalogu ulic.",
      );
    } finally {
      setIsEnrichingListingsFromStreets(false);
    }
  }

  async function retryFailedNieruchomosciOnlineQueue() {
    setIsRetryingFailedNieruchomosciOnlineQueue(true);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/collectors/nieruchomosci-online/retry-failed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 2000 }),
        },
      );
      if (!response.ok)
        throw new Error(`Nieruchomosci-online retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedNieruchomosciOnlineQueue(false);
    }
  }

  async function retryFailedDomiportaQueue() {
    setIsRetryingFailedDomiportaQueue(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/domiporta/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`Domiporta retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedDomiportaQueue(false);
    }
  }

  async function retryFailedMaxonQueue() {
    setIsRetryingFailedMaxonQueue(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/maxon/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok) throw new Error(`Maxon retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedMaxonQueue(false);
    }
  }

  async function retryFailedAdresowoQueue() {
    setIsRetryingFailedAdresowoQueue(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/adresowo/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`Adresowo retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedAdresowoQueue(false);
    }
  }

  async function retryFailedMorizonQueue() {
    setIsRetryingFailedMorizonQueue(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/morizon/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      if (!response.ok)
        throw new Error(`Morizon retry-failed failed with status ${response.status}`);
    } finally {
      setIsRetryingFailedMorizonQueue(false);
    }
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
        retryFailedMorizonQueue(),
      ]);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : "Nie udało się ponowić błędów kolejek.",
      );
    }
  }

  async function resetProcessingNieruchomosciOnlineQueue() {
    const response = await apiFetch(
      `${apiBaseUrl}/api/collectors/nieruchomosci-online/reset-processing`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      },
    );
    if (!response.ok)
      throw new Error(
        `Nieruchomosci-online reset-processing failed with status ${response.status}`,
      );
  }

  async function resetProcessingDomiportaQueue() {
    const response = await apiFetch(`${apiBaseUrl}/api/collectors/domiporta/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 }),
    });
    if (!response.ok)
      throw new Error(`Domiporta reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingMaxonQueue() {
    const response = await apiFetch(`${apiBaseUrl}/api/collectors/maxon/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 }),
    });
    if (!response.ok)
      throw new Error(`Maxon reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingAdresowoQueue() {
    const response = await apiFetch(`${apiBaseUrl}/api/collectors/adresowo/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 }),
    });
    if (!response.ok)
      throw new Error(`Adresowo reset-processing failed with status ${response.status}`);
  }

  async function resetProcessingMorizonQueue() {
    const response = await apiFetch(`${apiBaseUrl}/api/collectors/morizon/reset-processing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2000 }),
    });
    if (!response.ok)
      throw new Error(`Morizon reset-processing failed with status ${response.status}`);
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
        resetProcessingMorizonQueue(),
      ]);
      await refreshQueueStatus();
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : "Nie udało się zresetować przetwarzania.",
      );
    } finally {
      setIsResettingProcessingQueue(false);
    }
  }

  async function runDuplicateAutoMerge() {
    setIsRunningDuplicateAutoMerge(true);
    setDuplicateAutoMergeError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/duplicates/auto-merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10_000 }),
      });
      if (!response.ok) throw new Error(`Duplicate check failed with status ${response.status}`);
      setDuplicateAutoMergeResult((await response.json()) as DuplicateAutoMergeResult);
      await Promise.all([refreshDashboard(), applyFilters()]);
    } catch (error) {
      setDuplicateAutoMergeError(
        error instanceof Error ? error.message : "Duplicate check failed.",
      );
    } finally {
      setIsRunningDuplicateAutoMerge(false);
    }
  }

  async function runRelistingScan() {
    setIsScanningRelistedListings(true);
    setRelistingScanError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/listings/relistings/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      if (!response.ok) throw new Error(`Relisting scan failed with status ${response.status}`);
      setRelistingScanResult((await response.json()) as RelistedListingsScanResponse);
    } catch (error) {
      setRelistingScanError(
        error instanceof Error ? error.message : "Nie udało się sprawdzić ponownie dodanych ofert.",
      );
    } finally {
      setIsScanningRelistedListings(false);
    }
  }
  return {
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
  };
}
