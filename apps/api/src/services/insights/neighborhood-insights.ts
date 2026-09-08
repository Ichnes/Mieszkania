import {
  findNearestWarsawMetroStation,
  type AmenityAnalysis,
  type CommuteSummary,
  type FamilySettings,
  type NearbyAmenitySummary,
  type PlannedFacilitySummary,
} from "@mieszkania/shared";
import { withDb } from "../../db";
import { fetchExternalJson } from "../http/external-json";

const RADIUS_METERS = 2_000;
const CACHE_TTL_DAYS = 7;
const CACHE_VERSION = 2;
const SUCCESS_CACHE_MS = 12 * 60 * 60 * 1_000;
const FAILURE_CACHE_MS = 60 * 1_000;

type NeighborhoodInsights = {
  commutes: CommuteSummary[];
  amenities: NearbyAmenitySummary[];
  amenityAnalysis: AmenityAnalysis;
};

type OsmElement = {
  id?: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type AmenityCategory = {
  key: string;
  label: string;
  singular: string;
  tags: Array<{ key: string; values: string[] }>;
};

type CachedNeighborhoodRow = {
  insights_json: {
    cacheVersion?: number;
    amenities: NearbyAmenitySummary[];
    amenityAnalysis: AmenityAnalysis;
  };
};

const amenityCategories: AmenityCategory[] = [
  {
    key: "nursery",
    label: "Żłobki",
    singular: "Żłobek",
    tags: [{ key: "amenity", values: ["childcare", "creche"] }],
  },
  {
    key: "kindergarten",
    label: "Przedszkola",
    singular: "Przedszkole",
    tags: [{ key: "amenity", values: ["kindergarten"] }],
  },
  {
    key: "school",
    label: "Szkoły",
    singular: "Szkoła",
    tags: [{ key: "amenity", values: ["school"] }],
  },
  {
    key: "pharmacy",
    label: "Apteki",
    singular: "Apteka",
    tags: [
      { key: "amenity", values: ["pharmacy"] },
      { key: "shop", values: ["chemist"] },
    ],
  },
  {
    key: "healthcare",
    label: "Zdrowie",
    singular: "Placówka zdrowia",
    tags: [
      { key: "amenity", values: ["hospital", "clinic", "doctors"] },
      {
        key: "healthcare",
        values: ["hospital", "clinic", "doctor", "doctors", "physiotherapist", "dentist"],
      },
    ],
  },
  {
    key: "stops",
    label: "Transport",
    singular: "Przystanek",
    tags: [
      { key: "highway", values: ["bus_stop"] },
      { key: "railway", values: ["tram_stop", "station", "halt"] },
      { key: "public_transport", values: ["platform"] },
      { key: "amenity", values: ["bus_station"] },
    ],
  },
  {
    key: "shops",
    label: "Zakupy spożywcze",
    singular: "Sklep",
    tags: [
      {
        key: "shop",
        values: ["supermarket", "convenience", "grocery", "greengrocer", "bakery", "deli"],
      },
      { key: "amenity", values: ["marketplace"] },
    ],
  },
  {
    key: "green",
    label: "Tereny zielone",
    singular: "Teren zielony",
    tags: [{ key: "leisure", values: ["park", "garden", "nature_reserve"] }],
  },
  {
    key: "playground",
    label: "Place zabaw",
    singular: "Plac zabaw",
    tags: [{ key: "leisure", values: ["playground"] }],
  },
];

const insightsInFlight = new Map<string, Promise<NeighborhoodInsights>>();
const amenitiesInFlight = new Map<string, ReturnType<typeof getAmenities>>();
const insightsCache = new Map<string, { expiresAt: number; value: NeighborhoodInsights }>();

export async function getNeighborhoodInsights(input: {
  listingId: string;
  latitude?: number;
  longitude?: number;
  settings: FamilySettings;
  force?: boolean;
}): Promise<NeighborhoodInsights> {
  if (!isCoordinate(input.latitude) || !isCoordinate(input.longitude)) {
    return {
      commutes: [],
      amenities: [],
      amenityAnalysis: missingLocationAnalysis(),
    };
  }

  const latitude = input.latitude;
  const longitude = input.longitude;
  const cacheKey = buildInsightsCacheKey(input.listingId, latitude, longitude, input.settings);
  const memoryCached = insightsCache.get(cacheKey);
  if (!input.force && memoryCached && memoryCached.expiresAt > Date.now())
    return memoryCached.value;

  const existing = insightsInFlight.get(cacheKey);
  if (existing) return existing;
  const pending = (async () => {
    const [commutes, surroundings] = await Promise.all([
      getCommutes(latitude, longitude, input.settings),
      getCachedOrFreshAmenities(input.listingId, latitude, longitude, input.force ?? false),
    ]);
    const value = { commutes, ...surroundings };
    insightsCache.set(cacheKey, {
      expiresAt:
        Date.now() +
        (value.amenityAnalysis.status === "available" && !value.amenityAnalysis.stale
          ? SUCCESS_CACHE_MS
          : FAILURE_CACHE_MS),
      value,
    });
    if (insightsCache.size > 500) insightsCache.delete(insightsCache.keys().next().value!);
    return value;
  })();
  insightsInFlight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    insightsInFlight.delete(cacheKey);
  }
}

