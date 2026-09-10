import assert from "node:assert/strict";
import test from "node:test";
import { scanOtodomPages } from "./otodom-scan";

test("a persisted checkpoint resumes the failed page and keeps the original last page", async () => {
  let nextPage = 51;
  const saved: number[] = [];
  const requested: number[] = [];
  const run = (fail: boolean) =>
    scanOtodomPages({
      startPage: nextPage,
      maxPages: 60 - nextPage + 1,
      batchPages: 5,
      stopAfterEmptyBatches: 2,
      fetchPage: async (page) => {
        requested.push(page);
        if (fail && page === 53) throw new Error("CAPTCHA");
        return [{ externalId: String(page), url: `https://example.com/${page}` }];
      },
      enqueue: async (links) => {
        saved.push(Number(links[0].externalId));
        return { queued: links.length };
      },
      onProgress: async (page) => {
        assert.equal(saved.at(-1), page - 1);
        nextPage = page;
      },
      onError: async () => {},
    });
  assert.equal((await run(true)).stoppedBecause, "error");
  assert.equal(nextPage, 53);
  assert.equal((await run(false)).stoppedBecause, "max_pages");
  assert.deepEqual(requested, [51, 52, 53, 53, 54, 55, 56, 57, 58, 59, 60]);
  assert.deepEqual(saved, [51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
});

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
