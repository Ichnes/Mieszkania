import type { Pool } from "pg";
import { hasExposureFilter, matchesExposureFilter } from "@mieszkania/shared";
import { extractFeatures, resolveListingAmenities } from "../listings/listing-repository";
import { marketSnapshotPayloadSql } from "./market-snapshot";

export async function getMarketAmenityFilter(
  db: Pool,
  baseFilter: string,
  options: { elevator?: string; garage?: string; storage?: string; directions?: string },
) {
  if (
    options.elevator !== "true" &&
    options.garage !== "true" &&
    options.storage !== "true" &&
    !hasExposureFilter(options.directions)
  )
    return "";
  const result = await db.query<{
    id: string;
    description: string | null;
    payload_raw: Record<string, unknown> | null;
    has_lift_override: boolean | null;
    has_garage_override: boolean | null;
    has_storage_override: boolean | null;
  }>(`
    select l.id, l.description, snapshot.payload_raw, manual.has_lift_override, manual.has_garage_override, manual.has_storage_override
    from listings l
    left join listing_manual_overrides manual on manual.listing_id=l.id
    left join lateral (
      select ${marketSnapshotPayloadSql} payload_raw from listing_snapshots where listing_id=l.id order by captured_at desc limit 1
    ) snapshot on true
    where lower(l.city)='warszawa' and ${baseFilter}
  `);
  const ids = result.rows
    .filter((row) => {
      const description = row.description ?? "";
      const features = extractFeatures({
        description,
        snapshotPayload: row.payload_raw ?? undefined,
      });
      const amenities = resolveListingAmenities(
        features,
        { lift: row.has_lift_override, garage: row.has_garage_override },
        description,
      );
      return (
        (options.elevator !== "true" || amenities.lift === true) &&
        (options.garage !== "true" || amenities.garage === true) &&
        (options.storage !== "true" ||
          (row.has_storage_override ?? features.some((feature) => feature.key === "storage"))) &&
        matchesExposureFilter(description, options.directions)
      );
    })
    .map((row) => row.id);
  // IDs originate in PostgreSQL. Validate before embedding this shared predicate
  // in the existing aggregate queries, which have different parameter lists.
  if (ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id)))
    throw new Error("Invalid listing UUID in amenity filter");
  return ids.length ? ` and l.id in (${ids.map((id) => `'${id}'::uuid`).join(",")})` : " and false";
}
