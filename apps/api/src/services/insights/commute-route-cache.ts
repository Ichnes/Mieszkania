import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FamilySettings, ListingSummary } from "@mieszkania/shared";
import { storageRoot } from "../../config";

type Point = { latitude?: number; longitude?: number };
type Destination = FamilySettings["workplaces"][number];
type Entry = { expires: number; minutes?: number; km?: number };
type Batch = { origins: Map<string, Point>; destinations: Destination[] };
const valid = (p: Point) =>
  Number.isFinite(p.latitude) &&
  Math.abs(p.latitude!) <= 90 &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.longitude!) <= 180;
const pointKey = (p: Point) => `${p.longitude!.toFixed(6)},${p.latitude!.toFixed(6)}`;
const routeKey = (a: Point, b: Point) => `${pointKey(a)};${pointKey(b)}`;

/** Shared, persistent estimates. Queue uses OSRM matrices rather than one request per offer. */
export function createCommuteRouteCache(
  filename: string,
  request: typeof fetch = (...args) => fetch(...args),
  pause = () => new Promise((resolve) => setTimeout(resolve, 1100)),
) {
  const entries = new Map<string, Entry>();
  const batches = new Map<string, Batch>();
  let loading: Promise<void> | undefined;
  let running: Promise<void> | undefined;
  let inProgress = 0;
  const activeOrigins = new Set<string>();
  const lookup = (a: Point, b: Point) => {
    if (!valid(a) || !valid(b)) return undefined;
    const entry = entries.get(routeKey(a, b));
    return entry && entry.expires > Date.now() ? entry : undefined;
  };
  async function save() {
    try {
      await mkdir(dirname(filename), { recursive: true });
      const temporary = `${filename}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify([...entries]), { mode: 0o600 });
      await rename(temporary, filename);
    } catch {
      /* Memory estimates remain usable if storage is temporarily unavailable. */
    }
  }
  async function run() {
    while (batches.size) {
      const [key, batch] = batches.entries().next().value!;
      const origins = [...batch.origins.values()].slice(0, 60);
      origins.forEach((origin) => batch.origins.delete(pointKey(origin)));
      if (!batch.origins.size) batches.delete(key);
      inProgress = origins.length;
      origins.forEach((origin) => activeOrigins.add(`${key}|${pointKey(origin)}`));
      let matrix: { durations: (number | null)[][]; distances?: (number | null)[][] } | undefined;
      for (const endpoint of [
        "https://router.project-osrm.org/table/v1/driving",
        "https://routing.openstreetmap.de/routed-car/table/v1/driving",
      ]) {
        try {
          const points = [...origins, ...batch.destinations];
          const url = new URL(`${endpoint}/${points.map(pointKey).join(";")}`);
          url.searchParams.set("sources", origins.map((_, i) => i).join(";"));
          url.searchParams.set(
            "destinations",
            batch.destinations.map((_, i) => origins.length + i).join(";"),
          );
          url.searchParams.set("annotations", "duration,distance");
          const response = await request(url, { signal: AbortSignal.timeout(5000) });
          if (!response.ok) continue;
          const data = (await response.json()) as typeof matrix & { code?: string };
          if (
            data?.code === "Ok" &&
            Array.isArray(data.durations) &&
            data.durations.length === origins.length &&
            data.durations.every(
              (row) => Array.isArray(row) && row.length === batch.destinations.length,
            )
          ) {
            matrix = data;
            break;
          }
        } catch {
          /* Try the fallback; never substitute straight-line travel time. */
        }
      }
      for (const [i, origin] of origins.entries())
        for (const [j, destination] of batch.destinations.entries()) {
          const seconds = matrix?.durations[i]?.[j];
          const meters = matrix?.distances?.[i]?.[j];
          const available = typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0;
          entries.set(routeKey(origin, destination), {
            expires: Date.now() + (available ? 30 * 86400000 : 10 * 60000),
            minutes: available ? Math.round(seconds / 60) : undefined,
            km:
              typeof meters === "number" && Number.isFinite(meters) && meters >= 0
                ? Math.round(meters / 100) / 10
                : undefined,
          });
        }
      for (const [key, value] of entries) if (value.expires <= Date.now()) entries.delete(key);
      while (entries.size > 40000) entries.delete(entries.keys().next().value!);
      await save();
      inProgress = 0;
      origins.forEach((origin) => activeOrigins.delete(`${key}|${pointKey(origin)}`));
      await pause();
    }
  }
  return {
    async load() {
      loading ??= (async () => {
        try {
          const data = JSON.parse(await readFile(filename, "utf8"));
          if (!Array.isArray(data) || data.length > 40000) return;
          for (const item of data) {
            if (!Array.isArray(item) || item.length !== 2) continue;
            const [key, value] = item;
            if (
              typeof key !== "string" ||
              key.length > 100 ||
              !value ||
              !Number.isFinite(value.expires) ||
              value.expires <= Date.now()
            )
              continue;
            if (
              value.minutes !== undefined &&
              (!Number.isFinite(value.minutes) || value.minutes < 0)
            )
              continue;
            entries.set(key, value);
          }
        } catch {
          /* Missing/corrupt cache gets rebuilt. */
        }
      })();
      await loading;
    },
    prepare(origins: Point[], workplaces: Destination[]) {
      const destinations = workplaces.filter((w) => w.workMode !== "remote" && valid(w));
      if (!destinations.length) return;
      const key = destinations.map(pointKey).join(";");
      for (const origin of origins) {
        if (
          !valid(origin) ||
          activeOrigins.has(`${key}|${pointKey(origin)}`) ||
          destinations.every((destination) => lookup(origin, destination))
        )
          continue;
        let batch = batches.get(key);
        if (!batch) {
          batch = { origins: new Map(), destinations };
          batches.set(key, batch);
        }
        batch.origins.set(pointKey(origin), origin);
      }
      running ??= run().finally(() => {
        running = undefined;
      });
    },
    read(origin: Point, workplaces: Destination[]): NonNullable<ListingSummary["scoringCommutes"]> {
      return workplaces
        .filter((w) => w.workMode !== "remote")
        .map((destination) => ({
          key: destination.key,
          destinationLatitude: destination.latitude,
          destinationLongitude: destination.longitude,
          durationMinutes: lookup(origin, destination)?.minutes,
          distanceKm: lookup(origin, destination)?.km,
        }));
    },
    get pending() {
      return inProgress + [...batches.values()].reduce((sum, batch) => sum + batch.origins.size, 0);
    },
    async settle() {
      await running;
    },
  };
}

export const commuteRouteCache = createCommuteRouteCache(
  join(storageRoot, "cache", "commute-routes.json"),
);
