import { AsyncLocalStorage } from "node:async_hooks";

export type DiscoveryProgress = {
  source: string;
  status: "running" | "completed" | "error";
  scannedPages: number;
  pageLimit: number;
  queued: number;
  duplicatesAdded: number;
  stoppedBecause?: string;
};
const context = new AsyncLocalStorage<DiscoveryProgress>();
const latest = new Map<string, DiscoveryProgress>();
const queuedReferences = new WeakMap<DiscoveryProgress, Set<string>>();

export function trackDiscoveryImport(source: string, externalId: string) {
  const current = context.getStore();
  if (current?.source === source) queuedReferences.get(current)?.add(externalId);
}

// Called only after the listing transaction commits. Removing the reference
// prevents retries from counting the same offer twice.
export function recordDiscoveryImport(source: string, externalId: string, merged: boolean) {
  const current = latest.get(source);
  if (current && queuedReferences.get(current)?.delete(externalId) && merged) {
    current.duplicatesAdded++;
  }
}

export function readDiscoveryProgress() {
  return Array.from(latest.values(), (value) => ({ ...value }));
}

export function reportDiscoveryProgress(
  update: Partial<Pick<DiscoveryProgress, "scannedPages" | "pageLimit" | "queued">>,
) {
  const current = context.getStore();
  if (current) Object.assign(current, update);
}

export async function withDiscoveryProgress<
  T extends { scannedPages: number; queued: number; stoppedBecause: string },
>(source: string, run: () => Promise<T>): Promise<T> {
  // A second request must not replace the counters of the scan already running.
  if (latest.get(source)?.status === "running") throw new Error("Skan tego portalu już trwa.");
  const progress: DiscoveryProgress = {
    source,
    status: "running",
    scannedPages: 0,
    pageLimit: 0,
    queued: 0,
    duplicatesAdded: 0,
  };
  queuedReferences.set(progress, new Set());
  latest.set(source, progress);
  return context.run(progress, async () => {
    try {
      const result = await run();
      Object.assign(progress, {
        scannedPages: result.scannedPages,
        queued: result.queued,
        stoppedBecause: result.stoppedBecause,
        status: result.stoppedBecause === "error" ? "error" : "completed",
      });
      return result;
    } catch (error) {
      progress.status = "error";
      throw error;
    }
  });
}
