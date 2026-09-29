import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createOnlineBackup } from "./backup-create.mjs";
import { verifyBackupFiles, streamArchiveToContainer } from "./backup-verify-files.mjs";

// Credentials stay in memory and inherited environment, never in command arguments or manifests.
function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      `Docker: ${args[0]} nie powiodło się. ${result.error?.message ?? "Sprawdź Docker Desktop, dostępne miejsce i uprawnienia."}`,
    );
  return result.stdout.trim();
}
const mode = process.argv[2];
if (!["create", "verify", "restore"].includes(mode)) {
  console.log(
    "Użycie: npm run backup:create | npm run backup:verify -- <katalog-kopii> | npm run backup:restore -- <katalog-kopii>",
  );
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
const directory =
  mode === "create" ? join(root, ".local", "backups", id) : resolve(process.argv[3] ?? "");
const mount = `type=bind,source=${directory},target=/backup`;

const countSql = `select format('select %L as table_name, count(*) as row_count from %I.%I;', tablename, schemaname, tablename) from pg_tables where schemaname='public' order by tablename;`;

async function verify() {
  if (!process.argv[3] || !existsSync(join(directory, "manifest.json")))
    throw new Error("Podaj katalog kompletnej kopii z manifest.json.");
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  if (
    ![1, 2].includes(manifest.format) ||
    !Number.isInteger(manifest.postgresMajor) ||
    manifest.postgresMajor < 14 ||
    manifest.postgresMajor > 30
  )
    throw new Error("Nieobsługiwany manifest.");
  const archive = manifest.format === 2 ? "storage.tar.gz" : "storage.tar";
  const image = `postgres:${manifest.postgresMajor}-bookworm`;
  const name = `mieszkania-restore-check-${randomBytes(6).toString("hex")}`;
  const volume = `${name}-data`;
  const storageVolume = `${name}-storage`;
  const password = randomBytes(24).toString("hex");
  const env = {
    ...process.env,
    POSTGRES_PASSWORD: password,
    PGPASSWORD: password,
    COUNT_SQL: countSql,
  };
  let created = false;
  let volumeCreated = false;
  let storageCreated = false;
  let retained = false;
  try {
    docker(["pull", image]);
    console.log("Sprawdzam sumy kontrolne lokalnie…");
    await verifyBackupFiles(directory, manifest.format);
    docker(["volume", "create", volume]);
    volumeCreated = true;
    docker(["volume", "create", storageVolume]);
    storageCreated = true;
    docker(
      [
        "run",
        "-d",
        "--name",
        name,
        "--network",
        "none",
        "--mount",
        `type=volume,source=${volume},target=/var/lib/postgresql/data`,
        "--mount",
        `type=volume,source=${storageVolume},target=/restored-storage`,
        "--mount",
        `${mount},readonly`,
        "-e",
        "POSTGRES_PASSWORD",
        "-e",
        "POSTGRES_DB=restore_test",
        image,
      ],
      { env },
    );
    created = true;
    for (let attempt = 0; ; attempt++) {
      const check = spawnSync(
        "docker",
        ["exec", name, "pg_isready", "-U", "postgres", "-d", "restore_test"],
        { stdio: "ignore" },
      );
      if (check.status === 0) break;
      if (attempt >= 60) throw new Error("Testowa baza nie uruchomiła się.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("Odtwarzam kopię w izolowanej bazie; baza aplikacji pozostaje nietknięta…");
    docker(
      [
        "exec",
        "-e",
        "PGPASSWORD",
        "-e",
        "COUNT_SQL",
        name,
        "sh",
        "-eu",
        "-c",
        `
export PGUSER=postgres PGDATABASE=restore_test
pg_restore --exit-on-error --no-owner --no-acl --dbname=restore_test /backup/database.dump
psql -X -v ON_ERROR_STOP=1 -At -c "$COUNT_SQL" | psql -X -v ON_ERROR_STOP=1 -At > /tmp/counts.txt
diff /backup/counts.txt /tmp/counts.txt
`,
      ],
      { env },
    );
    console.log("Baza odtworzona, liczniki zgodne. Odtwarzam pliki do osobnego wolumenu…");
    await streamArchiveToContainer(name, join(directory, archive), "x", manifest.format === 2);
    console.log("Porównuję odtworzone pliki z archiwum…");
    await streamArchiveToContainer(name, join(directory, archive), "d", manifest.format === 2);
    writeFileSync(
      join(directory, "verification.json"),
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          databaseRestored: true,
          tableCountsMatch: true,
          storageExtractedAndCompared: true,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Weryfikacja poprawna: odtworzono bazę, zgodne liczby wierszy wszystkich tabel; pliki wypakowane i porównane z archiwum.",
    );
    if (mode === "restore") {
      const recovery = join(root, ".local", "recovery", name);
      mkdirSync(recovery, { recursive: true });
      docker(["exec", name, "chown", "-R", "1000:1000", "/restored-storage"]);
      const configPath = join(recovery, "compose.recovery.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            services: {
              db: {
                image,
                environment: {
                  POSTGRES_DB: "restore_test",
                  POSTGRES_USER: "postgres",
                  POSTGRES_PASSWORD: password,
                },
                healthcheck: { test: ["CMD-SHELL", "pg_isready -U postgres -d restore_test"] },
              },
              api: {
                environment: {
                  DATABASE_URL: `postgres://postgres:${password}@db:5432/restore_test`,
                  AUTOMATION_ENABLED: "false",
                },
              },
              web: { ports: ["127.0.0.1:8081:80"] },
            },
            volumes: {
              database: { external: true, name: volume },
              storage: { external: true, name: storageVolume },
            },
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600 },
      );
      // Explicit -f files omit the user's local override, which might point at the original database.
      // Setting the base web port to 8081 makes Compose merge the same port instead of retaining 8080.
      const command = `$env:DOCKER_BIND_ADDRESS='127.0.0.1'; $env:DOCKER_WEB_PORT='8081'; docker compose -p ${name} -f compose.yaml -f '${configPath}' up -d --build`;
      writeFileSync(
        join(recovery, "START.txt"),
        `PowerShell, w katalogu projektu:\n${command}\n\nAplikacja: http://127.0.0.1:8081/oferty\nAutomatyczne importy wyłączone. Kopia zachowuje ustawienia i konta bazy; dane dostępowe konfiguracji są prywatne.\n`,
      );
      retained = true;
      console.log(
        `Odtworzone dane zachowane w nowych wolumenach. Instrukcja uruchomienia: ${join(recovery, "START.txt")}`,
      );
    }
  } finally {
    // Only these randomly named, task-owned resources can be removed.
    if (created) docker(["rm", "-f", name]);
    if (volumeCreated && !retained) docker(["volume", "rm", volume]);
    if (storageCreated && !retained) docker(["volume", "rm", storageVolume]);
  }
}

try {
  await (mode === "create" ? createOnlineBackup({ docker, root, directory, mount }) : verify());
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
