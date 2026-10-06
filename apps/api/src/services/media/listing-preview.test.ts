import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../db";
import { getDuplicateListingPreviews } from "./listing-preview";
import { getMediaDownloadCandidates } from "./image-repository";

test("previews fall back only to existing group members and mark the shared image boundary", async () => {
  const db = {
    query: async (sql: string) => ({
      rows: sql.includes("sibling_id")
        ? [{ listing_id: "archive", sibling_id: "live" }]
        : [{ listing_id: "live", source_url: "https://example.test/live.jpg", storage_key: null }],
    }),
  };
  const previews = await getDuplicateListingPreviews(["archive", "unrelated"], db as never);
  assert.deepEqual(previews.get("archive"), {
    urls: ["https://example.test/live.jpg"],
    sharedFromIndex: 0,
  });
  assert.deepEqual(previews.get("unrelated"), { urls: [], sharedFromIndex: undefined });
});

test("repairs a downloaded asset whose local file is missing", async (t) => {
  t.mock.method(pool, "query", async () => {
    return {
      rows: [
        {
          asset_id: "missing",
          storage_key: "test-missing-file",
          source_url: "https://example.test/photo.jpg",
          download_status: "downloaded",
        },
      ],
    };
  });
  assert.deepEqual(await getMediaDownloadCandidates({ listingId: "archive", limit: 1 }), [
    {
      assetId: "missing",
      storageKey: "test-missing-file",
      sourceUrl: "https://example.test/photo.jpg",
    },
  ]);
});
