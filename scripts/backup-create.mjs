import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  createWriteStream,
  createReadStream,
} from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { windowsStorageSource } from "./backup-paths.mjs";

export const excludedStorageDirectories = [
  "backups",
  "maintenance",
  "cache",
  "map-thumbnails",
  "logs",
  "qa",
  "audits",
];

export async function createOnlineBackup({ docker, root, directory, mount }) {
  const apiId = docker(["compose", "ps", "-q", "api"]);
  if (!apiId) throw new Error("Uruchom API przed wykonaniem kopii.");
  const inspect = JSON.parse(docker(["inspect", apiId]))[0];
  const network = Object.keys(inspect.NetworkSettings.Networks)[0];
  const source = windowsStorageSource(inspect.Mounts, process.platform);
  const nativeTar =
    source &&
    existsSync(source) &&
    spawnSync("tar.exe", ["--version"], { stdio: "ignore" }).status === 0;
  const config = JSON.parse(
    docker([
      "compose",
      "exec",
      "-T",
      "api",
      "node",
      "--input-type=module",
      "-e",
      "import pg from 'pg';const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query('show server_version_num');console.log(JSON.stringify({url:process.env.DATABASE_URL,version:r.rows[0].server_version_num}));await c.end();",
    ]),
  );
  const major = Math.floor(Number(config.version) / 10000);
  if (!Number.isInteger(major) || major < 14 || major > 30)
    throw new Error("Nieobsługiwana wersja PostgreSQL.");
  const image = `postgres:${major}-bookworm`;
  docker(["pull", image]);
  mkdirSync(directory, { recursive: true });
  const url = new URL(config.url);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
  };
  console.log("Kopia online: aplikacja pozostaje uruchomiona. Przygotowuję spójny snapshot bazy…");
  const exporter = spawn(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "api",
      "node",
      "--input-type=module",
      "-e",
      readFileSync(join(root, "scripts/backup-snapshot.mjs"), "utf8"),
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let exporterError = false;
  exporter.on("error", () => {
    exporterError = true;
  });
  exporter.stderr.resume();
  try {
    const snapshot = await new Promise((resolve, reject) => {
      const lines = createInterface({ input: exporter.stdout });
      const timeout = setTimeout(
        () => reject(new Error("Nie udało się przygotować snapshotu bazy w 10 minut.")),
        600000,
      );
      lines.once("line", (line) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(line));
        } catch {
          reject(new Error("Niepoprawna odpowiedź snapshotu."));
        }
      });
      exporter.once("error", () => {
        clearTimeout(timeout);
        reject(new Error("Nie udało się uruchomić snapshotu."));
      });
      exporter.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("Snapshot bazy zakończył się przedwcześnie."));
      });
    });
    if (!/^[0-9A-Fa-f-]+$/.test(snapshot.id))
      throw new Error("Nieprawidłowy identyfikator snapshotu.");
    writeFileSync(
      join(directory, "counts.txt"),
      snapshot.counts.map((row) => `${row.table}|${row.count}`).join("\n") + "\n",
    );
    docker(
      [
        "run",
        "--rm",
        "--network",
        network,
        "--mount",
        mount,
        ...["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE"].flatMap(
          (key) => ["-e", key],
        ),
        image,
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${snapshot.id}`,
        "--file=/backup/database.dump",
      ],
      { env },
    );
    if (exporterError || exporter.exitCode !== null)
      throw new Error("Połączenie snapshotu zostało przerwane.");
    writeFileSync(
      join(directory, "snapshot.json"),
      JSON.stringify({ capturedAt: snapshot.capturedAt, counts: snapshot.counts }, null, 2) + "\n",
    );
  } finally {
    exporter.stdin.end();
  }

  console.log(
    "Baza skopiowana. Pakuję dane i oryginalne zdjęcia (gzip), pomijając cache i stare kopie techniczne…",
  );
  const excludes = excludedStorageDirectories.map((name) => `--exclude=./${name}`);
  const command = nativeTar ? "tar.exe" : "docker";
  const args = nativeTar
    ? ["-cf", "-", ...excludes, "-C", source, "."]
    : [
        "run",
        "--rm",
        "--volumes-from",
        `${apiId}:ro`,
        image,
        "tar",
        "-cf",
        "-",
        ...excludes,
        "-C",
        "/app/storage",
        ".",
      ];
  const tar = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  tar.stderr.resume();
  const finished = new Promise((resolve, reject) => {
    tar.once("error", reject);
    tar.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Pliki zmieniły się lub nie można ich odczytać. Kopia nie została oznaczona jako kompletna; ponów bez importów i czyszczenia danych.",
            ),
          ),
    );
  });
  await Promise.all([
    finished,
    pipeline(
      tar.stdout,
      createGzip({ level: 6 }),
      createWriteStream(join(directory, "storage.tar.gz")),
    ),
  ]);
  console.log("Obliczam sumy kontrolne skompresowanej kopii…");
  const files = ["database.dump", "storage.tar.gz", "counts.txt", "snapshot.json"];
  const sums = [];
  for (const name of files) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(join(directory, name))) hash.update(chunk);
    sums.push(`${hash.digest("hex")}  ${name}`);
  }
  writeFileSync(join(directory, "SHA256SUMS"), `${sums.join("\n")}\n`);
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(
      {
        format: 2,
        createdAt: new Date().toISOString(),
        postgresMajor: major,
        files: [...files, "SHA256SUMS"],
        storageArchive: "storage.tar.gz",
        excludedStorageDirectories,
        applicationCommit: spawnSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).stdout?.trim(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Kopia online gotowa: ${directory}`);
}
