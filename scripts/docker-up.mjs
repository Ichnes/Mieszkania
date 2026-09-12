import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { printDockerUrls } from "./docker-urls.mjs";

const child = spawn(
  "docker",
  ["compose", "up", "-d", "--build", "--wait", ...process.argv.slice(2)],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }
  try {
    printDockerUrls();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
});
