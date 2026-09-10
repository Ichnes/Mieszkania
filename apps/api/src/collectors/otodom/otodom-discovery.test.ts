import assert from "node:assert/strict";
import test from "node:test";
import { OtodomDiscovery } from "./otodom-discovery";
import type { logOtodomSearchFailure } from "./otodom-diagnostics";

test("discovery captures failed bodies, exact page and run context, and preserves the first error", async () => {
  const records: Parameters<typeof logOtodomSearchFailure>[0][] = [];
  let calls = 0;
  const discovery = new OtodomDiscovery(
    {
      fetchListing: async (url) => ({
        url,
        html: `response-${++calls}`,
        statusCode: calls === 1 ? 405 : 404,
      }),
    },
    async (record) => {
      records.push(record);
    },
  );
  await assert.rejects(
    discovery.discoverListingUrls({
      city: "warszawa",
      startPage: 137,
      pages: 1,
      context: { maxPages: 600, runId: "test" },
    }),
    /strona 137, HTTP 405/,
  );
  assert.equal(records.length, 2);
  assert.equal(records[0].document?.html, "response-1");
  assert.equal(records[1].document?.html, "response-2");
  assert.equal(records[0].page, 137);
  assert.equal(records[0].context?.maxPages, 600);
  assert.equal(new URL(records[0].url).searchParams.get("page"), "137");
});
