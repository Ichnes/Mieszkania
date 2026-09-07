import { pool } from "../../db";
import { normalizePolish, normalizeStreetName } from "../geography/address-normalization";
import {
  canonicalWarsawDistrict,
  canonicalWarsawNeighborhood,
  inferWarsawNeighborhood,
} from "../geography/warsaw-neighborhoods";

type NeighborhoodReference = {
  id: string;
  district: string | null;
  neighborhood: string;
  addressText: string | null;
  latitude?: number;
  longitude?: number;
};

type NeighborhoodEstimateInput = {
  district?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  addressText?: string | null;
  title?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

let referenceCache: { expiresAt: number; rows: NeighborhoodReference[] } | null = null;

export async function estimateWarsawListingNeighborhood(input: NeighborhoodEstimateInput) {
  const references = await loadNeighborhoodReferences();
  return estimateWarsawNeighborhood(input, references);
}

export async function backfillEstimatedWarsawNeighborhoods(options?: { dryRun?: boolean }) {
  const result = await pool.query<{
    id: string;
    district: string | null;
    neighborhood: string | null;
    address_text: string | null;
    title: string;
    description: string | null;
    latitude: string | null;
    longitude: string | null;
  }>(`
    select id, district, neighborhood, address_text, title, description,
           latitude::text, longitude::text
    from listings
    where city = 'Warszawa'
      and hidden_duplicate_of_id is null
  `);

  const references = toReferences(
    result.rows.map((row) => ({
      ...row,
      district: canonicalWarsawDistrict(row.district) ?? row.district,
    })),
  );
  const changes = result.rows.flatMap((row) => {
    const district = canonicalWarsawDistrict(row.district) ?? row.district;
    const existingNeighborhood = canonicalWarsawNeighborhood(row.neighborhood, district);
    const neighborhoodFromDistrictField = canonicalWarsawNeighborhood(row.district, district);
    if (existingNeighborhood && district === row.district) return [];
    const neighborhood = estimateWarsawNeighborhood(
      {
        district,
        neighborhood: existingNeighborhood ?? neighborhoodFromDistrictField,
        addressText: row.address_text,
        title: row.title,
        description: row.description,
        latitude: numberOrUndefined(row.latitude),
        longitude: numberOrUndefined(row.longitude),
      },
      references,
    );
    return neighborhood || district !== row.district
      ? [{ id: row.id, district, neighborhood: neighborhood ?? existingNeighborhood ?? null }]
      : [];
  });

  if (!options?.dryRun && changes.length > 0) {
    await pool.query(
      `
      update listings l
      set district = coalesce(item.district, l.district),
          neighborhood = coalesce(item.neighborhood, l.neighborhood),
          updated_at = now()
      from jsonb_to_recordset($1::jsonb) as item(id uuid, district text, neighborhood text)
      where l.id = item.id
    `,
      [JSON.stringify(changes)],
    );
    referenceCache = null;
  }

  return {
    scanned: result.rows.length,
    estimated: options?.dryRun ? 0 : changes.length,
    candidates: changes.length,
    samples: changes.slice(0, 20),
  };
}

export function estimateWarsawNeighborhood(
  input: NeighborhoodEstimateInput,
  references: NeighborhoodReference[],
) {
  const explicit = canonicalWarsawNeighborhood(input.neighborhood, input.district);
  if (explicit) return explicit;

  const districtKey = normalizeLocation(input.district);
  const candidates = references.filter((reference) => {
    const canonical = canonicalWarsawNeighborhood(reference.neighborhood, reference.district);
    return Boolean(
      canonical && (!districtKey || normalizeLocation(reference.district) === districtKey),
    );
  });

  const streetKey = normalizeStreetName(input.street ?? input.addressText?.split(",", 1)[0]);
  if (streetKey) {
    const sameStreet = candidates.filter(
      (reference) => normalizeStreetName(reference.addressText?.split(",", 1)[0]) === streetKey,
    );
    const fromStreet = chooseEstimate(sameStreet, input.latitude, input.longitude);
    if (fromStreet) return fromStreet;
  }

  // A confirmed street match is more reliable than a neighborhood merely
  // mentioned in marketing copy (for example "5 minutes from Gocław").
  const fromText = inferWarsawNeighborhood(
    [input.title, input.description, input.addressText].filter(Boolean).join(" "),
    input.district,
  );
  if (fromText) return fromText;
  if (candidates.length === 0) return undefined;

  const nearby = candidates
    .filter(
      (reference) =>
        reference.latitude != null &&
        reference.longitude != null &&
        input.latitude != null &&
        input.longitude != null,
    )
    .map((reference) => ({
      ...reference,
      distance: distanceMeters(
        input.latitude!,
        input.longitude!,
        reference.latitude!,
        reference.longitude!,
      ),
    }))
    .filter((reference) => reference.distance <= 2_500)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 12);
  return chooseWeightedNeighborhood(nearby);
}

async function loadNeighborhoodReferences() {
  if (referenceCache && referenceCache.expiresAt > Date.now()) return referenceCache.rows;
  const result = await pool.query<{
    id: string;
    district: string | null;
    neighborhood: string | null;
    address_text: string | null;
    latitude: string | null;
    longitude: string | null;
  }>(`
    select id, district, neighborhood, address_text, latitude::text, longitude::text
    from listings
    where city = 'Warszawa'
      and hidden_duplicate_of_id is null
      and neighborhood is not null
      and btrim(neighborhood) <> ''
  `);
  const rows = toReferences(result.rows);
  referenceCache = { rows, expiresAt: Date.now() + 5 * 60_000 };
  return rows;
}

function toReferences(
  rows: Array<{
    id: string;
    district: string | null;
    neighborhood: string | null;
    address_text: string | null;
    latitude: string | null;
    longitude: string | null;
  }>,
) {
  return rows.flatMap((row): NeighborhoodReference[] => {
    const neighborhood = canonicalWarsawNeighborhood(row.neighborhood, row.district);
    return neighborhood
      ? [
          {
            id: row.id,
            district: row.district,
            neighborhood,
            addressText: row.address_text,
            latitude: numberOrUndefined(row.latitude),
            longitude: numberOrUndefined(row.longitude),
          },
        ]
      : [];
  });
}

function chooseEstimate(
  references: NeighborhoodReference[],
  latitude?: number | null,
  longitude?: number | null,
) {
  if (references.length === 0) return undefined;
  if (latitude != null && longitude != null) {
    const closest = references
      .filter((reference) => reference.latitude != null && reference.longitude != null)
      .map((reference) => ({
        ...reference,
        distance: distanceMeters(latitude, longitude, reference.latitude!, reference.longitude!),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (closest) return closest.neighborhood;
  }
  return chooseWeightedNeighborhood(
    references.map((reference) => ({ ...reference, distance: 500 })),
  );
}

function chooseWeightedNeighborhood(
  references: Array<NeighborhoodReference & { distance: number }>,
) {
  const scores = new Map<string, number>();
  for (const reference of references) {
    scores.set(
      reference.neighborhood,
      (scores.get(reference.neighborhood) ?? 0) + 1 / Math.max(80, reference.distance),
    );
  }
  return [...scores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function normalizeLocation(value?: string | null) {
  return normalizePolish(value ?? "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberOrUndefined(value?: string | null) {
  const number = Number(value);
  return value != null && Number.isFinite(number) ? number : undefined;
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
