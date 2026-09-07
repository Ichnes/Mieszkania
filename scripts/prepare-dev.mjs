import { copyFileSync, existsSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env", constants.COPYFILE_EXCL);
  console.log("Utworzono lokalny .env. W razie potrzeby ustaw w nim dane PostgreSQL.");
}
const npm = process.env.npm_execpath;
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run([npm, "run", "build", "--workspace", "@mieszkania/shared"]);
run([resolve("scripts/ensure-browser.mjs")]);
run(["--import", "tsx", resolve("apps/api/src/scripts/database/setup.ts")]);
