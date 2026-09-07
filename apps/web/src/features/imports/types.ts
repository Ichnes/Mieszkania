export type DuplicateAutoMergeResult = { checked: number; merged: number };

export type StaleListingRefreshStatus = {
  due: number;
  started?: boolean;
  running: boolean;
  refreshedLast24Hours?: number;
  nextDueAt?: string;
  lastCheckedAt?: string;
  automationPaused?: boolean;
};
