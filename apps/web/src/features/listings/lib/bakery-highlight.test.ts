import assert from "node:assert/strict";
import test from "node:test";
import { getDescriptionHighlightParts } from "./listing-language";

test("Grzybki bakery and Grzybowska street are not mold warnings", () => {
  for (const text of ["piekarnia Grzybki", "Piekarnia Grzybek", "ulica Grzybowska"]) {
    assert.ok(!getDescriptionHighlightParts(text).some((part) => part.tone === "negative"), text);
  }
  assert.ok(
    getDescriptionHighlightParts("Grzyb na ścianie").some((part) => part.tone === "negative"),
  );
});
