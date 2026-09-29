import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyBackupFiles } from "./backup-verify-files.mjs";

test("backup verification accepts intact files and rejects corruption or incomplete checksums", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mieszkania-backup-test-"));
  const files = ["database.dump", "storage.tar.gz", "counts.txt", "snapshot.json"];
  const checksum = createHash("sha256").update("test").digest("hex");
  const sums = files.map((name) => `${checksum}  ${name}`).join("\n");
  try {
    for (const name of files) writeFileSync(join(directory, name), "test");
    writeFileSync(join(directory, "SHA256SUMS"), sums);
    await verifyBackupFiles(directory, 2);
    writeFileSync(join(directory, "storage.tar.gz"), "changed");
    await assert.rejects(verifyBackupFiles(directory, 2), /storage.tar.gz/);
    writeFileSync(join(directory, "storage.tar.gz"), "test");
    writeFileSync(join(directory, "SHA256SUMS"), sums.split("\n").slice(0, 3).join("\n"));
    await assert.rejects(verifyBackupFiles(directory, 2), /snapshot.json/);
    for (const invalid of [
      `${sums}\n${checksum}  database.dump`,
      `${sums}\n${checksum}  ..\/other`,
    ]) {
      writeFileSync(join(directory, "SHA256SUMS"), invalid);
      await assert.rejects(verifyBackupFiles(directory, 2), /Nieprawidłowy/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