async function getCachedOrFreshAmenities(
  listingId: string,
  latitude: number,
  longitude: number,
  force: boolean,
) {
  const cached = await readCache(listingId, latitude, longitude);
  if (!force && cached) return cached;

  const locationKey = `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
  let request = amenitiesInFlight.get(locationKey);
  if (!request) {
    request = getAmenities(latitude, longitude);
    amenitiesInFlight.set(locationKey, request);
  }
  let surroundings: Awaited<ReturnType<typeof getAmenities>>;
  try {
    surroundings = await request;
  } finally {
    if (amenitiesInFlight.get(locationKey) === request) amenitiesInFlight.delete(locationKey);
  }
  if (
    surroundings.amenityAnalysis.status === "available" &&
    !surroundings.amenityAnalysis.partial
  ) {
    await saveCache(listingId, latitude, longitude, surroundings);
  } else if (surroundings.amenityAnalysis.status === "unavailable") {
    // A public Overpass instance can have a short outage. In that case an older,
    // successful analysis is still more useful than replacing it with an error.
    const stale = cached ?? (await readCache(listingId, latitude, longitude, true));
    if (stale)
      return {
        ...stale,
        amenityAnalysis: {
          ...stale.amenityAnalysis,
          stale: true,
          message: "Serwery mapowe nie odpowiedziały. Pokazujemy ostatnią zapisaną analizę.",
        },
      };
  }
  return surroundings;
}

async function getCommutes(
  latitude: number,
  longitude: number,
  settings: FamilySettings,
): Promise<CommuteSummary[]> {
  return Promise.all(
    settings.workplaces.map(async (workplace): Promise<CommuteSummary> => {
      const basic = { key: workplace.key, label: workplace.label };
      if (!isCoordinate(workplace.latitude) || !isCoordinate(workplace.longitude)) return basic;
      try {
        const route = await fetchRoute(
          latitude,
          longitude,
          workplace.latitude,
          workplace.longitude,
        );
        return {
          ...basic,
          distanceKm: route ? Number((route.distance / 1000).toFixed(1)) : undefined,
          durationMinutes: route ? Math.round(route.duration / 60) : undefined,
        };
      } catch {
        return basic;
      }
    }),
  );
}

async function fetchRoute(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const endpoints = [
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  ];
  for (const endpoint of endpoints) {
    try {
      const url = new URL(
        `${endpoint}/${fromLongitude},${fromLatitude};${toLongitude},${toLatitude}`,
      );
      url.searchParams.set("overview", "false");
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        routes?: Array<{ distance: number; duration: number }>;
      };
      if (payload.routes?.[0]) return payload.routes[0];
    } catch {
      continue;
    }
  }
  return null;
}

async function getAmenities(latitude: number, longitude: number) {
  const results = await Promise.all(
    buildOverpassQueries(latitude, longitude).map((query) => fetchAmenitiesFromOverpass(query)),
  );
  if (results.every((elements) => elements === null)) {
    return {
      amenities: [buildMetroAmenity(latitude, longitude), ...emptyAmenitySummary()],
      amenityAnalysis: {
        ...unavailableAnalysis(),
        message:
          "Nie udało się połączyć z serwerami mapowymi. Spróbuj ponownie później; brak odpowiedzi nie oznacza braku obiektów w okolicy.",
      },
    };
  }
  const analysis = analyzeAmenityElements(
    results.flatMap((elements) => elements ?? []),
    latitude,
    longitude,
  );
  analysis.amenityAnalysis.partial = results.some((elements) => elements === null);
  return analysis;
}

export function buildOverpassQuery(latitude: number, longitude: number) {
  return buildOverpassQueries(latitude, longitude).join("\n");
}

function buildOverpassQueries(latitude: number, longitude: number) {
  const around = `(around:${RADIUS_METERS},${latitude},${longitude})`;
  return [
    `[out:json][timeout:12];(
nwr${around}["amenity"~"^(childcare|creche|kindergarten|school|pharmacy|hospital|clinic|doctors|bus_station|marketplace)$"];
nwr${around}["shop"~"^(chemist|supermarket|convenience|grocery|greengrocer|bakery|deli)$"];
nwr${around}["healthcare"~"^(hospital|clinic|doctor|doctors|physiotherapist|dentist)$"];
nwr${around}["leisure"~"^(park|garden|nature_reserve)$"]["name"];
nwr${around}["leisure"="playground"];
node${around}["highway"="bus_stop"];
node${around}["railway"~"^(tram_stop|station|halt)$"];
node${around}["public_transport"="platform"];
nwr${around}["proposed"~"^(school|kindergarten|childcare|creche|hospital|clinic)$"];
nwr${around}["construction"~"^(school|kindergarten|childcare|creche|hospital|clinic)$"];
nwr${around}["proposed:amenity"~"^(school|kindergarten|childcare|creche|hospital|clinic)$"];
nwr${around}["construction:amenity"~"^(school|kindergarten|childcare|creche|hospital|clinic)$"];
);out center;`,
  ];
}

export function analyzeAmenityElements(
  elements: OsmElement[],
  latitude: number,
  longitude: number,
): {
  amenities: NearbyAmenitySummary[];
  amenityAnalysis: AmenityAnalysis;
} {
  const existingElements = elements.filter((element) => !getPlannedStage(element.tags ?? {}));
  const amenities = [
    buildMetroAmenity(latitude, longitude),
    ...amenityCategories.map((category) =>
      summarizeCategory(category, existingElements, latitude, longitude),
    ),
  ];
  const plannedFacilities = buildPlannedFacilities(elements, latitude, longitude);
  const checkedAt = new Date().toISOString();
  return {
    amenities,
    amenityAnalysis: {
      status: "available",
      source: "OpenStreetMap",
      radiusMeters: RADIUS_METERS,
      checkedAt,
      mapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`,
      plannedFacilities,
    } satisfies AmenityAnalysis,
  };
}

