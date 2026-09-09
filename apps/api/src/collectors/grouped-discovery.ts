import type { SearchContract } from "@mieszkania/shared";
import type { SourceListingReference } from "./types";
import { splitLocationGroups } from "./location-groups";

export async function discoverLocationGroups(input: {
  city: string;
  contract: SearchContract;
  startPage: number;
  maxPages: number;
  groupSize?: number;
  fetchReferences: (page: number, contract: SearchContract) => Promise<SourceListingReference[]>;
  enqueue: (references: SourceListingReference[]) => Promise<{ queued: number }>;
}) {
  const seen = new Set<string>();
  const errors: string[] = [];
  let scannedPages = 0;
  let queued = 0;
  let reachedLimit = false;
  const groups = splitLocationGroups(input.contract.districts, input.groupSize);
  for (const districts of groups) {
    let emptyPages = 0;
    for (let offset = 0; offset < input.maxPages; offset++) {
      const page = input.startPage + offset;
      try {
        const references = await input.fetchReferences(page, { ...input.contract, districts });
        scannedPages++;
        const unseen = references.filter((reference) => !seen.has(reference.externalId));
        const result = await input.enqueue(unseen);
        unseen.forEach((reference) => seen.add(reference.externalId));
        queued += result.queued;
        // Overlap with earlier groups is not an empty page.
        emptyPages = references.length ? 0 : emptyPages + 1;
        if (emptyPages >= 2) break;
        if (offset === input.maxPages - 1) reachedLimit = true;
      } catch (error) {
        if (!(page > 1 && error instanceof Error && /^HTTP 404(?:\s|:)/i.test(error.message))) {
          errors.push(
            `${districts.join(", ") || input.city}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        break;
      }
    }
  }
  return {
    city: input.city,
    startPage: input.startPage,
    scannedPages,
    discovered: seen.size,
    queued,
    locationGroups: groups.length,
    stoppedBecause: errors.length ? "error" : reachedLimit ? "max_pages" : "empty_batches",
    error: errors.length ? errors.join("; ") : undefined,
  };
}
