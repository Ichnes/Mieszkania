import { AsyncLocalStorage } from "node:async_hooks";

export type DiscoveryProgress = {
  source: string;
  status: "running" | "completed" | "error";
  scannedPages: number;
  pageLimit: number;
  queued: number;
  stoppedBecause?: string;
};
const context = new AsyncLocalStorage<DiscoveryProgress>();
const latest = new Map<string, DiscoveryProgress>();

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
  };
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
