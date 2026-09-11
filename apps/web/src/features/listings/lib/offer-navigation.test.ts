import assert from "node:assert/strict";
import test from "node:test";
import { getOfferStep } from "./offer-navigation";
test("offer navigation follows displayed ordering and page boundaries", () => {
  assert.equal(getOfferStep(["b", "a"], "b", 1, 3, 1)?.listingId, "a");
  assert.equal(getOfferStep(["b", "a"], "b", 1, 3, -1), null);
  assert.deepEqual(getOfferStep(["b", "a"], "a", 1, 3, 1), {
    page: 2,
    edge: "first",
    label: "Następna strona · pierwsza oferta",
  });
  assert.deepEqual(getOfferStep(["c"], "c", 2, 3, -1), {
    page: 1,
    edge: "last",
    label: "Poprzednia strona · ostatnia oferta",
  });
  assert.equal(getOfferStep(["c"], "c", 3, 3, 1), null);
  assert.equal(getOfferStep(["c"], "unknown", 1, 3, 1), null);
});
