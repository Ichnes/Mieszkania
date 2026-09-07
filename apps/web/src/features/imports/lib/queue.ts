import type { OtodomQueueProcessResponse, OtodomQueueStatusResponse } from "@mieszkania/shared";

export function sumQueueCounts(...statuses: Array<OtodomQueueStatusResponse | null>) {
  return {
    pending: statuses.reduce((sum, status) => sum + (status?.counts.pending ?? 0), 0),
    pendingNew: statuses.reduce((sum, status) => sum + (status?.pendingNew ?? 0), 0),
    pendingPriceUpdates: statuses.reduce(
      (sum, status) => sum + (status?.pendingPriceUpdates ?? 0),
      0,
    ),
    readyPending: statuses.reduce(
      (sum, status) => sum + (status?.readyPending ?? status?.counts.pending ?? 0),
      0,
    ),
    delayedPending: statuses.reduce((sum, status) => sum + (status?.delayedPending ?? 0), 0),
    processing: statuses.reduce((sum, status) => sum + (status?.counts.processing ?? 0), 0),
    completed: statuses.reduce((sum, status) => sum + (status?.counts.completed ?? 0), 0),
    failed: statuses.reduce((sum, status) => sum + (status?.counts.failed ?? 0), 0),
  };
}

export function getNextQueueAttemptAt(...statuses: Array<OtodomQueueStatusResponse | null>) {
  return statuses
    .map((status) => status?.nextAttemptAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

export function getNextProcessAttemptAt(...results: OtodomQueueProcessResponse[]) {
  return results
    .map((result) => result.pausedUntil)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

export function formatQueueAttemptTime(value: string) {
  return new Date(value).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export function formatStaleRefreshTime(value: string, includeDate = false) {
  return new Date(value).toLocaleString(
    "pl-PL",
    includeDate
      ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" },
  );
}
