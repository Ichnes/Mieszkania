import assert from "node:assert/strict";
import test from "node:test";
import { scanOtodomPages } from "./otodom-scan";

test("a 600-page scan preserves every successful page before a failure inside a batch", async () => {
  const queued: string[] = [];
  let reported: unknown;
  const result = await scanOtodomPages({
    startPage: 1,
    maxPages: 600,
    batchPages: 5,
    stopAfterEmptyBatches: 2,
    fetchPage: async (page) => {
      assert.equal(queued.length, page - 1);
      if (page === 7) throw new Error("HTTP 405");
      return [{ externalId: String(page), url: `https://example.com/${page}` }];
    },
    enqueue: async (links) => {
      queued.push(...links.map((link) => link.externalId));
      return { queued: links.length };
    },
    onError: async (error, progress) => {
      reported = { error, ...progress };
    },
  });
  assert.equal(result.scannedPages, 6);
  assert.equal(result.queued, 6);
  assert.equal(result.stoppedBecause, "error");
  assert.deepEqual(reported, {
    error: "HTTP 405",
    failedPage: 7,
    scannedPages: 6,
    discovered: 6,
    queued: 6,
  });
});
