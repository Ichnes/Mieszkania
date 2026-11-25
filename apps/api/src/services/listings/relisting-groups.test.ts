import assert from "node:assert/strict";
import test from "node:test";
import type { RelistedListingMatch } from "@mieszkania/shared";
import { groupRelistings } from "./relisting-results";

test("groups chains and branches before pagination even when their edges are interleaved", () => {
  const offer = (id: string) => ({ id, title: id, sourceLabel: "Portal", eventAt: "2026-01-01" });
  const edge = (a: string, b: string): RelistedListingMatch => ({
    previous: offer(a),
    current: offer(b),
    confidenceScore: 95,
    reasons: [],
  });
  const a = edge("old", "middle"),
    b = edge("else", "other"),
    c = edge("middle", "current"),
    d = edge("alternate", "current");
  assert.deepEqual(groupRelistings([c, b, d, a]), [[c, d, a], [b]]);
});
