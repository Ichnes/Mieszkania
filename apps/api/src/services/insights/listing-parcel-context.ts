import type { ParcelContextResponse, ParcelGeometry } from "@mieszkania/shared";
import { withDb } from "../../db";
import { fetchExternalText } from "../http/external-json";

const ULDK_URLS = ["https://uldk.gugik.gov.pl/", "http://uldk.gugik.gov.pl/"] as const;
const CACHE_TTL_DAYS = 30;

type ListingPointRow = { latitude: string | null; longitude: string | null };
type CachedParcelRow = {
  latitude: string;
  longitude: string;
  parcel_id: string;
  parcel_number: string | null;
  commune: string | null;
  region: string | null;
  datasource: string | null;
  geometry_geojson: ParcelGeometry;
  fetched_at: Date;
};

export async function getListingParcelContext(
  listingId: string,
  force = false,
): Promise<ParcelContextResponse | null> {
  const point = await withDb(async (db) => {
    const result = await db.query<ListingPointRow>(
      "select latitude::text, longitude::text from listings where id = $1 limit 1",
      [listingId],
    );
    return result.rows[0] ?? null;
  });
  if (!point) return null;
  if (!point.latitude || !point.longitude) {
    return { status: "missing_location", provider: "ULDK GUGiK" };
  }

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (!force) {
    const cached =
      (await readCache(listingId, latitude, longitude, false)) ??
      (await readContainingParcelCache(latitude, longitude, false));
    if (cached) return mapCached(cached, false);
  }

  try {
    const result = await fetchParcelByPoint(latitude, longitude);
    if (!result) return { status: "not_found", provider: "ULDK GUGiK", latitude, longitude };
    await saveCache(listingId, latitude, longitude, result);
    return {
      status: "available",
      provider: "ULDK GUGiK",
      latitude,
      longitude,
      checkedAt: new Date().toISOString(),
      parcel: result,
    };
  } catch (error) {
    const stale =
      (await readCache(listingId, latitude, longitude, true)) ??
      (await readContainingParcelCache(latitude, longitude, true));
    if (stale) return mapCached(stale, true);
    throw error;
  }
}

export function parcelGeometryContainsPoint(
  geometry: ParcelGeometry,
  latitude: number,
  longitude: number,
) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (rings) =>
      rings.length > 0 &&
      pointInRing(rings[0], longitude, latitude) &&
      rings.slice(1).every((hole) => !pointInRing(hole, longitude, latitude)),
  );
}

function pointInRing(ring: Array<[number, number]>, longitude: number, latitude: number) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    if (
      y > latitude !== previousY > latitude &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x
    )
      inside = !inside;
  }
  return inside;
}

export async function fetchParcelByPoint(latitude: number, longitude: number) {
  let lastError: unknown;
  for (const endpoint of ULDK_URLS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("request", "GetParcelByXY");
      url.searchParams.set("xy", `${longitude},${latitude},4326`);
      url.searchParams.set("result", "id,parcel,commune,region,datasource,geom_wkt");
      url.searchParams.set("srid", "4326");
      const body = await fetchExternalText(url, {
        headers: {
          accept: "text/plain",
          "user-agent": "mieszkania-local/0.1 (ULDK parcel lookup)",
        },
        timeoutMs: 20_000,
        maxBufferBytes: 8 * 1024 * 1024,
      });
      return parseUldkParcelResponse(body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ULDK_UNAVAILABLE");
}

export function parseUldkParcelResponse(body: string) {
  const lines = body.trim().split(/\r?\n/);
  if (lines[0]?.trim() !== "0" || !lines[1]) return null;
  const [id, parcelNumber, commune, region, datasource, ...geometryParts] = lines
    .slice(1)
    .join("\n")
    .split("|");
  const geometryWkt = geometryParts.join("|").trim();
  if (!id?.trim() || !geometryWkt) return null;
  return {
    id: id.trim(),
    number: parcelNumber?.trim() || undefined,
    commune: commune?.trim() || undefined,
    region: region?.trim() || undefined,
    datasource: datasource?.trim() || undefined,
    geometry: parseWktGeometry(geometryWkt),
    geoportalUrl: `https://mapy.geoportal.gov.pl/imapnext/imap/?identifyParcel=${encodeURIComponent(id.trim())}`,
    urbanRegistryUrl: "https://rejestr-urbanistyczny.gov.pl/published",
  };
}

export function parseWktGeometry(value: string): ParcelGeometry {
  const normalized = value.replace(/^SRID=\d+;/i, "").trim();
  if (/^POLYGON\s*/i.test(normalized)) {
    return {
      type: "Polygon",
      coordinates: parsePolygonText(normalized.replace(/^POLYGON\s*/i, "")),
    };
  }
  if (/^MULTIPOLYGON\s*/i.test(normalized)) {
    const body = stripOuterPair(normalized.replace(/^MULTIPOLYGON\s*/i, "").trim());
    return { type: "MultiPolygon", coordinates: splitTopLevel(body).map(parsePolygonText) };
  }
  throw new Error("ULDK_UNSUPPORTED_GEOMETRY");
}

function parsePolygonText(value: string) {
  const body = stripOuterPair(value.trim());
  return splitTopLevel(body).map((ring) => {
    const coordinates = stripOuterPair(ring.trim());
    return coordinates.split(",").map((pair) => {
      const [x, y] = pair.trim().split(/\s+/).map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("ULDK_INVALID_GEOMETRY");
      return [x, y] as [number, number];
    });
  });
}

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.filter((part) => part.trim());
}

function stripOuterPair(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) throw new Error("ULDK_INVALID_GEOMETRY");
  return trimmed.slice(1, -1);
}

