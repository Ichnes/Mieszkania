import assert from "node:assert/strict";
import test from "node:test";
import { decodeListingText } from "./listing-text";
import { cleanListingDescription } from "./listing-description-facts";
test("decodes Polish portal entities, numeric references and nested escaping", () => {
  assert.equal(
    decodeListingText("os&oacute;b, Wilan&oacute;w, 60 m&sup2;, &#322; &#x105; &amp;oacute;"),
    "osób, Wilanów, 60 m², ł ą ó",
  );
  assert.equal(cleanListingDescription("Dla os&oacute;b w Wilan&oacute;w"), "Dla osób w Wilanów");
  assert.equal(decodeListingText("&#99999999; &unknown;"), "� &unknown;");
});
