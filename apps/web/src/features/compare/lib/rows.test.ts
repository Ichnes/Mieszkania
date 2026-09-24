import assert from "node:assert/strict";
import test from "node:test";
import type { ComparisonListing } from "./types";
import { buildComparisonRows, visibleComparisonRows } from "./rows";
import { fetchComparison } from "./persistence";
import { resolveCompareListings } from "./selection";

const base = { id: "a", priceLabel: "900 000 zł", areaLabel: "60 m²" } as ComparisonListing;
const row = (listings: ComparisonListing[], id: string) =>
  buildComparisonRows(listings).find((item) => item.id === id)!;

test("differences distinguish missing facts, false and zero without hiding a single offer", () => {
  const listings = [base, { ...base, id: "b", hasGarage: false, floor: 0, dreamScore: 0 }];
  const rows = buildComparisonRows(listings);
  assert.deepEqual(row(listings, "garage").values, ["Brak danych", "Nie"]);
  assert.deepEqual(row(listings, "floor").values, ["Brak danych", "Parter"]);
  assert.deepEqual(row(listings, "score").values, ["Brak danych", "0%"]);
  assert.deepEqual(
    visibleComparisonRows(rows, true, 2).map(({ id }) => id),
    ["floor", "garage", "score"],
  );
  assert.equal(visibleComparisonRows(rows, false, 2).length, rows.length);
  assert.equal(visibleComparisonRows(rows, true, 1).length, rows.length);
  assert.deepEqual(
    visibleComparisonRows(buildComparisonRows([base, { ...base, id: "b" }]), true, 2),
    [],
  );
});

test("exposure overrides the description and direction order does not create differences", () => {
  const listings: ComparisonListing[] = [
    { ...base, description: "Okna na północ", exposureDirectionsOverride: ["S", "W"] },
    { ...base, id: "b", manual: { exposureDirectionsOverride: ["W", "S", "S"] } },
  ];
  assert.equal(row(listings, "exposure").different, false);
  assert.equal(row(listings, "exposure").values[0], "Południe · Zachód");
});

test("restored details retain current contact agreements in selection order", async () => {
  const { listings } = await fetchComparison(["b", "a"], async (id) =>
    Response.json({
      ...base,
      id,
      manual: {
        notes: id === "a" ? "Nowe ustalenia\nDrugi punkt" : "",
        negotiatedPriceAmount: 850000,
        contactStatus: "negotiating",
      },
      priceSource: "negotiated",
    }),
  );
  const selected = resolveCompareListings(["b", "a"], listings);
  assert.deepEqual(row(selected, "notes").values, ["Brak notatek", "Nowe ustalenia\nDrugi punkt"]);
  assert.deepEqual(row(selected, "contact").values, ["W negocjacjach", "W negocjacjach"]);
  assert.equal(row(selected, "negotiated").values[0].replace(/\s/g, ""), "850000zł");
  assert.deepEqual(row(selected, "advertised-price").values, ["Brak danych", "Brak danych"]);
});

test("commutes align by destination key, preserve missing results and label approximate locations", () => {
  const workplaces = [
    { key: "one", label: "Cel", address: "", latitude: 52, longitude: 21 },
    { key: "two", label: "Cel", address: "", latitude: 53, longitude: 22 },
  ];
  const listings: ComparisonListing[] = [
    { ...base, latitude: 52, longitude: 21, coordinateAccuracy: "approximate" },
    { ...base, id: "b" },
  ];
  const rows = buildComparisonRows(listings, workplaces, {
    a: [{ key: "two", label: "Cel", durationMinutes: 0, distanceKm: 0 }],
  });
  assert.deepEqual(rows.find(({ id }) => id === "commute:one")?.values, [
    "Brak wyniku trasy — ponów obliczenie",
    "Brak lokalizacji oferty",
  ]);
  assert.match(
    rows.find(({ id }) => id === "commute:two")!.values[0],
    /około 0 min · 0 km · przybliżona lokalizacja/,
  );
  assert.match(
    buildComparisonRows(listings, workplaces, { a: "error" }).at(-1)!.values[0],
    /Nie udało/,
  );
  assert.equal(
    buildComparisonRows(listings, workplaces).at(-1)!.values[0],
    "Jeszcze nie obliczono",
  );
  assert.match(
    buildComparisonRows(listings, [{ ...workplaces[0], latitude: undefined }]).at(-1)!.values[0],
    /Uzupełnij/,
  );
});