async function readCache(
  listingId: string,
  latitude: number,
  longitude: number,
  allowExpired: boolean,
) {
  return withDb(async (db) => {
    const result = await db.query<CachedParcelRow>(
      `
      select latitude::text, longitude::text, parcel_id, parcel_number, commune, region, datasource, geometry_geojson, fetched_at
      from listing_parcel_context
      where abs(latitude - $2) < 0.000001
        and abs(longitude - $3) < 0.000001
        and ($4::boolean or fetched_at >= now() - make_interval(days => $5))
      order by (listing_id = $1) desc, fetched_at desc
      limit 1
    `,
      [listingId, latitude, longitude, allowExpired, CACHE_TTL_DAYS],
    );
    return result.rows[0] ?? null;
  });
}

async function readContainingParcelCache(
  latitude: number,
  longitude: number,
  allowExpired: boolean,
) {
  return withDb(async (db) => {
    const result = await db.query<CachedParcelRow>(
      `
      select latitude::text, longitude::text, parcel_id, parcel_number, commune, region, datasource, geometry_geojson, fetched_at
      from listing_parcel_context
      where abs(latitude - $1) < 0.003
        and abs(longitude - $2) < 0.005
        and ($3::boolean or fetched_at >= now() - make_interval(days => $4))
      order by fetched_at desc
      limit 500
    `,
      [latitude, longitude, allowExpired, CACHE_TTL_DAYS],
    );
    return (
      result.rows.find((row) =>
        parcelGeometryContainsPoint(row.geometry_geojson, latitude, longitude),
      ) ?? null
    );
  });
}

async function saveCache(
  listingId: string,
  latitude: number,
  longitude: number,
  parcel: NonNullable<ReturnType<typeof parseUldkParcelResponse>>,
) {
  await withDb((db) =>
    db.query(
      `
    insert into listing_parcel_context (
      listing_id, latitude, longitude, parcel_id, parcel_number, commune, region, datasource, geometry_geojson, fetched_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
    on conflict (listing_id) do update set
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      parcel_id = excluded.parcel_id,
      parcel_number = excluded.parcel_number,
      commune = excluded.commune,
      region = excluded.region,
      datasource = excluded.datasource,
      geometry_geojson = excluded.geometry_geojson,
      fetched_at = now()
  `,
      [
        listingId,
        latitude,
        longitude,
        parcel.id,
        parcel.number ?? null,
        parcel.commune ?? null,
        parcel.region ?? null,
        parcel.datasource ?? null,
        JSON.stringify(parcel.geometry),
      ],
    ),
  );
}

function mapCached(row: CachedParcelRow, isStale: boolean): ParcelContextResponse {
  return {
    status: "available",
    provider: "ULDK GUGiK",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    checkedAt: row.fetched_at.toISOString(),
    isStale,
    parcel: {
      id: row.parcel_id,
      number: row.parcel_number ?? undefined,
      commune: row.commune ?? undefined,
      region: row.region ?? undefined,
      datasource: row.datasource ?? undefined,
      geometry: row.geometry_geojson,
      geoportalUrl: `https://mapy.geoportal.gov.pl/imapnext/imap/?identifyParcel=${encodeURIComponent(row.parcel_id)}`,
      urbanRegistryUrl: "https://rejestr-urbanistyczny.gov.pl/published",
    },
  };
}
