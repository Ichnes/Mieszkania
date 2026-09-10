import { pool } from "../../db";
import { findWarsawDistrictAtPoint } from "./warsaw-district-boundaries";
import {
  inferWarsawDistrictFromLocationTitle,
  extractStreetFromLocationTitle,
} from "../listings/listing-title-location";

const overrideDistanceMeters = 1_500;

export async function enrichListingsFromLocalStreets() {
  const [streetResult, listingResult] = await Promise.all([
    pool.query<{
      normalized_name: string;
      name: string;
      district: string | null;
      center_lat: string;
      center_lng: string;
    }>(
      `select normalized_name, district, min(name) as name, avg(center_lat)::text as center_lat, avg(center_lng)::text as center_lng from streets where city = 'Warszawa' group by normalized_name, district`,
    ),
    pool.query<{
      id: string;
      title: string;
      description: string | null;
      address_text: string | null;
      district: string | null;
      city: string;
      latitude: string | null;
      longitude: string | null;
    }>(
      `select id, title, description, address_text, district, city, latitude::text, longitude::text from listings where city ilike 'Warszawa'`,
    ),
  ]);
  const counts = new Map<string, number>();
  for (const street of streetResult.rows)
    counts.set(street.normalized_name, (counts.get(street.normalized_name) ?? 0) + 1);
  const streetsByDistrict = new Map<string, Map<string, (typeof streetResult.rows)[number]>>();
  streetsByDistrict.set("", new Map());
  for (const street of streetResult.rows) {
    if (counts.get(street.normalized_name) === 1)
      streetsByDistrict.get("")!.set(street.normalized_name, street);
    if (street.district) {
      if (!streetsByDistrict.has(street.district))
        streetsByDistrict.set(street.district, new Map());
      streetsByDistrict.get(street.district)!.set(street.normalized_name, street);
    }
  }
  let matched = 0,
    addressUpdated = 0,
    coordinatesFilled = 0,
    coordinatesOverridden = 0,
    districtsAssigned = 0;
  const db = await pool.connect();
  try {
    await db.query("begin");
    for (const listing of listingResult.rows) {
      const preferredDistrict =
        inferWarsawDistrictFromLocationTitle(listing.title) ?? listing.district;
      const streets =
        streetsByDistrict.get(
          preferredDistrict === "Bez dzielnicy" ? "" : (preferredDistrict ?? ""),
        ) ?? new Map();
      // Keep source fields separated: a title ending with a street name must not
      // be consumed by the first word of the description.
      const streetName =
        extractStreetFromLocationTitle(
          listing.title,
          preferredDistrict ?? undefined,
          listing.city,
        ) ??
        extractStreet(
          [listing.address_text, listing.title, listing.description].filter(Boolean).join("\n"),
        );
      if (!streetName) continue;
      const street = findStreet(streets, streetName);
      if (!street) continue;
      matched += 1;
      const address = composeAddress(street.name, preferredDistrict, listing.city);
      const latitude = Number(listing.latitude),
        longitude = Number(listing.longitude);
      const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
      const distance = hasCoordinates
        ? distanceMeters(latitude, longitude, Number(street.center_lat), Number(street.center_lng))
        : Infinity;
      const shouldUseStreetCoordinates = !hasCoordinates || distance > overrideDistanceMeters;
      const pointLatitude = shouldUseStreetCoordinates ? Number(street.center_lat) : latitude;
      const pointLongitude = shouldUseStreetCoordinates ? Number(street.center_lng) : longitude;
      const district = await findWarsawDistrictAtPoint(pointLatitude, pointLongitude, db);
      const shouldAssignDistrict = Boolean(
        district &&
        (!listing.district ||
          listing.district === "Bez dzielnicy" ||
          district === preferredDistrict),
      );
      if (shouldUseStreetCoordinates) {
        await db.query(
          `update listings set address_text = $2, latitude = $3, longitude = $4, district = case when $5 then $6 else district end, updated_at = now() where id = $1`,
          [
            listing.id,
            address,
            street.center_lat,
            street.center_lng,
            shouldAssignDistrict,
            district,
          ],
        );
        if (hasCoordinates) coordinatesOverridden += 1;
        else coordinatesFilled += 1;
        if (shouldAssignDistrict) districtsAssigned += 1;
      } else if (listing.address_text !== address) {
        await db.query(
          `update listings set address_text = $2, district = case when $3 then $4 else district end, updated_at = now() where id = $1`,
          [listing.id, address, shouldAssignDistrict, district],
        );
        addressUpdated += 1;
        if (shouldAssignDistrict) districtsAssigned += 1;
      }
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
  return {
    scanned: listingResult.rows.length,
    matched,
    addressUpdated,
    coordinatesFilled,
    coordinatesOverridden,
    districtsAssigned,
    overrideDistanceMeters,
  };
}

function extractStreet(value: string) {
  const match = value.match(
    /\b(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac)\s+([A-ZĄĆĘŁŃÓŚŹŻ][\p{L}0-9.' -]{1,70}?)(?=,|\.|;|\n|\s{2,}|$)/u,
  );
  return (
    match?.[1]?.trim() ??
    value
      .match(
        /\b(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac)\s+([\p{Lu}][\p{L}0-9.' -]{1,70}?)(?=,|\.|;|\n|\s{2,}|$)/u,
      )?.[1]
      ?.trim()
  );
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
function findStreet<T extends { normalized_name: string }>(streets: Map<string, T>, value: string) {
  const normalized = normalizeStreet(value);
  const exact = streets.get(normalized);
  if (exact) return exact;
  const candidates = [...streets.values()].filter((street) =>
    street.normalized_name.endsWith(` ${normalized}`),
  );
  if (candidates.length === 1) return candidates[0];

  // Portal descriptions commonly use the declined form after "przy ul.", e.g.
  // "Czerskiej" or "Cylichowskiej". Match only the street-name prefix and then
  // return the canonical spelling stored in the local OSM street catalogue.
  const declinedCandidates = [...streets.values()].filter((street) =>
    matchesStreetPrefix(normalized, street.normalized_name),
  );
  return declinedCandidates.length === 1 ? declinedCandidates[0] : undefined;
}

function matchesStreetPrefix(candidate: string, street: string) {
  const candidateWords = candidate.split(" ");
  const streetWords = street.split(" ");
  return (
    candidateWords.length >= streetWords.length &&
    streetWords.every((word, index) => sameStreetWord(candidateWords[index], word))
  );
}

function sameStreetWord(candidate: string, canonical: string) {
  return (
    candidate === canonical || canonicalStreetWord(candidate) === canonicalStreetWord(canonical)
  );
}

function canonicalStreetWord(value: string) {
  // Regular feminine street adjectives: Czerska -> Czerskiej,
  // Cylichowska -> Cylichowskiej, Piwna -> Piwnej.
  if (value.endsWith("iej")) return `${value.slice(0, -3)}a`;
  if (value.endsWith("ej")) return `${value.slice(0, -2)}a`;
  return value;
}
function composeAddress(street: string, district: string | null, city: string) {
  return [street, district, city]
    .filter(
      (value, index, values) =>
        value &&
        values.findIndex((item) => normalizeStreet(item ?? "") === normalizeStreet(value)) ===
          index,
    )
    .join(", ");
}
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(bLat - aLat),
    dLng = radians(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
