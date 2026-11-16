import assert from "node:assert/strict";
import test from "node:test";
import { listingHref } from "./links";

test("opening, switching and closing details retains the review tab, filters and anchor", () => {
  for (const search of [
    "?view=candidates",
    "?tab=relistings",
    "?tab=relistings&view=candidates&sort=confidence_asc&page=3",
  ]) {
    const origin = { pathname: "/duplikaty", search, hash: "#propozycje" };
    const opened = new URL(listingHref("offer / 1", origin), "http://localhost");
    assert.equal(opened.searchParams.get("listing"), "offer / 1");
    const switched = new URL(listingHref("offer-2", opened), opened.origin);
    assert.equal(switched.searchParams.getAll("listing").length, 1);
    assert.equal(switched.searchParams.get("listing"), "offer-2");
    assert.equal(listingHref(null, switched), `${origin.pathname}${search}${origin.hash}`);
  }
});

test("closing a plain offer leaves no empty query string", () => {
  assert.equal(
    listingHref(null, { pathname: "/oferty", search: "?listing=1", hash: "" }),
    "/oferty",
  );
});
