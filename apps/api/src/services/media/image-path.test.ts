import assert from "node:assert/strict";
import test from "node:test";
import { resolveMediaKey, findMediaFilePathAsync, findMediaFilePaths } from "./image-repository";
test("media keys stay within the image root and reject encoded traversal and glob patterns", async () => {
  for (const key of [
    "../auth/users.json",
    "../../.env",
    "/etc/passwd",
    "C:/Windows/win.ini",
    "a/../../x",
    "a\\..\\x",
    "%2e%2e%2f.env",
    "a/*",
    "a/[x]",
    "",
  ]) {
    assert.equal(resolveMediaKey(key), null, key);
    assert.deepEqual(findMediaFilePaths(key), []);
    assert.equal(await findMediaFilePathAsync(key), null);
  }
  assert.ok(resolveMediaKey("sources/otodom/otodom-123/images/0-abc"));
});
