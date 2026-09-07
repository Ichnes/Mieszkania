import "../config";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { GratkaParser } from "../collectors/gratka/gratka-parser";
import { OtodomStorage } from "../collectors/otodom/otodom-storage";
import { readArchivedText, resolveArchivedFile } from "../services/archived-file-reader";

type SnapshotCandidate = {
  externalId: string;
  timestampDir: string;
  rawPath: string;
  parsedPath: string;
};

async function main() {
  const root = join(process.cwd(), "storage", "offers", "gratka");
  const parser = new GratkaParser();
  const storage = new OtodomStorage();
  const candidates = await findLatestSnapshots(root);

  let updated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const rawHtml = await readArchivedText(candidate.rawPath);
      const previousParsed = JSON.parse(await readArchivedText(candidate.parsedPath)) as { canonicalUrl?: string };
      const canonicalUrl = previousParsed.canonicalUrl ?? `https://gratka.pl/nieruchomosci/ob/${candidate.externalId.replace("gratka-", "")}`;
      const parsed = await parser.parse({
        url: canonicalUrl,
        finalUrl: canonicalUrl,
        html: rawHtml,
        statusCode: 200
      });

      await storage.upsertListingSnapshot({
        sourceKey: "gratka",
        listing: parsed,
        rawArtifact: {
          type: "html",
          storageKey: `sources/gratka/${parsed.externalId}/raw/reparsed-${Date.now()}.html`,
          payload: {
            html: rawHtml,
            url: canonicalUrl,
            reparsedFrom: candidate.timestampDir
          }
        }
      });

      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to reparse ${candidate.externalId}:`, error);
    }
  }

  console.log(JSON.stringify({ updated, failed, total: candidates.length }, null, 2));
}

async function findLatestSnapshots(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  const candidates: SnapshotCandidate[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const externalId = entry.name;
    const snapshotDirs = (await readdir(join(root, externalId), { withFileTypes: true }))
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort()
      .reverse();

    for (const timestampDir of snapshotDirs) {
      const rawPath = await resolveArchivedFile(join(root, externalId, timestampDir, "raw.html"));
      const parsedPath = await resolveArchivedFile(join(root, externalId, timestampDir, "parsed.json"));
      if (rawPath && parsedPath) {
        candidates.push({ externalId, timestampDir, rawPath, parsedPath });
        break;
      }
    }
  }

  return candidates;
}

void main();
