import assert from "node:assert/strict";
import test from "node:test";
import { comparisonPrintHtml } from "./print";
import type { ComparisonListing } from "./types";
test("print export escapes untrusted data, rejects script links, includes merged sources and hides notes by default", () => {
  const listing = {
    title: '<script>alert("x")</script>',
    canonicalUrl: "javascript:alert(1)",
    relatedListings: [{ title: "Portal", canonicalUrl: "https://example.test/offer?a=1&b=2" }],
  } as ComparisonListing;
  const rows = [
    { id: "notes", label: "Notatki", values: ["prywatne"], different: false },
    { id: "total-price", label: "Cena z dodatkami", values: ["Brak danych"], different: false },
  ];
  const html = comparisonPrintHtml([listing], rows, false);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("https://example.test/offer?a=1&amp;b=2"));
  assert.ok(html.includes("Brak danych"));
  assert.ok(!html.includes("prywatne"));
  assert.ok(comparisonPrintHtml([listing], rows, true).includes("prywatne"));
});
