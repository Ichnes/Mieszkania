import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? findTests(file) : /\.test\.tsx?$/.test(entry.name) ? [file] : [];
  });
}
const files = findTests(resolve(process.argv[2] ?? "src")).sort();
if (!files.length) throw new Error("Nie znaleziono testów.");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
