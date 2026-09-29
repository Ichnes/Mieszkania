import { readFileSync, createReadStream, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

function progressStream(path, label) {
  const total = statSync(path).size;
  const input = createReadStream(path);
  const timer = setInterval(() => {
    console.log(
      `${label}: ${Math.floor((input.bytesRead / Math.max(total, 1)) * 100)}% (${(input.bytesRead / 1024 ** 3).toFixed(1)} / ${(total / 1024 ** 3).toFixed(1)} GiB)`,
    );
  }, 15000);
  timer.unref();
  input.once("close", () => clearInterval(timer));
  return input;
}

export async function verifyBackupFiles(directory, format) {
  const required =
    format === 2
      ? ["database.dump", "storage.tar.gz", "counts.txt", "snapshot.json"]
      : ["database.dump", "storage.tar", "counts.txt"];
  const lines = readFileSync(join(directory, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
  const checksums = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  ([a-zA-Z0-9.-]+)$/.exec(line);
    if (!match || !required.includes(match[2]) || checksums.has(match[2]))
      throw new Error("Nieprawidłowy plik sum kontrolnych.");
    checksums.set(match[2], match[1]);
  }
  for (const name of required) {
    const hash = createHash("sha256");
    for await (const chunk of progressStream(join(directory, name), `Suma ${name}`))
      hash.update(chunk);
    if (hash.digest("hex") !== checksums.get(name))
      throw new Error(`Niezgodna suma kontrolna: ${name}. Nie odtwarzam uszkodzonej kopii.`);
  }
}

export async function streamArchiveToContainer(container, archivePath, operation, compressed) {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "tar",
      `-${compressed ? "z" : ""}${operation}f`,
      "-",
      "-C",
      "/restored-storage",
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let details = "";
  child.stderr.on("data", (chunk) => {
    details = (details + chunk).slice(-1000);
  });
  const finished = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Nie udało się ${operation === "x" ? "odtworzyć" : "porównać"} plików: ${details}`,
            ),
          ),
    );
  });
  const input = progressStream(
    archivePath,
    operation === "x" ? "Odtwarzanie plików" : "Porównanie plików",
  );
  try {
    await Promise.all([finished, pipeline(input, child.stdin)]);
  } catch (error) {
    input.destroy();
    child.kill();
    throw error;
  }
}
