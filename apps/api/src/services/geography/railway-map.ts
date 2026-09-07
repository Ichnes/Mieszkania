type RailNode = {
  type: "node";
  lat: number;
  lon: number;
  tags?: { name?: string; railway?: string };
};
type RailWay = { type: "way"; geometry?: Array<{ lat: number; lon: number }> };

export async function getWarsawRailwayMap() {
  const query = `[out:json][timeout:90];relation[type=route][route~"^(train|light_rail)$"](52.00,20.55,52.55,21.50)->.passengerRoutes;(node[railway~"^(station|halt)$"](52.00,20.55,52.55,21.50);way(r.passengerRoutes););out body geom;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "mieszkania-local-app/0.1",
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`Railway map import failed with status ${response.status}`);
  const payload = (await response.json()) as { elements?: Array<RailNode | RailWay> };
  return {
    stations: (payload.elements ?? [])
      .filter((item): item is RailNode => item.type === "node" && Boolean(item.tags?.name))
      .map((item) => ({
        name: item.tags!.name!,
        latitude: item.lat,
        longitude: item.lon,
        kind: item.tags?.railway,
      })),
    lines: (payload.elements ?? [])
      .filter((item): item is RailWay => item.type === "way" && Boolean(item.geometry?.length))
      .map((item) => item.geometry!.map((point) => [point.lat, point.lon] as [number, number])),
  };
}
