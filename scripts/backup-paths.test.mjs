import assert from "node:assert/strict";
import test from "node:test";
import { windowsStorageSource } from "./backup-paths.mjs";
test("native tar uses only the exact Windows storage bind, never a named or unrelated volume", () => {
  const mounts = (source) => [{ Type: "bind", Destination: "/app/storage", Source: source }];
  for (const path of [
    "C:/data/storage",
    "/run/desktop/mnt/host/c/data/storage",
    "/host_mnt/c/data/storage",
  ])
    assert.equal(windowsStorageSource(mounts(path), "win32"), "C:/data/storage");
  assert.equal(windowsStorageSource(mounts("C:\\data\\storage"), "win32"), "C:\\data\\storage");
  assert.equal(windowsStorageSource(mounts("/var/lib/docker/volumes/data"), "win32"), undefined);
  assert.equal(
    windowsStorageSource(
      [{ Type: "volume", Destination: "/app/storage", Source: "C:/data" }],
      "win32",
    ),
    undefined,
  );
  assert.equal(
    windowsStorageSource([{ Type: "bind", Destination: "/other", Source: "C:/data" }], "win32"),
    undefined,
  );
  assert.equal(windowsStorageSource(mounts("C:/data/storage"), "linux"), undefined);
});
