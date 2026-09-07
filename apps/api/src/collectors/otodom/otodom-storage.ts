import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../db";
import {
  compactArchivePayload,
  createListingArchiveChecksum,
} from "../../services/archive/offer-archive";
import { ensureSource } from "../../services/collecting/source-registry";
import { autoMergeDuplicateByDescription } from "../../services/duplicates/listing-duplicates";
import {
  normalizePolish,
  normalizeWarsawListingCity,
  normalizeWarsawStreetCandidate,
  sanitizeWarsawAddressText,
} from "../../services/geography/address-normalization";
import { findWarsawDistrictAtPoint } from "../../services/geography/warsaw-district-boundaries";
import {
  canonicalWarsawDistrict,
  canonicalWarsawNeighborhood,
  sameStreetOrLocation,
} from "../../services/geography/warsaw-neighborhoods";
import { estimateWarsawListingNeighborhood } from "../../services/insights/listing-neighborhood-estimator";
import { enrichListingFromDescription } from "../../services/listings/listing-description-facts";
import type { CollectorStorage } from "../types";

type ExistingListingRow = {
  id: string;
  price_amount: string | null;
  title: string;
  description: string | null;
  status: string | null;
  content_checksum: string | null;
};

export class OtodomStorage implements CollectorStorage {
  async upsertListingSnapshot(input: {
    sourceKey: string;
    listing: import("../types").ParsedListing;
    refreshMode?: "full" | "price_only";
    rawArtifact: {
      type: "html" | "json" | "image_manifest";
      storageKey: string;
      payload: Record<string, unknown>;
    };
  }): Promise<{
    listingId: string;
    snapshotId: string;
    action: "created" | "updated" | "unchanged";
    mediaAssets: Array<{ assetId: string; storageKey: string; sourceUrl: string }>;
  }> {
    return serializeListingWrite(() => this.upsertListingSnapshotNow(input));
  }

