import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const args = ["compose", "-f", "compose.yaml"];
if (existsSync(new URL("../compose.override.yaml", import.meta.url)))
  args.push("-f", "compose.override.yaml");
args.push("-f", "compose.dev.yaml", "up", "--build", "--watch", ...process.argv.slice(2));
const child = spawn("docker", args, { cwd, stdio: "inherit" });
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
