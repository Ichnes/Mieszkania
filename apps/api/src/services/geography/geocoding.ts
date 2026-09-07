import { pool } from "../../db";
import { normalizeWarsawStreetCandidate } from "./address-normalization";
import { canonicalWarsawNeighborhood, inferWarsawNeighborhood } from "./warsaw-neighborhoods";

type LocationPrecision = "exact_address" | "street" | "district" | "city";
type GeocodeResult = {
  latitude: number;
  longitude: number;
  approximate?: boolean;
  precision: LocationPrecision;
};
let nextNominatimRequestAt = 0;

export async function geocodeListing(input: {
  city: string;
  district?: string;
  neighborhood?: string;
  street?: string;
  addressText?: string;
}): Promise<{ latitude: number; longitude: number; approximate?: boolean } | null> {
  const normalizedStreet = normalizeWarsawStreetCandidate(input.street);
  const normalizedAddress = normalizeAddressForGeocoding(
    input.addressText ?? normalizedStreet ?? input.street,
  );
  const parsedAddress = normalizedAddress ? parsePolishAddress(normalizedAddress) : null;
  const districtQuery = [input.neighborhood, input.district, input.city, "Polska"]
    .filter(Boolean)
    .join(", ");
  const cityQuery = [input.city, "Polska"].filter(Boolean).join(", ");
  const cacheKey = buildCacheKey({
    city: input.city,
    street: normalizedStreet ?? undefined,
    address: normalizedAddress,
    district: input.district,
    neighborhood: input.neighborhood,
  });
  const cached = await readGeocodeCache(cacheKey);
  if (cached) return cached;
  const localStreet = normalizedStreet ? await findWarsawStreet(normalizedStreet) : null;
  if (localStreet) {
    await writeGeocodeCache(cacheKey, normalizedStreet ?? input.city, localStreet);
    return localStreet;
  }

  const candidates: Array<{ url: URL | null; precision: LocationPrecision }> = [
    {
      url: buildStructuredSearchUrl(parsedAddress),
      precision: parsedAddress?.houseNumber ? "exact_address" : "street",
    },
    { url: buildStreetSearchUrl(normalizedStreet ?? undefined, input.city), precision: "street" },
    {
      url: buildFreeTextSearchUrl(
        normalizedAddress
          ? [normalizedAddress, input.district, input.city, "Polska"].filter(Boolean).join(", ")
          : [normalizedStreet, input.district, input.city, "Polska"].filter(Boolean).join(", "),
      ),
      precision: parsedAddress?.houseNumber ? "exact_address" : "street",
    },
    { url: buildFreeTextSearchUrl(districtQuery), precision: "district" },
    { url: buildFreeTextSearchUrl(cityQuery), precision: "city" },
  ];

  for (const candidate of candidates) {
    if (!candidate.url) continue;
    const result = await fetchGeocodeResult(candidate.url, candidate.precision);
    if (result) {
      await writeGeocodeCache(cacheKey, candidate.url.toString(), result);
      return result;
    }
  }

  const fallback = resolveApproximateWarsawPoint(input);
  if (fallback)
    await writeGeocodeCache(cacheKey, cityQuery, { ...fallback, precision: "district" });
  return fallback;
}