  private async upsertListingSnapshotNow(input: {
    sourceKey: string;
    listing: import("../types").ParsedListing;
    refreshMode?: "full" | "price_only";
    rawArtifact: {
      type: "html" | "json" | "image_manifest";
      storageKey: string;
      payload: Record<string, unknown>;
    };
  }): Promise<{
    listingId: string;
    snapshotId: string;
    action: "created" | "updated" | "unchanged";
    mediaAssets: Array<{ assetId: string; storageKey: string; sourceUrl: string }>;
  }> {
    const normalizedListingText = `${input.listing.title} ${input.listing.description ?? ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l")
      .toLowerCase();
    if (
      normalizedListingText.includes("ogloszenie archiwalne") &&
      input.listing.status !== "removed"
    ) {
      input = { ...input, listing: { ...input.listing, status: "removed" } };
    }

    const portalDistrictNeighborhood = canonicalWarsawNeighborhood(input.listing.district);
    const normalizedDistrict =
      canonicalWarsawDistrict(input.listing.district) ?? input.listing.district;
    const normalizedCity = normalizeWarsawListingCity(
      input.listing.city,
      normalizedDistrict,
      `${input.listing.addressText ?? ""} ${input.listing.title}`,
    );
    if (normalizedCity === "Warszawa") {
      const streetCandidate = normalizeWarsawStreetCandidate(input.listing.street);
      const inferredNeighborhood = await estimateWarsawListingNeighborhood({
        district: normalizedDistrict,
        neighborhood: input.listing.neighborhood ?? portalDistrictNeighborhood,
        street: streetCandidate,
        addressText: input.listing.addressText,
        title: input.listing.title,
        description: input.listing.description,
        latitude: input.listing.latitude,
        longitude: input.listing.longitude,
      });
      const neighborhood =
        inferredNeighborhood &&
        normalizePolish(inferredNeighborhood) !== normalizePolish(normalizedDistrict ?? "")
          ? inferredNeighborhood
          : undefined;
      const street = sameStreetOrLocation(streetCandidate, neighborhood)
        ? undefined
        : (streetCandidate ?? undefined);
      const addressText =
        sanitizeWarsawAddressText(input.listing.addressText, {
          district: normalizedDistrict,
          neighborhood,
          city: normalizedCity,
        }) ??
        ([street, neighborhood, normalizedCity].filter(Boolean).join(", ") || undefined);
      input = {
        ...input,
        listing: {
          ...input.listing,
          city: normalizedCity,
          district: normalizedDistrict,
          neighborhood,
          street,
          addressText,
        },
      };
    }
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const db = await pool.connect();

        try {
          await db.query("begin");
          // Fetching and parsing stay parallel. Serialize only the short write
          // transaction so upserts from different portal workers cannot form a
          // circular lock dependency in PostgreSQL.
          await db.query("select pg_advisory_xact_lock(735189241)");
          const sourceId = await ensureSource(db, input.sourceKey);
          const parsedListing = enrichListingFromDescription(input.listing);
          const pointDistrict =
            parsedListing.city.toLowerCase() === "warszawa" &&
            parsedListing.latitude != null &&
            parsedListing.longitude != null
              ? await findWarsawDistrictAtPoint(parsedListing.latitude, parsedListing.longitude, db)
              : null;
          // The district is derived from the listing point and official OSM boundary,
          // so it is more reliable than a portal label (or a previous approximation).
          const pointNeighborhood = pointDistrict
            ? (canonicalWarsawNeighborhood(parsedListing.neighborhood, pointDistrict) ??
              (await estimateWarsawListingNeighborhood({
                district: pointDistrict,
                neighborhood: parsedListing.neighborhood,
                street: parsedListing.street,
                addressText: parsedListing.addressText,
                title: parsedListing.title,
                description: parsedListing.description,
                latitude: parsedListing.latitude,
                longitude: parsedListing.longitude,
              })))
            : parsedListing.neighborhood;
          const listing = pointDistrict
            ? {
                ...parsedListing,
                district: pointDistrict,
                neighborhood: pointNeighborhood,
                addressText: sanitizeWarsawAddressText(parsedListing.addressText, {
                  district: pointDistrict,
                  neighborhood: pointNeighborhood,
                  city: parsedListing.city,
                }),
              }
            : parsedListing;
          const existingListing = await db.query<ExistingListingRow>(
            `
                select id, price_amount::text, title, description, status::text, content_checksum
                from listings
                where source_id = $1 and external_id = $2
                limit 1
              `,
            [sourceId, listing.externalId],
          );

          const existing = existingListing.rows[0];
          const preserveExistingData = input.refreshMode === "price_only" && Boolean(existing);
          const pricePerSqm =
            listing.priceAmount && listing.areaSqm ? listing.priceAmount / listing.areaSqm : null;
          const contentChecksum = createListingArchiveChecksum(
            listing as unknown as Record<string, unknown>,
          );
          const contentChanged =
            !preserveExistingData && (!existing || existing.content_checksum !== contentChecksum);

          const listingResult = await db.query<{ id: string }>(
            `
                insert into listings (
                  source_id,
                  external_id,
                  canonical_url,
                  title,
                  description,
                  offer_type,
                  market_type,
                  status,
                  price_amount,
                  price_per_sqm,
                  area_sqm,
                  rooms,
                  floor,
                  total_floors,
                  year_built,
                  latitude,
                  longitude,
                  source_contact_phone,
                  address_text,
                  district,
                  neighborhood,
                  city,
                  published_at,
                  content_checksum,
                  removed_at,
                  last_seen_at
                )
                values (
                  $1,$2,$3,$4,$5,$6,$7,$8::listing_status,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                  $23,$24,
                  case when $8::listing_status = 'removed'::listing_status then now() else null end,
                  now()
                )
                on conflict (source_id, external_id)
                do update set
                  canonical_url = case when $25 then listings.canonical_url else excluded.canonical_url end,
                  title = case when $25 then listings.title else excluded.title end,
                  description = case when $25 then listings.description else excluded.description end,
                  status = case when listings.exclusion_reason = 'manual_rejected' then listings.status else excluded.status end,
                  exclusion_reason = case
                    when listings.exclusion_reason = 'manual_rejected' then listings.exclusion_reason
                    when excluded.status = 'active' then null
                    else listings.exclusion_reason
                  end,
                  price_amount = case when $25 then coalesce(excluded.price_amount, listings.price_amount) else excluded.price_amount end,
                  price_per_sqm = case when $25 then coalesce(excluded.price_per_sqm, listings.price_per_sqm) else excluded.price_per_sqm end,
                  area_sqm = case when $25 then coalesce(listings.area_sqm, excluded.area_sqm) else excluded.area_sqm end,
                  rooms = case when $25 then coalesce(listings.rooms, excluded.rooms) else excluded.rooms end,
                  floor = case when $25 then coalesce(listings.floor, excluded.floor) else excluded.floor end,
                  total_floors = case when $25 then coalesce(listings.total_floors, excluded.total_floors) else excluded.total_floors end,
                  year_built = case when $25 then coalesce(listings.year_built, excluded.year_built) else excluded.year_built end,
                  latitude = case when $25 then coalesce(listings.latitude, excluded.latitude) else excluded.latitude end,
                  longitude = case when $25 then coalesce(listings.longitude, excluded.longitude) else excluded.longitude end,
                  source_contact_phone = case when $25 then coalesce(listings.source_contact_phone, excluded.source_contact_phone) else excluded.source_contact_phone end,
                  address_text = case when $25 then coalesce(listings.address_text, excluded.address_text) else excluded.address_text end,
                  district = case when $25 then coalesce(listings.district, excluded.district) else excluded.district end,
                  neighborhood = case when $25 then coalesce(listings.neighborhood, excluded.neighborhood) else excluded.neighborhood end,
                  city = case when $25 then listings.city else excluded.city end,
                  -- Keep the earliest timestamp ever reported by the portal. A later
                  -- crawl (or a portal's modified timestamp) must never make an old
                  -- advert look newly published.
                  published_at = case
                    when listings.published_at is null then excluded.published_at
                    when excluded.published_at is null then listings.published_at
                    else least(listings.published_at, excluded.published_at)
                  end,
                  content_checksum = case when $25 then listings.content_checksum else excluded.content_checksum end,
                  removed_at = case
                    when listings.exclusion_reason = 'manual_rejected' then listings.removed_at
                    when excluded.status = 'removed' then coalesce(listings.removed_at, now())
                    when listings.status = 'removed' and excluded.status = 'active' then null
                    else listings.removed_at
                  end,
                  last_seen_at = now(),
                  updated_at = now()
                returning id
              `,
            [
              sourceId,
              listing.externalId,
              listing.canonicalUrl,
              listing.title,
              listing.description ?? null,
              listing.offerType,
              listing.marketType,
              listing.status,
              listing.priceAmount ?? null,
              pricePerSqm,
              listing.areaSqm ?? null,
              listing.rooms ?? null,
              listing.floor ?? null,
              listing.totalFloors ?? null,
              listing.yearBuilt ?? null,
              listing.latitude ?? null,
              listing.longitude ?? null,
              listing.sourceContactPhone ?? null,
              listing.addressText ?? null,
              listing.district ?? null,
              listing.neighborhood ?? null,
              listing.city,
              listing.publishedAt ?? null,
              contentChecksum,
              preserveExistingData,
            ],
          );

          const listingId = await resolveListingId(
            db,
            sourceId,
            listing.externalId,
            listingResult.rows[0]?.id,
          );

          const snapshotResult = !contentChanged
            ? null
            : await db.query<{ id: string }>(
                `
                insert into listing_snapshots (
                  listing_id,
                  title,
                  description,
                  status,
                  price_amount,
                  price_per_sqm,
                  area_sqm,
                  rooms,
                  floor,
                  payload_raw
                )
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                returning id
              `,
                [
                  listingId,
                  listing.title,
                  listing.description ?? null,
                  listing.status,
                  listing.priceAmount ?? null,
                  pricePerSqm,
                  listing.areaSqm ?? null,
                  listing.rooms ?? null,
                  listing.floor ?? null,
                  JSON.stringify(compactArchivePayload(listing.rawPayload)),
                ],
              );

          const snapshotId = snapshotResult?.rows[0]?.id ?? null;

          const compactArtifactPayload = compactArchivePayload(input.rawArtifact.payload);
          if (contentChanged)
            await db.query(
              `
                insert into crawl_artifacts (source_id, listing_id, artifact_type, storage_key, checksum, payload_raw)
                values ($1, $2, $3, $4, $5, $6)
              `,
              [
                sourceId,
                listingId,
                input.rawArtifact.type,
                input.rawArtifact.storageKey,
                createHash("sha256").update(JSON.stringify(compactArtifactPayload)).digest("hex"),
                JSON.stringify(compactArtifactPayload),
              ],
            );

          const action = await upsertPriceEvents(db, {
            existing,
            listingId,
            snapshotId,
            nextPriceAmount: listing.priceAmount ?? null,
            nextStatus: listing.status,
            contentChanged,
          });

          if (action === "created") {
            await autoMergeDuplicateByDescription(db, listingId);
          }

          const mediaAssets: Array<{ assetId: string; storageKey: string; sourceUrl: string }> = [];

          // Gratka historically saved three low-resolution previews and later
          // appended better variants, leaving stale images visible forever.
          // A full Gratka refresh is authoritative, so replace its image map
          // before inserting the complete XL gallery captured in this run.
          if (contentChanged && input.sourceKey === "gratka") {
            await db.query("delete from listing_images where listing_id = $1", [listingId]);
          }

          if (contentChanged)
            for (const image of listing.images) {
              const storageKey = buildStorageKey(
                input.sourceKey,
                listing.externalId,
                image.position,
                image.sourceUrl,
              );
              const assetResult = await db.query<{ id: string }>(
                `
                  insert into listing_media_assets (storage_key, source_url, content_hash, download_status)
                  values ($1, $2, $3, 'pending')
                  on conflict (storage_key)
                  do update set
                    source_url = excluded.source_url
                  returning id
                `,
                [
                  storageKey,
                  image.sourceUrl,
                  createHash("sha256").update(image.sourceUrl).digest("hex"),
                ],
              );
              const assetId = await resolveMediaAssetId(db, storageKey, assetResult.rows[0]?.id);

              await db.query(
                `
                  insert into listing_images (
                    listing_id,
                    snapshot_id,
                    asset_id,
                    source_url,
                    position,
                    caption,
                    is_primary,
                    last_seen_at,
                    updated_at
                  )
                  values ($1,$2,$3,$4,$5,$6,$7,now(),now())
                  on conflict (listing_id, source_url, position)
                  do update set
                    snapshot_id = coalesce(excluded.snapshot_id, listing_images.snapshot_id),
                    asset_id = excluded.asset_id,
                    caption = excluded.caption,
                    is_primary = excluded.is_primary,
                    last_seen_at = now(),
                    updated_at = now()
                `,
                [
                  listingId,
                  snapshotId,
                  assetId,
                  image.sourceUrl,
                  image.position,
                  image.caption ?? null,
                  image.isPrimary,
                ],
              );

              mediaAssets.push({
                assetId,
                storageKey,
                sourceUrl: image.sourceUrl,
              });
            }

          await db.query("commit");

          return { listingId, snapshotId: snapshotId ?? "", action, mediaAssets };
        } catch (error) {
          await db.query("rollback");
          throw error;
        } finally {
          db.release();
        }
      } catch (error) {
        if (attempt >= 5 || !isRetriableListingWriteError(error)) {
          throw error;
        }
        // Concurrent collectors may briefly lock the same indexes. Jitter keeps
        // retries from colliding again in the same order.
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * 2 ** (attempt - 1) + Math.floor(Math.random() * 120)),
        );
      }
    }

    throw new Error("Listing upsert retry exhausted.");
  }
}

let listingWriteTail: Promise<void> = Promise.resolve();

async function serializeListingWrite<T>(action: () => Promise<T>) {
  const previous = listingWriteTail;
  let release: (() => void) | undefined;
  listingWriteTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await action();
  } finally {
    release?.();
  }
}

async function resolveListingId(
  db: PoolClient,
  sourceId: string,
  externalId: string,
  returnedId?: string,
) {
  if (returnedId) {
    return returnedId;
  }

  const result = await db.query<{ id: string }>(
    `
      select id
      from listings
      where source_id = $1 and external_id = $2
      limit 1
    `,
    [sourceId, externalId],
  );

  const listingId = result.rows[0]?.id;
  if (!listingId) {
    throw new Error(`Nie udalo sie ustalic listing_id dla ${externalId}.`);
  }

  return listingId;
}

async function resolveMediaAssetId(db: PoolClient, storageKey: string, returnedId?: string) {
  if (returnedId) {
    return returnedId;
  }

  const result = await db.query<{ id: string }>(
    `
      select id
      from listing_media_assets
      where storage_key = $1
      limit 1
    `,
    [storageKey],
  );

  const assetId = result.rows[0]?.id;
  if (!assetId) {
    throw new Error(`Nie udalo sie ustalic asset_id dla ${storageKey}.`);
  }

  return assetId;
}

async function upsertPriceEvents(
  db: PoolClient,
  input: {
    existing: ExistingListingRow | undefined;
    listingId: string;
    snapshotId: string | null;
    nextPriceAmount: number | null;
    nextStatus: string;
    contentChanged: boolean;
  },
) {
  if (!input.existing) {
    await db.query(
      `
        insert into price_events (listing_id, snapshot_id, event_type, previous_price_amount, new_price_amount)
        values ($1, $2, 'created', null, $3)
      `,
      [input.listingId, input.snapshotId, input.nextPriceAmount],
    );

    return "created" as const;
  }

  const previousPrice = input.existing.price_amount ? Number(input.existing.price_amount) : null;
  if (input.existing.status !== "removed" && input.nextStatus === "removed") {
    await db.query(
      `
        insert into price_events (
          listing_id,
          snapshot_id,
          event_type,
          previous_price_amount,
          new_price_amount
        )
        values ($1, $2, 'removed', $3, $3)
      `,
      [input.listingId, input.snapshotId, previousPrice],
    );

    return "updated" as const;
  }

  if (input.existing.status === "removed" && input.nextStatus === "active") {
    await db.query(
      `
        insert into price_events (
          listing_id,
          snapshot_id,
          event_type,
          previous_price_amount,
          new_price_amount
        )
        values ($1, $2, 'relisted', $3, $4)
      `,
      [input.listingId, input.snapshotId, previousPrice, input.nextPriceAmount],
    );

    return "updated" as const;
  }

  const priceChanged = previousPrice !== input.nextPriceAmount;
  if (priceChanged) {
    if (previousPrice === null || input.nextPriceAmount === null) {
      return "updated" as const;
    }

    await db.query(
      `
        insert into price_events (
          listing_id,
          snapshot_id,
          event_type,
          previous_price_amount,
          new_price_amount
        )
        values ($1, $2, $3, $4, $5)
      `,
      [
        input.listingId,
        input.snapshotId,
        previousPrice !== null &&
        input.nextPriceAmount !== null &&
        input.nextPriceAmount < previousPrice
          ? "price_drop"
          : "price_increase",
        previousPrice,
        input.nextPriceAmount,
      ],
    );

    return "updated" as const;
  }

  if (input.contentChanged) {
    return "updated" as const;
  }

  return "unchanged" as const;
}

function buildStorageKey(
  sourceKey: string,
  externalId: string,
  position: number,
  sourceUrl: string,
) {
  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  return `sources/${sourceKey}/${externalId}/images/${position}-${hash}`;
}

function isRetriableListingWriteError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeConstraint = "constraint" in error ? error.constraint : undefined;
  const maybeCode = "code" in error ? error.code : undefined;
  return (
    maybeCode === "40P01" || // deadlock_detected
    maybeCode === "40001" || // serialization_failure
    maybeConstraint === "listing_snapshots_listing_id_fkey" ||
    maybeConstraint === "price_events_listing_id_fkey" ||
    maybeConstraint === "listing_images_listing_id_fkey"
  );
}
