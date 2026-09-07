import type { PoolClient } from "pg";
import { pool } from "../db";
import { isCanonicalWarsawDistrict } from "./warsaw-neighborhoods";

type Queryable = Pick<PoolClient, "query">;
type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type DistrictGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: Polygon | Polygon[] };
type OverpassWay = { type: "way"; id: number; geometry?: Array<{ lat: number; lon: number }> };
type OverpassRelation = {
  type: "relation";
  id: number;
  tags?: { name?: string; "name:pl"?: string };
  members?: Array<{ type: string; ref: number; role?: string }>;
};

/** Imports the 18 Warszawa district boundaries directly from OSM/Overpass. */
export async function importWarsawDistrictBoundaries() {
  const query = `[out:json][timeout:180];area["name"="Warszawa"][boundary="administrative"]->.city;relation["boundary"="administrative"]["admin_level"="9"](area.city)->.districts;.districts out body;way(r.districts);out geom;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "mieszkania-local-app/0.1" },
    body: new URLSearchParams({ data: query })
  });
  if (!response.ok) throw new Error(`Overpass district import failed with status ${response.status}`);

  const payload = await response.json() as { elements?: Array<OverpassWay | OverpassRelation> };
  const elements = payload.elements ?? [];
  const ways = new Map(elements.filter((item): item is OverpassWay => item.type === "way").map((way) => [way.id, way]));
  const districts = elements.filter((item): item is OverpassRelation => item.type === "relation");
  let imported = 0;

  for (const district of districts) {
    const name = district.tags?.["name:pl"] ?? district.tags?.name;
    const geometry = buildDistrictGeometry(district, ways);
    if (!name || !geometry) continue;
    await pool.query(
      `insert into district_boundaries (osm_relation_id, city, name, geometry_geojson, updated_at)
       values ($1, 'Warszawa', $2, $3::jsonb, now())
       on conflict (osm_relation_id) do update set name = excluded.name, geometry_geojson = excluded.geometry_geojson, updated_at = now()`,
      [district.id, name, JSON.stringify(geometry)]
    );
    imported += 1;
  }
  return { imported, received: districts.length };
}

export async function findWarsawDistrictAtPoint(latitude: number, longitude: number, db: Queryable = pool) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const result = await db.query<{ name: string; geometry_geojson: DistrictGeometry }>(
    `select name, geometry_geojson from district_boundaries where city = 'Warszawa'`
  );
  return result.rows.find((district) => pointInGeometry([longitude, latitude], district.geometry_geojson))?.name ?? null;
}

export async function backfillWarsawListingDistricts() {
  const db = await pool.connect();
  try {
    await db.query("begin");
    const listings = await db.query<{ id: string; district: string | null; latitude: string; longitude: string }>(
      `select id, district, latitude::text, longitude::text from listings
       where city ilike 'Warszawa' and latitude is not null and longitude is not null`
    );
    let assigned = 0;
    const requiringRepair = listings.rows.filter((listing) => !isCanonicalWarsawDistrict(listing.district));
    for (const listing of requiringRepair) {
      const district = await findWarsawDistrictAtPoint(Number(listing.latitude), Number(listing.longitude), db);
      if (!district) continue;
      await db.query(`update listings set district = $2, updated_at = now() where id = $1`, [listing.id, district]);
      assigned += 1;
    }
    await db.query("commit");
    return { scanned: requiringRepair.length, assigned, unmatched: requiringRepair.length - assigned };
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}

export function buildDistrictGeometry(relation: OverpassRelation, ways: Map<number, OverpassWay>): DistrictGeometry | null {
  const outer = stitchRings(relation.members?.filter((member) => member.type === "way" && member.role !== "inner").map((member) => ways.get(member.ref)?.geometry ?? []).filter((geometry) => geometry.length > 1).map(toPositions) ?? []);
  const inner = stitchRings(relation.members?.filter((member) => member.type === "way" && member.role === "inner").map((member) => ways.get(member.ref)?.geometry ?? []).filter((geometry) => geometry.length > 1).map(toPositions) ?? []);
  if (outer.length === 0) return null;
  const polygons: Polygon[] = outer.map((ring) => [ring]);
  for (const hole of inner) {
    const host = polygons.find((polygon) => pointInRing(hole[0], polygon[0]));
    if (host) host.push(hole);
  }
  return polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
}

function toPositions(points: Array<{ lat: number; lon: number }>): Ring { return points.map((point) => [point.lon, point.lat]); }

function stitchRings(segments: Ring[]) {
  const pending = segments.map((segment) => [...segment]);
  const rings: Ring[] = [];
  while (pending.length) {
    let ring = pending.pop()!;
    let joined = true;
    while (joined && !samePoint(ring[0], ring.at(-1)!)) {
      joined = false;
      const end = ring.at(-1)!;
      const index = pending.findIndex((segment) => samePoint(segment[0], end) || samePoint(segment.at(-1)!, end));
      if (index >= 0) {
        const next = pending.splice(index, 1)[0];
        if (samePoint(next.at(-1)!, end)) next.reverse();
        ring = ring.concat(next.slice(1));
        joined = true;
      }
    }
    if (ring.length >= 4 && samePoint(ring[0], ring.at(-1)!)) rings.push(ring);
  }
  return rings;
}

function pointInGeometry(point: Position, geometry: DistrictGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as Polygon] : geometry.coordinates as Polygon[];
  return polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

function pointInRing([x, y]: Position, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if (pointOnSegment([x, y], [xi, yi], [xj, yj])) return true;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointOnSegment([x, y]: Position, [x1, y1]: Position, [x2, y2]: Position) {
  return Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) < 1e-10 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
}
function samePoint(a: Position, b: Position) { return Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8; }
