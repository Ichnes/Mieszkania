import type { ImmediateSurroundingsAnalysis, ImmediateSurroundingsFinding } from "@mieszkania/shared";
import { fetchExternalJson } from "./external-json";

const RADIUS_METERS = 50;
const FETCH_MARGIN_METERS = 80;
const OSM_MAP_URL = "https://api.openstreetmap.org/api/0.6/map.json";

type OsmMapElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
};

type FindingRule = {
  category: ImmediateSurroundingsFinding["category"];
  label: string;
  severity: ImmediateSurroundingsFinding["severity"];
  matches: (tags: Record<string, string>) => string | null;
};

const rules: FindingRule[] = [
  { category: "civic", label: "Urząd / służby publiczne", severity: "information", matches: (tags) => pick(tags, [["office", ["government"]], ["amenity", ["townhall", "courthouse", "police", "fire_station"]]]) },
  { category: "waste", label: "Odpady / składowisko", severity: "attention", matches: (tags) => pick(tags, [["landuse", ["landfill"]], ["amenity", ["waste_transfer_station", "waste_disposal", "recycling"]], ["man_made", ["wastewater_plant"]]]) },
  { category: "industry", label: "Przemysł / hala", severity: "attention", matches: (tags) => pick(tags, [["landuse", ["industrial"]], ["building", ["industrial", "warehouse", "manufacture"]], ["man_made", ["works", "storage_tank", "silo"]], ["industrial", null]]) },
  { category: "construction", label: "Budowa / teren poprzemysłowy", severity: "attention", matches: (tags) => pick(tags, [["landuse", ["construction", "brownfield"]], ["building", ["construction"]]]) },
  { category: "power", label: "Infrastruktura energetyczna", severity: "information", matches: (tags) => pick(tags, [["power", ["plant", "substation", "generator", "transformer"]]]) },
  { category: "fuel", label: "Stacja paliw", severity: "information", matches: (tags) => pick(tags, [["amenity", ["fuel"]]]) },
  { category: "railway", label: "Tory kolejowe / tramwajowe", severity: "information", matches: (tags) => pick(tags, [["railway", ["rail", "light_rail", "tram", "narrow_gauge"]]]) },
  { category: "major_road", label: "Droga o dużym ruchu", severity: "information", matches: (tags) => pick(tags, [["highway", ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"]]]) },
  { category: "nightlife", label: "Lokal nocny", severity: "information", matches: (tags) => pick(tags, [["amenity", ["nightclub", "bar"]]]) }
];

export async function getImmediateSurroundings(latitude: number, longitude: number): Promise<ImmediateSurroundingsAnalysis> {
  const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=19/${latitude}/${longitude}`;
  try {
    const url = new URL(OSM_MAP_URL);
    url.searchParams.set("bbox", buildBoundingBox(latitude, longitude, FETCH_MARGIN_METERS).join(","));
    const payload = await fetchExternalJson<{ elements?: OsmMapElement[] }>(url, {
      headers: { "Accept": "application/json", "User-Agent": "mieszkania-local/0.1 (immediate parcel surroundings)" },
      timeoutMs: 12_000
    });
    return analyzeImmediateSurroundings(payload.elements ?? [], latitude, longitude, mapUrl);
  } catch {
    return { status: "unavailable", radiusMeters: RADIUS_METERS, assessment: "unknown", findings: [], mapUrl };
  }
}

export function analyzeImmediateSurroundings(elements: OsmMapElement[], latitude: number, longitude: number, mapUrl = "https://www.openstreetmap.org") {
  const nodes = new Map<number, [number, number]>();
  for (const element of elements) {
    if (element.type === "node" && typeof element.lat === "number" && typeof element.lon === "number") {
      nodes.set(element.id, [element.lon, element.lat]);
    }
  }

  const findings: ImmediateSurroundingsFinding[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const rule = rules.find((candidate) => candidate.matches(tags));
    if (!rule) continue;
    const points = element.type === "node"
      ? typeof element.lat === "number" && typeof element.lon === "number" ? [[element.lon, element.lat] as [number, number]] : []
      : (element.nodes ?? []).map((id) => nodes.get(id)).filter((point): point is [number, number] => Boolean(point));
    if (!points.length) continue;
    const distanceMeters = Math.round(distanceToGeometry(points, latitude, longitude));
    if (distanceMeters > RADIUS_METERS) continue;
    const matchedTag = rule.matches(tags)!;
    findings.push({
      osmKey: `${element.type}:${element.id}`,
      category: rule.category,
      label: rule.label,
      name: tags.name?.trim() || tags.operator?.trim() || rule.label,
      distanceMeters,
      severity: rule.severity,
      detail: matchedTag,
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`
    });
  }

  const unique = [...new Map(findings.sort((left, right) => left.distanceMeters - right.distanceMeters).map((finding) => [finding.osmKey, finding])).values()];
  return {
    status: "available" as const,
    radiusMeters: RADIUS_METERS,
    checkedAt: new Date().toISOString(),
    assessment: unique.some((finding) => finding.severity === "attention") ? "attention" as const : "clear" as const,
    findings: unique,
    mapUrl
  };
}

function pick(tags: Record<string, string>, candidates: Array<[string, string[] | null]>) {
  for (const [key, values] of candidates) {
    const value = tags[key];
    if (value && (!values || values.includes(value))) return `${key}=${value}`;
  }
  return null;
}

function buildBoundingBox(latitude: number, longitude: number, radiusMeters: number) {
  const latDelta = radiusMeters / 110_540;
  const lonDelta = radiusMeters / (111_320 * Math.cos(latitude * Math.PI / 180));
  return [longitude - lonDelta, latitude - latDelta, longitude + lonDelta, latitude + latDelta];
}

function distanceToGeometry(points: Array<[number, number]>, latitude: number, longitude: number) {
  const projected = points.map(([lon, lat]) => project(lon, lat, latitude, longitude));
  if (projected.length > 2 && points[0][0] === points.at(-1)?.[0] && points[0][1] === points.at(-1)?.[1] && pointInPolygon([0, 0], projected)) return 0;
  if (projected.length === 1) return Math.hypot(projected[0][0], projected[0][1]);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < projected.length; index += 1) {
    best = Math.min(best, distanceToSegment([0, 0], projected[index - 1], projected[index]));
  }
  return best;
}

function project(lon: number, lat: number, originLat: number, originLon: number): [number, number] {
  return [(lon - originLon) * 111_320 * Math.cos(originLat * Math.PI / 180), (lat - originLat) * 110_540];
}

function distanceToSegment(point: [number, number], start: [number, number], end: [number, number]) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
}

function pointInPolygon(point: [number, number], polygon: Array<[number, number]>) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [x1, y1] = polygon[current];
    const [x2, y2] = polygon[previous];
    if ((y1 > point[1]) !== (y2 > point[1]) && point[0] < (x2 - x1) * (point[1] - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}
