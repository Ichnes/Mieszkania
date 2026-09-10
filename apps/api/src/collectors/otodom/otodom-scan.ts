import type { SourceListingReference } from "../types";

export async function scanOtodomPages(input: {
  startPage: number;
  maxPages: number;
  batchPages: number;
  stopAfterEmptyBatches: number;
  fetchPage: (page: number) => Promise<SourceListingReference[]>;
  enqueue: (links: SourceListingReference[]) => Promise<{ queued: number }>;
  onError: (
    error: string,
    progress: { failedPage: number; scannedPages: number; discovered: number; queued: number },
  ) => Promise<void>;
}) {
  let queued = 0,
    discovered = 0,
    scannedPages = 0,
    emptyBatches = 0;
  let error: string | undefined;
  scan: while (scannedPages < input.maxPages && emptyBatches < input.stopAfterEmptyBatches) {
    const pagesInBatch = Math.min(input.batchPages, input.maxPages - scannedPages);
    let batchDiscovered = 0;
    for (let offset = 0; offset < pagesInBatch; offset++) {
      const page = input.startPage + scannedPages;
      let links: SourceListingReference[];
      try {
        links = await input.fetchPage(page);
      } catch (cause) {
        error = cause instanceof Error ? cause.message || cause.name : String(cause);
        await input.onError(error, { failedPage: page, scannedPages, discovered, queued });
        break scan;
      }
      // Persist each successful page before requesting the next one.
      queued += (await input.enqueue(links)).queued;
      discovered += links.length;
      batchDiscovered += links.length;
      scannedPages++;
    }
    emptyBatches = batchDiscovered === 0 ? emptyBatches + 1 : 0;
  }
  return {
    startPage: input.startPage,
    scannedPages,
    discovered,
    queued,
    stoppedBecause: error
      ? "error"
      : emptyBatches >= input.stopAfterEmptyBatches
        ? "empty_batches"
        : "max_pages",
    error,
  };
}
