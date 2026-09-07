import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseListing } from "../../collectors/nieruchomosci-online";
import { OtodomStorage } from "../../collectors/otodom/otodom-storage";
import { storageRoot } from "../../config";
import { readArchivedText, resolveArchivedFile } from "../../services/archive/archived-file-reader";

type SnapshotCandidate = {
  externalId: string;
  timestampDir: string;
  rawPath: string;
  parsedPath: string;
};

async function main() {
  const root = join(storageRoot, "offers", "domiporta");
  const storage = new OtodomStorage();
  const candidates = await findLatestSnapshots(root);
  let updated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const rawHtml = await readArchivedText(candidate.rawPath);
      const previousParsed = JSON.parse(await readArchivedText(candidate.parsedPath)) as {
        canonicalUrl?: string;
        description?: string;
      };
      const canonicalUrl =
        previousParsed.canonicalUrl ??
        `https://www.domiporta.pl/nieruchomosci/${candidate.externalId.replace("domiporta-", "")}`;
      const parsed = parseListing(
        canonicalUrl,
        rawHtml,
        candidate.externalId,
        rawHtml.replace(/<[^>]+>/g, " "),
        previousParsed.description,
      );
      await storage.upsertListingSnapshot({
        sourceKey: "domiporta",
        listing: parsed,
        rawArtifact: {
          type: "html",
          storageKey: `sources/domiporta/${parsed.externalId}/raw/reparsed-${Date.now()}.html`,
          payload: { url: canonicalUrl, reparsedFrom: candidate.timestampDir },
        },
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
    if (!entry.isDirectory()) continue;
    const externalId = entry.name;
    const snapshots = (await readdir(join(root, externalId), { withFileTypes: true }))
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort()
      .reverse();
    for (const timestampDir of snapshots) {
      const rawPath = await resolveArchivedFile(join(root, externalId, timestampDir, "raw.html"));
      const parsedPath = await resolveArchivedFile(
        join(root, externalId, timestampDir, "parsed.json"),
      );
      if (rawPath && parsedPath) {
        candidates.push({ externalId, timestampDir, rawPath, parsedPath });
        break;
      }
    }
  }
  return candidates;
}

void main();
