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

export async function getWarsawTramwayMap() {
  if (cachedTramwayMap && Date.now() < cacheExpiresAt) return cachedTramwayMap;
  try {
    cachedTramwayMap = await loadWarsawTramwayMap();
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return cachedTramwayMap;
  } catch (error) {
    if (cachedTramwayMap) return cachedTramwayMap;
    throw error;
  }
}

async function loadWarsawTramwayMap() {
  const query = `[out:json][timeout:60];(node[railway=tram_stop](52.00,20.55,52.55,21.50);node[public_transport=platform][tram=yes](52.00,20.55,52.55,21.50););out body;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "mieszkania-local-app/0.1",
    },
    body: new URLSearchParams({ data: query }),
  });

  if (!response.ok) throw new Error(`Tramway map import failed with status ${response.status}`);

  const elements =
    ((await response.json()) as { elements?: Array<TramRouteRelation | TramStopNode | TramWay> })
      .elements ?? [];
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
