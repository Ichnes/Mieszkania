import assert from "node:assert/strict";
import test from "node:test";
import { matchRelistedListingRows, type RelistingMatchRow } from "./listing-relistings";

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
