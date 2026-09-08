import assert from "node:assert/strict";
import test from "node:test";
import { buildListingSearch, listingSearchPatterns } from "./listing-search";
test("street adjective cases and Polish diacritics share search patterns", () => {
  assert.deepEqual(listingSearchPatterns("ul. Okopowa"), listingSearchPatterns("Okopowej"));
  assert.deepEqual(listingSearchPatterns("Gwiaździsta"), listingSearchPatterns("gwiazdzistej"));
  assert.deepEqual(listingSearchPatterns("Okopowa 13"), ["\\mokopow(?:a|ej|e)\\M", "13"]);
});
test("search includes saved addresses and binds literal special characters", () => {
  const result = buildListingSearch("a+b [test]", 4);
  assert.ok(result.clause.includes("l.address_text"));
  assert.ok(result.clause.includes("$4") && result.clause.includes("$5"));
  assert.deepEqual(result.values, ["a\\+b", "\\[test\\]"]);
  assert.equal(buildListingSearch("   ", 1).clause, "");
});
