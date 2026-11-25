import assert from "node:assert/strict";
import test from "node:test";
import { discoveryRange } from "./discovery-range";

test("manual portal scans use an inclusive offset and the displayed defaults", () => {
  assert.deepEqual(discoveryRange("30", "10"), { startPage: 30, maxPages: 10, endPage: 39 });
  assert.deepEqual(discoveryRange("", ""), { startPage: 1, maxPages: 50, endPage: 50 });
  assert.deepEqual(discoveryRange("30", "1"), { startPage: 30, maxPages: 1, endPage: 30 });
  for (const [start, count] of [
    ["0", "10"],
    ["30", "0"],
    ["1", "5001"],
    ["100001", "2"],
  ])
    assert.equal(discoveryRange(start, count), null);
});
