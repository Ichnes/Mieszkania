import assert from "node:assert/strict";
import test from "node:test";
import type { ListingSummary } from "@mieszkania/shared";
import { resolveCompareListings } from "./selection";

test("comparison retains selected offers outside the current page and filters", () => {
  const saved = { id: "selected", title: "Saved offer" } as ListingSummary;
  const visible = { id: "other" } as ListingSummary;
  assert.deepEqual(resolveCompareListings([saved.id], [visible], [], [saved]), [saved]);
});

test("current facts override cached facts while selection order stays unchanged", () => {
  const old = { id: "a", priceLabel: "Old price" } as ListingSummary;
  const fresh = { ...old, priceLabel: "New price" };
  const other = { id: "b" } as ListingSummary;
  assert.deepEqual(resolveCompareListings(["b", "a"], [fresh], [old, other]), [other, fresh]);
  assert.deepEqual(resolveCompareListings([], [fresh], [old, other]), []);
});
