import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { storageRoot } from "../../config";
import type { FetchedListingDocument } from "../types";

const compress = promisify(gzip);

export class OtodomMissingPriceError extends Error {
  constructor(
    externalId: string,
    url: string,
    public readonly diagnostics: Record<string, unknown>,
  ) {
    super(`MISSING_PRICE: ${externalId} (${url})`);
  }
}

// Keep failed responses separate from the last successfully archived listing.
export async function missingPriceError(document: FetchedListingDocument, externalId: string) {
  const checksum = createHash("sha256").update(document.html).digest("hex");
  const key = `logs/otodom-responses/${checksum}.html.gz`;
  const diagnostics: Record<string, unknown> = {
    statusCode: document.statusCode,
    finalUrl: document.finalUrl ?? document.url,
    responseBytes: Buffer.byteLength(document.html),
    hasNextData: document.html.includes("__NEXT_DATA__"),
    responseChecksum: checksum,
  };
  try {
    await mkdir(join(storageRoot, "logs/otodom-responses"), { recursive: true });
    await writeFile(join(storageRoot, key), await compress(document.html), { flag: "wx" });
    diagnostics.responseStorageKey = key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") diagnostics.responseStorageKey = key;
    else diagnostics.captureError = error instanceof Error ? error.message : String(error);
  }
  return new OtodomMissingPriceError(externalId, document.url, diagnostics);
}
