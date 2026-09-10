import { readFile, mkdir, writeFile } from "node:fs/promises";

// Inputs: successful Overpass railway response and parsed tramway cache/export.
const [railPath, tramPath] = process.argv.slice(2);
if (!railPath || !tramPath)
  throw new Error("Usage: node scripts/build-transport-snapshot.mjs railway.json tramway.json");
const rail = JSON.parse(await readFile(railPath, "utf8"));
const tramInput = JSON.parse(await readFile(tramPath, "utf8"));
const tram = tramInput.data ?? tramInput;
if (rail.remark || !rail.elements?.length || !tram.routes?.length || !tram.stops?.length)
  throw new Error("Incomplete transport response; snapshot was not replaced");
const inside = ([lat, lon]) => lat >= 52 && lat <= 52.55 && lon >= 20.55 && lon <= 21.5;
const round = (v) => Math.round(v * 1e6) / 1e6;
function uniqueLines(lines) {
  const result = new Map();
  for (const line of lines) {
    // Split at the regional boundary instead of drawing a chord over excluded points.
    let part = [];
    const save = () => {
      if (part.length > 1) {
        const a = JSON.stringify(part),
          b = JSON.stringify([...part].reverse());
        result.set(a < b ? a : b, part);
      }
      part = [];
    };
    for (const point of line) {
      if (inside(point)) part.push(point.map(round));
      else save();
    }
    save();
  }
  return [...result.values()];
}
const stations = new Map();
for (const node of rail.elements) {
  if (
    node.type !== "node" ||
    !node.tags?.name ||
    node.tags.station === "subway" ||
    node.tags.subway === "yes"
  )
    continue;
  const key = node.tags.name.trim().toLocaleLowerCase("pl");
  if (!stations.has(key))
    stations.set(key, { name: node.tags.name, latitude: node.lat, longitude: node.lon });
}
const railway = {
  stations: [...stations.values()],
  lines: uniqueLines(
    rail.elements
      .filter((e) => e.type === "way" && e.geometry?.length && !e.tags?.service)
      .map((e) => e.geometry.map((p) => [p.lat, p.lon])),
  ),
};
// Combine route directions by number so overlapping ways are rendered only once.
const routesByRef = new Map();
for (const route of tram.routes) {
  const previous = routesByRef.get(route.ref);
  routesByRef.set(route.ref, {
    id: route.ref,
    ref: route.ref,
    name: `Tramwaj ${route.ref}`,
    lines: uniqueLines([...(previous?.lines ?? []), ...route.lines]),
  });
}
const routes = [...routesByRef.values()];
const tramway = { stops: tram.stops, routes, lines: uniqueLines(routes.flatMap((r) => r.lines)) };
if (railway.lines.length < 100 || railway.stations.length < 50 || tramway.lines.length < 100)
  throw new Error("Unexpectedly small snapshot");
const target = new URL("../packages/shared/src/data/warsaw-transport.json", import.meta.url);
await mkdir(new URL(".", target), { recursive: true });
await writeFile(
  target,
  JSON.stringify({
    updatedAt: new Date().toISOString().slice(0, 10),
    source: "OpenStreetMap contributors, ODbL 1.0",
    railway,
    tramway,
  }) + "\n",
);
console.log(
  JSON.stringify({
    railLines: railway.lines.length,
    stations: railway.stations.length,
    tramRoutes: routes.length,
    tramLines: tramway.lines.length,
    tramStops: tramway.stops.length,
  }),
);
