import { pool } from "../../db";
import { findWarsawDistrictAtPoint } from "./warsaw-district-boundaries";

type OverpassElement = {
  type: "way" | "relation";
  id: number;
  tags?: { name?: string; highway?: string };
  geometry?: Array<{ lat: number; lon: number }>;
};

export async function importWarsawStreets() {
  const query = `[out:json][timeout:180];area["name"="Warszawa"][boundary="administrative"]->.city;(way["highway"]["name"](area.city););out tags geom;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "mieszkania-local-app/0.1",
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`Overpass street import failed with status ${response.status}`);
  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const streets = (payload.elements ?? []).filter(
    (item) => item.tags?.name && item.geometry && item.geometry.length > 1,
  );
  let imported = 0;
  for (const street of streets) {
    const geometry = street.geometry!;
    const centerLat = geometry.reduce((sum, point) => sum + point.lat, 0) / geometry.length;
    const centerLng = geometry.reduce((sum, point) => sum + point.lon, 0) / geometry.length;
    const district = await findWarsawDistrictAtPoint(centerLat, centerLng);
    await pool.query(
      `insert into streets (osm_type, osm_id, name, normalized_name, center_lat, center_lng, district, geometry_geojson)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       on conflict (osm_type, osm_id) do update set name = excluded.name, normalized_name = excluded.normalized_name, center_lat = excluded.center_lat, center_lng = excluded.center_lng, district = excluded.district, geometry_geojson = excluded.geometry_geojson, updated_at = now()`,
      [
        street.type,
        street.id,
        street.tags!.name!,
        normalizeStreet(street.tags!.name!),
        centerLat,
        centerLng,
        district,
        JSON.stringify({
          type: "LineString",
          coordinates: geometry.map((point) => [point.lon, point.lat]),
        }),
      ],
    );
    imported += 1;
  }
  return { imported, received: streets.length };
}

function normalizeStreet(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .toLowerCase()
    .replace(/\b(?:ul|ulica|al|aleja|pl|plac)\.?\s*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
