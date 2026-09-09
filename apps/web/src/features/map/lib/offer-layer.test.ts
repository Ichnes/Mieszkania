import assert from "node:assert/strict";
import test from "node:test";
import { groupMapOffers } from "./offer-layer";

test("thousands of map offers are grouped without dropping collocated listings", () => {
  const points = Array.from({ length: 4000 }, (_, id) => ({ id, x: id % 800, y: id % 600 }));
  const groups = groupMapOffers(points, (point) => point);
  assert.ok(groups.size < 250);
  assert.equal(new Set([...groups.values()].flat().map((point) => point.id)).size, 4000);
  assert.equal(
    groupMapOffers(
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
      (point) => point,
    ).size,
    1,
  );
});

test("world-pixel cells handle negative coordinates and exact cell boundaries", () => {
  const points = [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 51, y: 51 },
    { x: 52, y: 0 },
  ];
  assert.deepEqual(
    [...groupMapOffers(points, (point) => point).values()].map((group) => group.length),
    [1, 2, 1],
  );
});
