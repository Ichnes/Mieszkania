import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Entry = { signature: string; score: number };
export function scoreSignature(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Code changes invalidate persisted computations, including changes in imported helpers. */
export async function rankingCodeVersion() {
  const hash = createHash("sha256");
  const roots = [
    new URL("../../", import.meta.url),
    new URL("../../../../../packages/shared/dist/", import.meta.url),
  ];
  async function visit(directory: string) {
    const children = (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const child of children) {
      const path = join(directory, child.name);
      if (child.isDirectory()) await visit(path);
      else if (
        child.isFile() &&
        /\.(?:ts|js|json)$/.test(child.name) &&
        !child.name.includes(".test.")
      ) {
        hash.update(child.name);
        hash.update(await readFile(path));
      }
    }
  }
  for (const root of roots) await visit(fileURLToPath(root));
  return hash.digest("hex");
}

export function createPersistentScoreCache(filename: string, codeVersion = rankingCodeVersion) {
  const entries = new Map<string, Entry>();
  let loading: Promise<void> | undefined;
  let saving: Promise<void> | undefined;
  let version: string | undefined;
  let revision = 0;
  let savedRevision = 0;
  return {
    async load() {
      loading ??= (async () => {
        try {
          version = await codeVersion();
          if ((await stat(filename)).size > 2_000_000) return;
          const data = JSON.parse(await readFile(filename, "utf8"));
          if (
            data.version !== version ||
            !Array.isArray(data.entries) ||
            data.entries.length > 5000
          )
            return;
          for (const item of data.entries) {
            if (!Array.isArray(item) || item.length !== 2) continue;
            const [id, entry] = item;
            if (
              typeof id === "string" &&
              id.length <= 64 &&
              entry &&
              /^[a-f0-9]{64}$/.test(entry.signature) &&
              typeof entry.score === "number" &&
              Number.isFinite(entry.score) &&
              entry.score >= 0 &&
              entry.score <= 100
            )
              entries.set(id, { signature: entry.signature, score: entry.score });
          }
        } catch {
          /* A missing/corrupt/unwritable cache never blocks the list. */
        }
      })();
      await loading;
    },
    get(id: string) {
      return entries.get(id);
    },
    set(id: string, entry: Entry) {
      if (entries.size >= 5000 && !entries.has(id)) entries.delete(entries.keys().next().value!);
      entries.set(id, entry);
      revision++;
    },
    async save() {
      if (saving) {
        await saving;
        return;
      }
      if (!version || revision === savedRevision) return;
      const currentRevision = revision;
      const content = JSON.stringify({ version, entries: [...entries] });
      saving = (async () => {
        const temporary = `${filename}.${process.pid}.tmp`;
        try {
          await mkdir(dirname(filename), { recursive: true });
          await writeFile(temporary, content, { mode: 0o600 });
          await rename(temporary, filename);
          savedRevision = currentRevision;
        } catch {
          await unlink(temporary).catch(() => undefined);
        }
      })();
      try {
        await saving;
      } finally {
        saving = undefined;
      }
    },
  };
}
