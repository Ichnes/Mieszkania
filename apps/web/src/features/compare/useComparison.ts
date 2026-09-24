import { useCallback, useEffect, useState } from "react";
import type { ComparisonListing } from "./lib/types";
import { apiBaseUrl } from "../../shared/lib/api";
import { apiFetch } from "../../shared/lib/http";
import { createLatestRequest } from "../../shared/lib/latest-request";
import {
  fetchComparison,
  readComparisonIds,
  writeComparisonIds,
  type ComparisonIssue,
} from "./lib/persistence";

export function useComparison(enabled: boolean) {
  const [compareListingIds, setCompareListingIds] = useState(readComparisonIds);
  const [compareSnapshots, setCompareSnapshots] = useState<ComparisonListing[]>([]);
  const [compareIssues, setCompareIssues] = useState<ComparisonIssue[]>([]);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [comparisonStorageAvailable, setComparisonStorageAvailable] = useState(true);
  const [request] = useState(createLatestRequest);

  useEffect(() => {
    setComparisonStorageAvailable(writeComparisonIds(compareListingIds));
  }, [compareListingIds]);

  const refreshComparison = useCallback(
    () =>
      request.run(
        (signal) =>
          fetchComparison(compareListingIds, (id) =>
            apiFetch(`${apiBaseUrl}/api/listings/${encodeURIComponent(id)}`, {
              signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
            }),
          ),
        {
          start: () => {
            setIsLoadingCompare(true);
            setCompareIssues([]);
          },
          success: ({ listings, issues }) => {
            setCompareSnapshots(listings);
            setCompareIssues(issues);
          },
          error: () => {
            setCompareSnapshots([]);
            setCompareIssues(compareListingIds.map((id) => ({ id, reason: "unavailable" })));
          },
          finish: () => setIsLoadingCompare(false),
        },
      ),
    [compareListingIds, request],
  );

  useEffect(() => {
    if (enabled) void refreshComparison();
    else setIsLoadingCompare(false);
    return () => request.cancel();
  }, [enabled, refreshComparison, request]);

  return {
    compareListingIds,
    setCompareListingIds,
    compareSnapshots,
    setCompareSnapshots,
    compareIssues,
    isLoadingCompare,
    comparisonStorageAvailable,
    refreshComparison,
  };
}
