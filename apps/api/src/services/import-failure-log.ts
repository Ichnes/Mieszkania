import { mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { storageRoot } from "../config";

const importFailureLogPath = resolve(storageRoot, "logs", "import-failures.ndjson");

export type ImportFailureLogEntry = {
  sourceKey: string;
  externalId: string;
  canonicalUrl: string;
  error: string;
  attempts: number;
  context?: Record<string, unknown>;
};

export async function appendImportFailureLog(entry: ImportFailureLogEntry) {
  await mkdir(dirname(importFailureLogPath), { recursive: true });
  await appendFile(
    importFailureLogPath,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry
    })}\n`,
    "utf8"
  );
}