function summarizeCategory(
  category: AmenityCategory,
  elements: OsmElement[],
  latitude: number,
  longitude: number,
): NearbyAmenitySummary {
  const places = dedupeElements(
    elements.filter((element) => matchesCategory(category, element.tags ?? {})),
  )
    .map((element) => {
      const point = getElementPoint(element);
      if (!point) return null;
      return {
        name: element.tags?.name?.trim() || category.singular,
        distanceMeters: Math.round(distanceMeters(latitude, longitude, point.lat, point.lon)),
        latitude: point.lat,
        longitude: point.lon,
      };
    })
    .filter((place): place is NonNullable<typeof place> => Boolean(place))
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  return {
    key: category.key,
    label: category.label,
    count: places.length,
    within500m: places.filter((place) => place.distanceMeters <= 500).length,
    within1000m: places.filter((place) => place.distanceMeters <= 1_000).length,
    nearestDistanceMeters: places[0]?.distanceMeters,
    nearestPlaces: places.slice(0, 3),
  };
}

function buildPlannedFacilities(
  elements: OsmElement[],
  latitude: number,
  longitude: number,
): PlannedFacilitySummary[] {
  return dedupeElements(elements.filter((element) => Boolean(getPlannedStage(element.tags ?? {}))))
    .map((element) => {
      const tags = element.tags ?? {};
      const point = getElementPoint(element);
      const stage = getPlannedStage(tags);
      const category = getPlannedCategory(tags);
      if (!point || !stage || !category) return null;
      return {
        osmKey: `${element.type ?? "element"}:${element.id ?? `${point.lat}:${point.lon}`}`,
        categoryKey: category.key,
        categoryLabel: category.singular,
        name: tags.name?.trim() || `Planowana: ${category.singular.toLocaleLowerCase("pl")}`,
        distanceMeters: Math.round(distanceMeters(latitude, longitude, point.lat, point.lon)),
        latitude: point.lat,
        longitude: point.lon,
        stage,
      } satisfies PlannedFacilitySummary;
    })
    .filter((place): place is PlannedFacilitySummary => Boolean(place))
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

function getPlannedStage(tags: Record<string, string>) {
  if (tags.construction || tags["construction:amenity"] || tags.amenity === "construction")
    return "construction" as const;
  if (tags.proposed || tags["proposed:amenity"] || tags.amenity === "proposed")
    return "proposed" as const;
  return null;
}

function getPlannedCategory(tags: Record<string, string>) {
  const value =
    tags.construction ?? tags.proposed ?? tags["construction:amenity"] ?? tags["proposed:amenity"];
  return amenityCategories.find((category) =>
    category.tags.some((tag) => tag.values.includes(value)),
  );
}

function matchesCategory(category: AmenityCategory, tags: Record<string, string>) {
  return category.tags.some((tag) => tag.values.includes(tags[tag.key]));
}

function buildMetroAmenity(latitude: number, longitude: number): NearbyAmenitySummary {
  const nearestMetro = findNearestWarsawMetroStation(latitude, longitude);
  const isInsideRadius = Boolean(nearestMetro && nearestMetro.distanceMeters <= RADIUS_METERS);
  return {
    key: "metro",
    label: nearestMetro ? `Metro ${nearestMetro.name}` : "Metro",
    count: isInsideRadius ? 1 : 0,
    within500m: nearestMetro && nearestMetro.distanceMeters <= 500 ? 1 : 0,
    within1000m: nearestMetro && nearestMetro.distanceMeters <= 1_000 ? 1 : 0,
    nearestDistanceMeters: nearestMetro?.distanceMeters,
  };
}

function emptyAmenitySummary(): NearbyAmenitySummary[] {
  return amenityCategories.map((category) => ({
    key: category.key,
    label: category.label,
    count: 0,
  }));
}

export async function fetchAmenitiesFromOverpass(
  query: string,
  fetchJson: typeof fetchExternalJson = fetchExternalJson,
) {
  const endpoints = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<{ elements?: OsmElement[]; remark?: string }>(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "mieszkania-local/0.1 (neighborhood analysis)",
        },
        body: new URLSearchParams({ data: query }),
        timeoutMs: 15_000,
        fallbackOnTimeout: false,
      });
      if (!Array.isArray(payload.elements) || payload.remark)
        throw new Error("OVERPASS_INCOMPLETE_RESPONSE");
      return payload.elements;
    } catch (error) {
      const reason =
        error instanceof Error
          ? (error.message.match(/EXTERNAL_HTTP_\d+|OVERPASS_INCOMPLETE_RESPONSE/)?.[0] ??
            error.name)
          : "unknown";
      console.warn("[neighborhood] " + new URL(endpoint).host + ": " + reason);
    }
  }
  return null;
}

