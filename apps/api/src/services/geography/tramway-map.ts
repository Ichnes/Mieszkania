import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { storageRoot } from "../../config";
type RouteMember = { type: "node" | "way" | "relation"; ref: number; role?: string };
type TramRouteRelation = {
  type: "relation";
  id: number;
  tags?: { ref?: string; name?: string; colour?: string };
  members?: RouteMember[];
};
type TramStopNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: { name?: string; railway?: string; public_transport?: string };
};
type TramWay = { type: "way"; id: number; geometry?: Array<{ lat: number; lon: number }> };

let cachedTramwayMap: Awaited<ReturnType<typeof loadWarsawTramwayMap>> | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<Awaited<ReturnType<typeof loadWarsawTramwayMap>>> | null = null;
const cacheFile = join(storageRoot, "geography", "tramway-v2.json");

export async function getWarsawTramwayMap() {
  if (cachedTramwayMap && Date.now() < cacheExpiresAt) return cachedTramwayMap;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!cachedTramwayMap) {
      try {
        const disk = JSON.parse(await readFile(cacheFile, "utf8"));
        if (disk.data?.routes?.length && disk.data?.stops?.length) {
          cachedTramwayMap = disk.data;
          cacheExpiresAt = disk.expiresAt;
          if (Date.now() < cacheExpiresAt) return cachedTramwayMap!;
        }
      } catch {
        /* No usable disk cache yet. */
      }
    }
    try {
      const data = await loadWarsawTramwayMap();
      if (!data.routes.length || !data.stops.length)
        throw new Error("Brak tras tramwajowych w odpowiedzi serwera mapy");
      cachedTramwayMap = data;
      cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
      await mkdir(join(storageRoot, "geography"), { recursive: true });
      await writeFile(cacheFile + ".tmp", JSON.stringify({ data, expiresAt: cacheExpiresAt }));
      await rename(cacheFile + ".tmp", cacheFile);
      return data;
    } catch (error) {
      if (cachedTramwayMap) {
        cacheExpiresAt = Date.now() + 60_000;
        return cachedTramwayMap;
      }
      throw error;
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function loadWarsawTramwayMap() {
  const query = `[out:json][timeout:40];relation[type=route][route=tram](52.00,20.55,52.55,21.50)->.routes;(.routes;way(r.routes);node(r.routes););out body geom;`;
  let response: Response | undefined;
  let failure: unknown;
  for (const endpoint of [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ]) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(70_000),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "mieszkania-local-app/0.1",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) break;
      failure = new Error(`Tramway map import failed with status ${response.status}`);
    } catch (error) {
      failure = error;
    }
  }
  if (!response?.ok) throw failure;

  const elements =
    ((await response.json()) as { elements?: Array<TramRouteRelation | TramStopNode | TramWay> })
      .elements ?? [];
  return parseTramwayMap(elements);
}

export function parseTramwayMap(elements: Array<TramRouteRelation | TramStopNode | TramWay>) {
  const stopsById = new Map(
    elements
      .filter((item): item is TramStopNode => item.type === "node" && Boolean(item.tags?.name))
      .map((item) => [item.id, item]),
  );
  const waysById = new Map(
    elements
      .filter((item): item is TramWay => item.type === "way" && Boolean(item.geometry?.length))
      .map((item) => [item.id, item]),
  );
  const routes = elements
    .filter(
      (item): item is TramRouteRelation => item.type === "relation" && Boolean(item.tags?.ref),
    )
    .map((route) => {
      const members = route.members ?? [];
      const stopIds = members
        .filter((member) => member.type === "node" && stopsById.has(member.ref))
        .map((member) => member.ref);
      const lines = members
        .filter((member) => member.type === "way")
        .map((member) => waysById.get(member.ref)?.geometry)
        .filter((geometry): geometry is Array<{ lat: number; lon: number }> =>
          Boolean(geometry?.length),
        )
        .map((geometry) => geometry.map((point) => [point.lat, point.lon] as [number, number]));
      return {
        id: String(route.id),
        ref: route.tags!.ref!,
        name: route.tags?.name ?? `Tramwaj ${route.tags!.ref!}`,
        colour: route.tags?.colour,
        stopIds,
        lines,
      };
    })
    .filter((route) => route.lines.length > 0);

  const routeRefsByStopId = new Map<number, Set<string>>();
  for (const route of routes) {
    for (const stopId of route.stopIds) {
      const refs = routeRefsByStopId.get(stopId) ?? new Set<string>();
      refs.add(route.ref);
      routeRefsByStopId.set(stopId, refs);
    }
  }

  const deduplicatedStops = new Map<
    string,
    { name: string; latitude: number; longitude: number; count: number; routes: Set<string> }
  >();
  for (const stop of stopsById.values()) {
    const name = stop.tags!.name!;
    const key = name.trim().toLocaleLowerCase("pl-PL");
    const current = deduplicatedStops.get(key) ?? {
      name,
      latitude: 0,
      longitude: 0,
      count: 0,
      routes: new Set<string>(),
    };
    current.latitude += stop.lat;
    current.longitude += stop.lon;
    current.count += 1;
    for (const route of routeRefsByStopId.get(stop.id) ?? []) current.routes.add(route);
    deduplicatedStops.set(key, current);
  }

  return {
    stops: [...deduplicatedStops.values()].map((stop) => ({
      name: stop.name,
      latitude: stop.latitude / stop.count,
      longitude: stop.longitude / stop.count,
      routes: [...stop.routes].sort((left, right) =>
        left.localeCompare(right, "pl", { numeric: true }),
      ),
    })),
    routes,
  };
}
