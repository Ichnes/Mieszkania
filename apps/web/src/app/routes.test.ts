import assert from "node:assert/strict";
import test from "node:test";
import { routePaths, tabFromPath } from "./routes";

test("each bookmarkable tab resolves to its own view, including trailing slashes", () => {
  for (const [tab, path] of Object.entries(routePaths)) {
    assert.equal(tabFromPath(path), tab);
    assert.equal(tabFromPath(`${path}/`), tab);
  }
  assert.equal(new Set(Object.values(routePaths)).size, 8);
});

test("legacy root links retain the offers default", () => {
  assert.equal(tabFromPath("/"), "dashboard");
});
