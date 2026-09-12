import { networkInterfaces } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const cwd = fileURLToPath(new URL("../", import.meta.url));

export function dockerUrls(published, interfaces) {
  const urls = new Set();
  for (const line of published.trim().split(/\r?\n/)) {
    const match = line.match(/^(\[[^\]]+\]|[^:]+):(\d+)$/);
    if (!match) continue;
    const [, host, port] = match;
    if (["0.0.0.0", "[::]"].includes(host)) {
      urls.add(`http://localhost:${port}/oferty`);
      for (const [name, addresses] of Object.entries(interfaces)) {
        if (/loopback|vethernet|docker|wsl|vmware|virtualbox|tailscale|zerotier/i.test(name))
          continue;
        for (const address of addresses ?? []) {
          if (
            address.family !== "IPv4" ||
            address.internal ||
            address.address.startsWith("169.254.")
          )
            continue;
          urls.add(`http://${address.address}:${port}/oferty`);
        }
      }
    } else {
      urls.add(`http://${host}:${port}/oferty`);
    }
  }
  return [...urls];
}

export function printDockerUrls() {
  // Ask the running container: honors .env, Compose overrides and custom ports.
  for (const port of [80, 5173]) {
    const result = spawnSync("docker", ["compose", "port", "web", String(port)], {
      cwd,
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) continue;
    const urls = dockerUrls(result.stdout, networkInterfaces());
    if (!urls.length) continue;
    console.log("\nAdresy aplikacji:");
    for (const url of urls) console.log(`  ${url}`);
    const hasLan = urls.some((url) => !/^http:\/\/(localhost|127\.[\d.]+|\[::1\]):/.test(url));
    console.log(
      hasLan
        ? "Na telefonie użyj adresu IP komputera w tej samej sieci Wi-Fi/LAN.\n"
        : "Brak adresu LAN: sprawdź połączenie sieciowe i DOCKER_BIND_ADDRESS.\n",
    );
    return;
  }
  throw new Error("Nie znaleziono opublikowanego portu aplikacji. Sprawdź: docker compose ps");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    printDockerUrls();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
