import assert from "node:assert/strict";
import test from "node:test";
import {
  findRelistedListingRows,
  matchRelistedListingRows,
  type RelistingMatchRow,
} from "./listing-relistings";

const description = Array.from({ length: 40 }, (_, index) => `unikalne${index}`).join(" ");

function row(
  input: Partial<RelistingMatchRow> & Pick<RelistingMatchRow, "id" | "status">,
): RelistingMatchRow {
  return {
    id: input.id,
    status: input.status,
    title: input.title ?? `Oferta ${input.id}`,
    sourceLabel: input.sourceLabel ?? "Portal",
    canonicalUrl: input.canonicalUrl ?? `https://example.test/${input.id}`,
    city: input.city ?? "Warszawa",
    addressText: input.addressText ?? "Motorowa 10, Warszawa",
    description: input.description ?? description,
    rooms: input.rooms ?? 3,
    areaSqm: input.areaSqm ?? 65,
    floor: input.floor ?? 2,
    latitude: input.latitude ?? 52.23,
    longitude: input.longitude ?? 21.04,
    priceAmount: input.priceAmount ?? 1_200_000,
    firstSeenAt: input.firstSeenAt ?? "2026-01-01T10:00:00.000Z",
    lastSeenAt: input.lastSeenAt ?? "2026-02-01T10:00:00.000Z",
    removedAt: input.removedAt ?? (input.status === "removed" ? "2026-02-01T10:00:00.000Z" : null),
  };
}

test("matches a newly added active offer to an older archived version and calculates its price change", () => {
  const matches = matchRelistedListingRows([
    row({ id: "old", status: "removed", priceAmount: 1_200_000 }),
    row({
      id: "new",
      status: "active",
      firstSeenAt: "2026-03-01T10:00:00.000Z",
      lastSeenAt: "2026-03-01T10:00:00.000Z",
      priceAmount: 1_140_000,
    }),
  ]);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].previous.id, "old");
  assert.equal(matches[0].current.id, "new");
  assert.equal(matches[0].priceDifferenceAmount, -60_000);
  assert.equal(matches[0].priceDifferencePercent, -5);
});

test("does not call an overlapping or later archive a relisting", () => {
  const matches = matchRelistedListingRows([
    row({ id: "old", status: "removed", removedAt: "2026-04-01T10:00:00.000Z" }),
    row({ id: "new", status: "active", firstSeenAt: "2026-03-01T10:00:00.000Z" }),
  ]);

  assert.equal(matches.length, 0);
});

test("does not match different descriptions based only on physical parameters", () => {
  const matches = matchRelistedListingRows([
    row({ id: "old", status: "removed", description }),
    row({
      id: "new",
      status: "active",
      firstSeenAt: "2026-03-01T10:00:00.000Z",
      description: Array.from({ length: 40 }, (_, index) => `inne${index}`).join(" "),
    }),
  ]);

  assert.equal(matches.length, 0);
});

test("chooses the most recent archived version when confidence is equal", () => {
  const matches = matchRelistedListingRows([
    row({ id: "oldest", status: "removed", removedAt: "2026-01-15T10:00:00.000Z" }),
    row({
      id: "latest",
      status: "removed",
      firstSeenAt: "2026-01-20T10:00:00.000Z",
      removedAt: "2026-02-20T10:00:00.000Z",
    }),
    row({ id: "new", status: "active", firstSeenAt: "2026-03-01T10:00:00.000Z" }),
  ]);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].previous.id, "latest");
});

const potentialRows = () => [
  row({ id: "archive", status: "removed", priceAmount: 1_200_000 }),
  row({
    id: "current",
    status: "active",
    firstSeenAt: "2026-03-01T10:00:00.000Z",
    description: "Nowy opis od innego agenta.",
    priceAmount: 1_100_000,
  }),
];

test("changed descriptions produce suggestions with evidence, never confirmed relistings", () => {
  const { matches, candidates } = findRelistedListingRows(potentialRows());
  assert.equal(matches.length, 0);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].previous.id, "archive");
  assert.equal(candidates[0].current.id, "current");
  assert.equal(candidates[0].priceDifferenceAmount, -100_000);
  assert.ok(candidates[0].confidenceScore < 80);
  assert.ok(candidates[0].reasons.includes("ten sam adres"));
  assert.ok(candidates[0].reasons.includes("to samo piętro"));
  assert.equal(candidates[0].previous.areaSqm, 65);
});

test("suggestions reject mismatched city, room count, area, floor, building number and chronology", () => {
  for (const change of [
    { city: "Kraków" },
    { rooms: 4 },
    { areaSqm: 67 },
    { floor: 3 },
    { addressText: "Motorowa 20, Warszawa" },
    { firstSeenAt: "2026-01-10T10:00:00.000Z" },
  ]) {
    const rows = potentialRows();
    Object.assign(rows[1], change);
    assert.equal(findRelistedListingRows(rows).candidates.length, 0, JSON.stringify(change));
  }
});

test("a generic district, neighborhood or city is not street evidence", () => {
  for (const address of ["Mokotów, Warszawa", "Gocław, Warszawa", "Warszawa", null]) {
    const rows = potentialRows().map((item) => ({ ...item, addressText: address }));
    assert.equal(findRelistedListingRows(rows).candidates.length, 0, String(address));
  }
});

test("keeps multiple plausible archives, caps at five, and strong matches suppress suggestions", () => {
  const [archive, current] = potentialRows();
  const archives = Array.from({ length: 8 }, (_, i) => ({ ...archive, id: `archive-${i}` }));
  assert.equal(findRelistedListingRows([...archives, current]).candidates.length, 5);
  const result = findRelistedListingRows([
    ...archives,
    { ...archive, id: "strong", description: current.description + " " + description },
    { ...current, description: current.description + " " + description },
  ]);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].previous.id, "strong");
  assert.equal(result.candidates.length, 0);
});

test("normalizes Polish street prefixes and supports rounding across area buckets", () => {
  const rows = potentialRows();
  rows[0].addressText = "ul. Postępu 12, Warszawa";
  rows[1].addressText = "Postępu 12, Warszawa";
  rows[0].areaSqm = 64.8;
  assert.equal(findRelistedListingRows(rows).candidates.length, 1);
});

test("similar descriptions at different numbered addresses do not become confirmed matches", () => {
  const rows = potentialRows();
  rows[1].addressText = "Motorowa 20, Warszawa";
  rows[1].description = description.split(" ").reverse().join(" ");
  const result = findRelistedListingRows(rows);
  assert.equal(result.matches.length, 0);
  assert.equal(result.candidates.length, 0);
});

test("partial description similarity can suggest an archive when the floor is missing", () => {
  for (const sharedWords of [20, 24]) {
    const rows = potentialRows();
    rows[1].floor = null;
    rows[1].description = [
      ...description.split(" ").slice(0, sharedWords),
      ...Array.from({ length: 40 - sharedWords }, (_, index) => `changedword${index}`),
    ].join(" ");
    const result = findRelistedListingRows(rows);
    assert.equal(result.matches.length, 0);
    assert.equal(result.candidates.length, sharedWords === 24 ? 1 : 0);
  }
});
