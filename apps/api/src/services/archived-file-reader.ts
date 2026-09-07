import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

const gunzipAsync = promisify(gunzip);

export async function resolveArchivedFile(path: string) {
  if (await exists(path)) return path;
  const compressedPath = `${path}.gz`;
  if (await exists(compressedPath)) return compressedPath;
  return null;
}

export async function readArchivedText(path: string) {
  const bytes = await readFile(path);
  return path.toLowerCase().endsWith(".gz")
    ? (await gunzipAsync(bytes)).toString("utf8")
    : bytes.toString("utf8");
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
