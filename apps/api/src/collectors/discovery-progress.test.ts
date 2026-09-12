import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultSearchContract } from "@mieszkania/shared";
import {
  readDiscoveryProgress,
  reportDiscoveryProgress,
  withDiscoveryProgress,
} from "./discovery-progress";
import { discoverLocationGroups } from "./grouped-discovery";

test("parallel scans keep independent live counters and finish or fail separately", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = withDiscoveryProgress("test-first", async () => {
    reportDiscoveryProgress({ scannedPages: 2, queued: 3, pageLimit: 50 });
    await waiting;
    return { scannedPages: 2, queued: 3, stoppedBecause: "empty_batches" };
  });
  await withDiscoveryProgress("test-second", async () => {
    reportDiscoveryProgress({ scannedPages: 1, pageLimit: 20 });
    return { scannedPages: 1, queued: 0, stoppedBecause: "error" };
  });
  const firstStatus = () => readDiscoveryProgress().find((item) => item.source === "test-first")!;
  assert.equal(firstStatus().status, "running");
  assert.equal(firstStatus().scannedPages, 2);
  await assert.rejects(
    withDiscoveryProgress("test-first", async () => ({
      scannedPages: 0,
      queued: 0,
      stoppedBecause: "max_pages",
    })),
    /już trwa/,
  );
  release();
  await first;
  assert.equal(firstStatus().status, "completed");
  assert.equal(
    readDiscoveryProgress().find((item) => item.source === "test-second")!.status,
    "error",
  );
  await assert.rejects(
    withDiscoveryProgress("test-throw", async () => {
      throw new Error("network");
    }),
    /network/,
  );
  assert.equal(
    readDiscoveryProgress().find((item) => item.source === "test-throw")!.status,
    "error",
  );
});

test("grouped scan reports all location limits and can finish before reaching the limit", async () => {
  await withDiscoveryProgress("test-groups", () =>
    discoverLocationGroups({
      city: "warszawa",
      contract: { ...createDefaultSearchContract(), districts: ["Wola", "Ochota"] },
      startPage: 1,
      maxPages: 10,
      groupSize: 1,
      fetchReferences: async () => [],
      enqueue: async () => ({ queued: 0 }),
    }),
  );
  const status = readDiscoveryProgress().find((item) => item.source === "test-groups")!;
  assert.equal(status.pageLimit, 20);
  assert.equal(status.scannedPages, 4);
  assert.equal(status.status, "completed");
});
