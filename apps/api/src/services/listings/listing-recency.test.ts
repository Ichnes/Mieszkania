import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEffectiveListingDateSql,
  getEffectiveListingDate,
  NEWLY_DISCOVERED_PUBLICATION_GAP_DAYS,
} from "./listing-recency";

test("treats an old portal publication as new when it is first discovered after more than 30 days", () => {
  const effectiveDate = getEffectiveListingDate({
    publishedAt: "2026-03-29T13:18:05.000Z",
    firstSeenAt: "2026-08-31T19:22:15.254Z",
  });

  assert.equal(effectiveDate?.toISOString(), "2026-08-31T19:22:15.254Z");
});

test("keeps the portal publication date when the offer is discovered within 30 days", () => {
  const effectiveDate = getEffectiveListingDate({
    publishedAt: "2026-08-02T12:00:00.000Z",
    firstSeenAt: "2026-08-31T12:00:00.000Z",
  });

  assert.equal(effectiveDate?.toISOString(), "2026-08-02T12:00:00.000Z");
});

test("does not reclassify an offer at the exact 30 day boundary", () => {
  const effectiveDate = getEffectiveListingDate({
    publishedAt: "2026-08-01T12:00:00.000Z",
    firstSeenAt: "2026-08-31T12:00:00.000Z",
  });

  assert.equal(effectiveDate?.toISOString(), "2026-08-01T12:00:00.000Z");
});

test("uses first seen date when the portal did not provide a publication date", () => {
  const effectiveDate = getEffectiveListingDate({
    publishedAt: null,
    firstSeenAt: "2026-08-31T12:00:00.000Z",
  });

  assert.equal(effectiveDate?.toISOString(), "2026-08-31T12:00:00.000Z");
});

test("builds the SQL expression from the same threshold", () => {
  const sql = buildEffectiveListingDateSql("offer");

  assert.match(sql, new RegExp(`interval '${NEWLY_DISCOVERED_PUBLICATION_GAP_DAYS} days'`));
  assert.match(sql, /offer\.first_seen_at/);
  assert.match(sql, /offer\.published_at/);
});
