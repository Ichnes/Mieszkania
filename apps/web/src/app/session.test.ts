import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeListingFilters, createListingsQuery } from "./session";

test("district multi-selection survives session sanitizing and request serialization", () => {
  const filters = sanitizeListingFilters({
    district: "Wola",
    districts: ["Bemowo", "Ursus", "Bemowo", null, ""],
  });
  assert.deepEqual(filters.districts, ["Bemowo", "Ursus"]);
  assert.equal(filters.district, undefined);
  const query = new URLSearchParams(createListingsQuery(filters, 2, "newest"));
  assert.equal(query.get("districts"), "Bemowo,Ursus");
  assert.deepEqual(sanitizeListingFilters({ district: "Wola" }).district, "Wola");
  assert.deepEqual(sanitizeListingFilters({ district: "Wola", districts: [] }).districts, []);
});
