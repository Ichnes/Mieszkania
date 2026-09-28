import "../apps/api/src/config.ts";
import { readFile, writeFile } from "node:fs/promises";
import { buildDistrictGeometry } from "../apps/api/src/services/geography/warsaw-district-boundaries";
import { canonicalWarsawDistrict } from "../apps/api/src/services/geography/warsaw-neighborhoods";

// Consume saved public OSM responses so rebuilding never silently changes the source date.
const [mainFile, additionalFile, output] = process.argv.slice(2);
if (!mainFile || !additionalFile || !output)
  throw new Error("Użycie: npm run msi:build -- overpass.json dabrowka-full.json wynik.geojson");
type Element = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  members?: Array<{ type: string; ref: number; role: string }>;
  geometry?: Array<{ lat: number; lon: number }>;
};
const main = JSON.parse((await readFile(mainFile, "utf8")).replace(/^\uFEFF/, "")) as {
  elements: Element[];
  osm3s: { timestamp_osm_base: string };
};
const additional = JSON.parse((await readFile(additionalFile, "utf8")).replace(/^\uFEFF/, "")) as {
  elements: Element[];
};
const nodes = new Map(
  additional.elements.filter((item) => item.type === "node").map((item) => [item.id, item]),
);
for (const way of additional.elements.filter((item) => item.type === "way")) {
  way.geometry = (way.nodes ?? []).map((id) => {
    const node = nodes.get(id);
    if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon))
      throw new Error(`Brak węzła ${id}`);
    return { lat: node.lat!, lon: node.lon! };
  });
}
const elements = new Map(main.elements.map((item) => [`${item.type}/${item.id}`, item]));
for (const item of additional.elements)
  if (!elements.has(`${item.type}/${item.id}`)) elements.set(`${item.type}/${item.id}`, item);
const all = [...elements.values()];
const ways = new Map(
  all
    .filter((item) => item.type === "way")
    .map((item) => [item.id, { ...item, type: "way" as const }]),
);
const features = all
  .filter((item) => item.type === "relation")
  .map((item) => {
    const name = item.tags?.["name:pl"] ?? item.tags?.name;
    if (!name) throw new Error(`Brak nazwy ${item.id}`);
    const district =
      name === "Wola Grzybowska"
        ? "Wesoła"
        : name === "Ursynów Centrum" || name.includes("Las Kabacki")
          ? "Ursynów"
          : canonicalWarsawDistrict(name);
    const geometry = buildDistrictGeometry({ ...item, type: "relation" }, ways);
    if (!district || !geometry) throw new Error(`Brak dzielnicy lub geometrii: ${name}`);
    return { type: "Feature", id: item.id, properties: { name, district }, geometry };
  });
if (
  features.length !== 143 ||
  new Set(features.map((item) => item.properties.district)).size !== 18
)
  throw new Error(
    "Oczekiwano 143 obszarów w 18 dzielnicach; sprawdź zmianę źródła przed publikacją.",
  );
await writeFile(
  output,
  JSON.stringify({
    type: "FeatureCollection",
    source: "© OpenStreetMap contributors · ODbL",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    updatedAt: main.osm3s.timestamp_osm_base,
    features,
  }) + "\n",
);
console.log(`Zapisano ${features.length} obszarów MSI.`);
