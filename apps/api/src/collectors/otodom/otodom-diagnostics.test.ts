import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { archiveFailedResponse } from "./otodom-diagnostics";

test("failed search response is archived losslessly with status and diagnostic headers", async () => {
  const prefix = join(tmpdir(), "otodom-response-test-");
  const root = await mkdtemp(prefix);
  try {
    const doc = {
      url: "https://www.otodom.pl/pl/wyniki?page=137",
      statusCode: 405,
      html: "<html><body>Response from failed search</body></html>",
      responseHeaders: { allow: "GET" },
    };
    const info = await archiveFailedResponse(doc, root);
    assert.equal(info.statusCode, 405);
    assert.deepEqual(info.responseHeaders, { allow: "GET" });
    const file = join(root, String(info.responseStorageKey));
    assert.equal(gunzipSync(await readFile(file)).toString(), doc.html);
    assert.equal(
      (await archiveFailedResponse(doc, root)).responseStorageKey,
      info.responseStorageKey,
    );
  } finally {
    if (!resolve(root).startsWith(resolve(prefix))) throw new Error("Invalid test directory");
    await rm(root, { recursive: true });
  }
});