function getElementPoint(element: OsmElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number")
    return { lat: element.lat, lon: element.lon };
  return element.center ?? null;
}

function dedupeElements(elements: OsmElement[]) {
  const seen = new Set<string>();
  return elements.filter((element) => {
    const point = getElementPoint(element);
    const normalizedName = element.tags?.name?.trim().toLocaleLowerCase("pl");
    const key =
      normalizedName && point
        ? `${normalizedName}:${point.lat.toFixed(4)}:${point.lon.toFixed(4)}`
        : `${element.type ?? "unknown"}:${element.id ?? `${point?.lat}:${point?.lon}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function readCache(
  listingId: string,
  latitude: number,
  longitude: number,
  allowExpired = false,
) {
  return withDb(async (db) => {
    const result = await db.query<CachedNeighborhoodRow>(
      `
      select insights_json
      from listing_neighborhood_context
      where abs(latitude - $2) < 0.000001
        and abs(longitude - $3) < 0.000001
        and ($4::boolean or fetched_at >= now() - make_interval(days => $5))
      order by (listing_id = $1) desc, fetched_at desc
      limit 1
    `,
      [listingId, latitude, longitude, allowExpired, CACHE_TTL_DAYS],
    );
    const cached = result.rows[0]?.insights_json;
    if (!cached || cached.cacheVersion !== CACHE_VERSION) return null;
    return { amenities: cached.amenities, amenityAnalysis: cached.amenityAnalysis };
  });
}

async function saveCache(
  listingId: string,
  latitude: number,
  longitude: number,
  surroundings: { amenities: NearbyAmenitySummary[]; amenityAnalysis: AmenityAnalysis },
) {
  await withDb((db) =>
    db.query(
      `
    insert into listing_neighborhood_context (listing_id, latitude, longitude, insights_json, fetched_at)
    values ($1,$2,$3,$4,now())
    on conflict (listing_id) do update set
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      insights_json = excluded.insights_json,
      fetched_at = now()
  `,
      [
        listingId,
        latitude,
        longitude,
        JSON.stringify({ cacheVersion: CACHE_VERSION, ...surroundings }),
      ],
    ),
  );
}

function missingLocationAnalysis(): AmenityAnalysis {
  return {
    status: "missing_location",
    source: "OpenStreetMap",
    radiusMeters: RADIUS_METERS,
    plannedFacilities: [],
  };
}

function unavailableAnalysis(): AmenityAnalysis {
  return {
    status: "unavailable",
    source: "OpenStreetMap",
    radiusMeters: RADIUS_METERS,
    plannedFacilities: [],
  };
}

function isCoordinate(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildInsightsCacheKey(
  listingId: string,
  latitude: number,
  longitude: number,
  settings: FamilySettings,
) {
  const workplacesKey = settings.workplaces
    .map(
      (workplace) => `${workplace.key}:${workplace.latitude ?? "x"}:${workplace.longitude ?? "x"}`,
    )
    .join("|");
  return `${listingId}:${latitude.toFixed(5)}:${longitude.toFixed(5)}:${workplacesKey}`;
}
