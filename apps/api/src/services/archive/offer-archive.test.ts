import assert from "node:assert/strict";
import test from "node:test";
import { compactArchivePayload, createListingArchiveChecksum } from "./offer-archive";

test("compactArchivePayload removes nested HTML while keeping parsed facts", () => {
  const compact = compactArchivePayload({
    title: "Mieszkanie",
    rawPayload: {
      html: "<html>bardzo duzy dokument</html>",
      primaryHtml: "<html>druga kopia</html>",
      jsonLd: { price: 750_000 },
    },
  });

  assert.deepEqual(compact, {
    title: "Mieszkanie",
    rawPayload: { jsonLd: { price: 750_000 } },
  });
});

test("archive checksum ignores portal markup but changes with meaningful listing data", () => {
  const base = {
    externalId: "123",
    canonicalUrl: "https://example.test/123",
    title: "Mieszkanie",
    description: "Opis",
    priceAmount: 750_000,
    images: [{ sourceUrl: "https://img.test/1.jpg", position: 0, isPrimary: true }],
    rawPayload: { html: "pierwsza wersja techniczna" },
  };

  assert.equal(
    createListingArchiveChecksum(base),
    createListingArchiveChecksum({ ...base, rawPayload: { html: "inna wersja techniczna" } }),
  );
  assert.notEqual(
    createListingArchiveChecksum(base),
    createListingArchiveChecksum({ ...base, priceAmount: 735_000 }),
  );
});