export async function reverseGeocodeListing(input: { latitude: number; longitude: number }) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(input.latitude));
  url.searchParams.set("lon", String(input.longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  await waitForNominatimSlot();
  const response = await fetch(url, {
    headers: {
      "user-agent": process.env.NOMINATIM_USER_AGENT ?? "mieszkania-local-app/0.1",
      accept: "application/json",
      "accept-language": "pl",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string | undefined>;
  };

  const address = payload.address ?? {};
  const city = address.city ?? address.town ?? address.municipality ?? address.county ?? undefined;
  const district =
    normalizeWarsawDistrict(address.city_district) ??
    normalizeWarsawDistrict(address.suburb) ??
    normalizeWarsawDistrict(address.borough) ??
    undefined;
  const neighborhood =
    canonicalWarsawNeighborhood(address.neighbourhood, district) ??
    canonicalWarsawNeighborhood(address.quarter, district) ??
    canonicalWarsawNeighborhood(address.suburb, district) ??
    inferWarsawNeighborhood(Object.values(address).filter(Boolean).join(" "), district);
  const street = address.road ?? address.pedestrian ?? address.residential ?? undefined;

  return {
    city,
    district,
    neighborhood,
    street,
    addressText: payload.display_name ?? undefined,
  };
}

function normalizeWarsawDistrict(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();

  const lookup: Record<string, string> = {
    bemowo: "Bemowo",
    bialoleka: "Białołęka",
    bielany: "Bielany",
    mokotow: "Mokotów",
    ochota: "Ochota",
    "praga polnoc": "Praga-Północ",
    "praga poludnie": "Praga-Południe",
    rembertow: "Rembertów",
    srodmiescie: "Śródmieście",
    targowek: "Targówek",
    ursus: "Ursus",
    ursynow: "Ursynów",
    wawer: "Wawer",
    wesola: "Wesoła",
    wilanow: "Wilanów",
    wlochy: "Włochy",
    wola: "Wola",
    zoliborz: "Żoliborz",
    "stare miasto": "Śródmieście",
    "stara praga": "Praga-Północ",
    "nowa praga": "Praga-Północ",
    goclaw: "Praga-Południe",
    grochow: "Praga-Południe",
    "saska kepa": "Praga-Południe",
    sluzewiec: "Mokotów",
    sluzew: "Mokotów",
    "ste gny": "Mokotów",
    stegna: "Mokotów",
    sadyba: "Mokotów",
  };

  return lookup[normalized] ?? null;
}

async function fetchGeocodeResult(
  url: URL,
  precision: LocationPrecision,
): Promise<GeocodeResult | null> {
  await waitForNominatimSlot();
  const response = await fetch(url, {
    headers: {
      "user-agent": process.env.NOMINATIM_USER_AGENT ?? "mieszkania-local-app/0.1",
      accept: "application/json",
      "accept-language": "pl",
    },
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];

  if (!first) {
    return null;
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    approximate: precision !== "exact_address",
    precision,
  };
}

async function waitForNominatimSlot() {
  const delay = Math.max(0, nextNominatimRequestAt - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  nextNominatimRequestAt = Date.now() + 1_000;
}

async function readGeocodeCache(cacheKey: string): Promise<GeocodeResult | null> {
  const result = await pool
    .query<{
      latitude: string | null;
      longitude: string | null;
      location_precision: LocationPrecision;
    }>(
      `select latitude::text, longitude::text, location_precision from geocode_cache where cache_key = $1`,
      [cacheKey],
    )
    .catch(() => null);
  const row = result?.rows[0];
  if (!row?.latitude || !row.longitude) return null;
  return {
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    approximate: row.location_precision !== "exact_address",
    precision: row.location_precision,
  };
}

async function writeGeocodeCache(cacheKey: string, queryText: string, result: GeocodeResult) {
  await pool
    .query(
      `insert into geocode_cache (cache_key, query_text, latitude, longitude, location_precision)
     values ($1, $2, $3, $4, $5)
     on conflict (cache_key) do update set latitude = excluded.latitude, longitude = excluded.longitude, location_precision = excluded.location_precision, query_text = excluded.query_text, updated_at = now()`,
      [cacheKey, queryText, result.latitude, result.longitude, result.precision],
    )
    .catch(() => undefined);
}

async function findWarsawStreet(street: string): Promise<GeocodeResult | null> {
  const result = await pool
    .query<{
      center_lat: string;
      center_lng: string;
    }>(
      `select center_lat::text, center_lng::text from streets where city = 'Warszawa' and normalized_name = $1 limit 1`,
      [normalizeStreetName(street)],
    )
    .catch(() => null);
  const row = result?.rows[0];
  return row
    ? {
        latitude: Number(row.center_lat),
        longitude: Number(row.center_lng),
        approximate: true,
        precision: "street",
      }
    : null;
}

function buildCacheKey(input: {
  city: string;
  street?: string;
  address?: string;
  district?: string;
  neighborhood?: string;
}) {
  return normalizeForLookup(
    [input.address, input.street, input.neighborhood, input.district, input.city]
      .filter(Boolean)
      .join(" | "),
  );
}

function normalizeStreetName(value: string) {
  return normalizeForLookup(value)
    .replace(/\b(?:ul|ulica|al|aleja|pl|plac)\.?\s*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildFreeTextSearchUrl(query: string) {
  if (!query) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "pl");
  return url;
}

function buildStructuredSearchUrl(
  parsed: { street: string; houseNumber?: string; postalCode?: string; city?: string } | null,
) {
  if (!parsed?.street) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set(
    "street",
    parsed.houseNumber ? `${parsed.street} ${parsed.houseNumber}` : parsed.street,
  );
  if (parsed.postalCode) {
    url.searchParams.set("postalcode", parsed.postalCode);
  }
  url.searchParams.set("city", parsed.city ?? "Warszawa");
  url.searchParams.set("country", "Polska");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "pl");
  return url;
}

function buildStreetSearchUrl(street?: string, city?: string) {
  if (!street) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("street", normalizeAddressForGeocoding(street) ?? street);
  url.searchParams.set("city", city ?? "Warszawa");
  url.searchParams.set("country", "Polska");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "pl");
  return url;
}

function resolveApproximateWarsawPoint(input: {
  city: string;
  district?: string;
  neighborhood?: string;
  street?: string;
  addressText?: string;
}) {
  if (!normalizeAddressForGeocoding(input.city)?.toLowerCase().includes("warszawa")) {
    return null;
  }

  const haystack = normalizeForLookup(
    [input.street, input.neighborhood, input.district, input.addressText].filter(Boolean).join(" "),
  );
  const points: Array<[string, { latitude: number; longitude: number; approximate: true }]> = [
    ["bokserska", { latitude: 52.1719, longitude: 20.9989, approximate: true }],
    ["sluzewiec", { latitude: 52.1749, longitude: 20.9993, approximate: true }],
    ["bemowo", { latitude: 52.2382, longitude: 20.9134, approximate: true }],
    ["bialoleka", { latitude: 52.3202, longitude: 21.0106, approximate: true }],
    ["bielany", { latitude: 52.2921, longitude: 20.9347, approximate: true }],
    ["mokotow", { latitude: 52.1937, longitude: 21.034, approximate: true }],
    ["ochota", { latitude: 52.2122, longitude: 20.9727, approximate: true }],
    ["praga polnoc", { latitude: 52.2601, longitude: 21.0292, approximate: true }],
    ["praga poludnie", { latitude: 52.238, longitude: 21.0838, approximate: true }],
    ["srodmiescie", { latitude: 52.2319, longitude: 21.0067, approximate: true }],
    ["targowek", { latitude: 52.2751, longitude: 21.0587, approximate: true }],
    ["ursus", { latitude: 52.1952, longitude: 20.8842, approximate: true }],
    ["ursynow", { latitude: 52.141, longitude: 21.0323, approximate: true }],
    ["wawer", { latitude: 52.2084, longitude: 21.1604, approximate: true }],
    ["wesola", { latitude: 52.254, longitude: 21.2241, approximate: true }],
    ["wilanow", { latitude: 52.1637, longitude: 21.0876, approximate: true }],
    ["wlochy", { latitude: 52.1862, longitude: 20.9489, approximate: true }],
    ["wola", { latitude: 52.2326, longitude: 20.9521, approximate: true }],
    ["zoliborz", { latitude: 52.268, longitude: 20.9864, approximate: true }],
  ];

  return points.find(([needle]) => haystack.includes(needle))?.[1] ?? null;
}

function parsePolishAddress(value: string) {
  const match = value.match(
    /^(?<street>.+?)\s+(?<houseNumber>\d+[A-Za-z0-9\/-]*)[, ]+\s*(?<postalCode>\d{2}-\d{3})\s+(?<city>.+)$/,
  );

  if (!match?.groups?.street) {
    return null;
  }

  return {
    street: match.groups.street.trim(),
    houseNumber: match.groups.houseNumber?.trim(),
    postalCode: match.groups.postalCode?.trim(),
    city: match.groups.city?.trim(),
  };
}

function normalizeAddressForGeocoding(value?: string) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\bPostepu\b/gi, "Postępu")
    .replace(/\bDaszynskiego\b/gi, "Daszyńskiego")
    .replace(/\bRondo Daszynskiego\b/gi, "Rondo Daszyńskiego")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
