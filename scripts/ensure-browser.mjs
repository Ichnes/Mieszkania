import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { chromium } = require("playwright");
if (!existsSync(chromium.executablePath())) {
  console.log("Przygotowywanie Chromium dla kolektorów ofert…");
  const cli = resolve(dirname(require.resolve("playwright/package.json")), "cli.js");
  const result = spawnSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
