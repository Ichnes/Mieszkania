import type {
  DashboardStat,
  FamilySettings,
  ListingContactEvent,
  ListingContactEventType,
  ListingContactStatus,
  ListingDecisionStage,
  ListingDetail,
  ListingFeature,
  ListingFilters,
  ListingSummary,
  RcnComparableTransaction
} from "@mieszkania/shared";
import { findNearestWarsawMetroStation } from "@mieszkania/shared";
import { withDb } from "../db";
import { activeRegion } from "../domain/region";
import { getRelatedCounts, getRelatedListings } from "./listing-duplicates";
import { getFamilySettings } from "./family-settings";
import { geocodeListing } from "./geocoding";
import { getListingImages, getListingImagesForListings, getMediaResponsePath } from "./image-repository";
import { getNeighborhoodInsights } from "./neighborhood-insights";
import { getListingViewing } from "./listing-viewings";
import { buildEffectiveListingDateSql } from "./listing-recency";
import { normalizePolish, normalizeStreetName, normalizeWarsawStreetAddress, normalizeWarsawStreetCandidate } from "./address-normalization";
import { extractStreetFromLocationTitle, inferWarsawDistrictFromLocationTitle } from "./listing-title-location";
import { inferConstructionYear } from "./listing-description-facts";
import { findWarsawDistrictAtPoint } from "./warsaw-district-boundaries";
import { canonicalWarsawNeighborhood, inferWarsawNeighborhood, isWarsawNeighborhoodLabel, sameStreetOrLocation } from "./warsaw-neighborhoods";

type ListingRow = {
  id: string;
  canonical_url: string;
  status: string | null;
  source_name: string | null;
  published_at: string | null;
  first_seen_at: string | null;
  title: string;
  description: string | null;
  city: string;
  district: string | null;
  neighborhood: string | null;
  address_text: string | null;
  latitude: string | null;
  longitude: string | null;
  source_contact_phone: string | null;
  price_amount: string | null;
  price_per_sqm: string | null;
  area_sqm: string | null;
  rooms: string | null;
  floor: number | null;
  total_floors: number | null;
  year_built: number | null;
  is_shortlisted: boolean;
  viewing_id: string | null;
  viewing_scheduled_at: string | null;
  viewing_status: "scheduled" | "completed" | "cancelled" | null;
  viewing_notes: string | null;
  manual_contact_name: string | null;
  manual_contact_status: string | null;
  manual_decision_stage: string | null;
  manual_contact_phone: string | null;
  manual_contact_role: string | null;
  manual_negotiated_price_amount: string | null;
  manual_asking_price_override: string | null;
  manual_notes: string | null;
  manual_source_notes: string | null;
  manual_last_contact_at: string | null;
  manual_has_lift_override: boolean | null;
  manual_has_garage_override: boolean | null;
  manual_has_storage_override: boolean | null;
  manual_garage_cost_override: string | null;
  manual_storage_cost_override: string | null;
  relisting_previous_listing_id: string | null;
  relisting_previous_price_amount: string | null;
  relisting_relisted_price_amount: string | null;
  snapshot_payload_raw?: Record<string, unknown> | null;
};

type PriceEventRow = {
  listing_id: string;
  event_type: string;
  previous_price_amount: string | null;
  new_price_amount: string | null;
  changed_at: string;
};

const MAX_VISIBLE_LISTING_PRICE = 2_200_000;
const MIN_VISIBLE_LISTING_AREA_SQM = 56;
const RCN_BENCHMARK_YEARS = 4;
const RCN_COMPARABLE_RADIUS_METERS = 150;
const EFFECTIVE_LISTING_DATE_SQL = buildEffectiveListingDateSql("l");

type SnapshotPayloadRow = {
  payload_raw: Record<string, unknown>;
};

type ListingContactEventRow = {
  id: string;
  listing_id: string;
  event_type: string;
  occurred_at: string;
  title: string | null;
  notes: string | null;
  contact_name: string | null;
  amount: string | null;
  created_at: string;
};

type DashboardContext = {
  stats: DashboardStat[];
  listings: ListingSummary[];
};

type ListingsPage = {
  total: number;
  items: ListingSummary[];
};

type RcnBenchmark = {
  avgPricePerSqm: number;
  sampleCount: number;
  scope: "street" | "neighborhood" | "district";
};

export async function getDashboardContext(): Promise<DashboardContext> {
  const [stats, listings] = await Promise.all([getDashboardStats(), getListings()]);
  return { stats, listings };
}

export async function getListings(filters: ListingFilters = {}): Promise<ListingSummary[]> {
  const page = await getListingsPageByScope("region", {
    ...filters,
    page: 1,
    pageSize: filters.pageSize ?? 60
  });
  return page.items;
}

export async function getListingsPage(filters: ListingFilters = {}): Promise<ListingsPage> {
  return getListingsPageByScope("region", filters);
}

export async function getMapListings() {
  return withDb(async (db) => {
    const result = await db.query<{
      id: string;
      title: string;
      source_label: string | null;
      city: string;
      price_label: string | null;
      district: string | null;
      neighborhood: string | null;
      latitude: string | null;
      longitude: string | null;
      is_shortlisted: boolean;
      price_change_percent: string | null;
      coordinate_accuracy: "exact" | "approximate" | null;
      rooms: string | null;
      published_at: string | null;
      first_seen_at: string | null;
      address_text: string | null;
      area_sqm: string | null;
      thumbnail_url: string | null;
    }>(`
      select
        l.id,
        l.title,
        s.name as source_label,
        l.city,
        l.price_amount::text as price_label,
        l.district,
        l.neighborhood,
        l.address_text,
        l.area_sqm::text as area_sqm,
        l.latitude::text,
        l.longitude::text,
        l.is_shortlisted,
        l.rooms::text as rooms,
        l.published_at::text as published_at,
        l.first_seen_at::text as first_seen_at,
        case
          when pe.previous_price_amount is null or pe.previous_price_amount = 0 then 0
          else round(((pe.new_price_amount - pe.previous_price_amount) / pe.previous_price_amount) * 100, 2)
        end::text as price_change_percent,
        case when l.latitude is null or l.longitude is null then null else 'approximate' end as coordinate_accuracy,
        cover.source_url as thumbnail_url
      from listings l
      join sources s on s.id = l.source_id
      left join lateral (
        select previous_price_amount, new_price_amount
        from price_events
        where listing_id = l.id
          and event_type in ('price_drop', 'price_increase')
        order by changed_at desc
        limit 1
      ) pe on true
      left join lateral (
        select li.source_url
        from listing_images li
        where li.listing_id = l.id
        order by li.is_primary desc, li.position asc, li.created_at asc
        limit 1
      ) cover on true
      where l.status = 'active'
        and l.hidden_duplicate_of_id is null
        and coalesce(l.rooms, 0) <> 2
        and l.city = any($1::text[])
        and (l.price_amount is null or l.price_amount <= ${MAX_VISIBLE_LISTING_PRICE})
        and (l.area_sqm is null or l.area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM})
      order by ${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc
    `, [activeRegion.supportedCities]);

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      sourceLabel: row.source_label ?? undefined,
      city: row.city,
      priceLabel: row.price_label ? `${Number(row.price_label).toLocaleString("pl-PL")} zł` : "Brak ceny",
      areaLabel: row.area_sqm ? `${Number(row.area_sqm).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} m2` : "Brak metrażu",
      district: row.district ?? "Brak dzielnicy",
      neighborhood: row.neighborhood ?? undefined,
      addressText: row.address_text ?? undefined,
      latitude: row.latitude ? Number(row.latitude) : undefined,
      longitude: row.longitude ? Number(row.longitude) : undefined,
      isShortlisted: row.is_shortlisted,
      roomsCount: row.rooms ? Number(row.rooms) : undefined,
      publishedAt: row.published_at ?? undefined,
      firstSeenAt: row.first_seen_at ?? undefined,
      thumbnailUrl: row.thumbnail_url ?? undefined,
      imageUrls: row.thumbnail_url ? [row.thumbnail_url] : [],
      imageCount: row.thumbnail_url ? 1 : 0,
      badges: [],
      priceChangePercent: Number(row.price_change_percent ?? 0),
      coordinateAccuracy: row.coordinate_accuracy ?? undefined
    }));
  });
}

export async function getRecentCollectedListings(): Promise<ListingSummary[]> {
  const page = await getListingsPageByScope("region", {
    page: 1,
    pageSize: 60
  });
  return page.items;
}

export async function updateListingShortlist(listingId: string, shortlisted: boolean) {
  return withDb(async (db) => {
    const result = await db.query<{ is_shortlisted: boolean }>(
      `
        update listings
        set is_shortlisted = $2,
            updated_at = now()
        where id = $1
        returning is_shortlisted
      `,
      [listingId, shortlisted]
    );

    return result.rows[0]?.is_shortlisted ?? null;
  });
}

export async function updateListingManualData(
  listingId: string,
  input: {
    contactStatus?: ListingContactStatus;
    decisionStage?: ListingDecisionStage;
    contactName?: string;
    contactPhone?: string;
    contactRole?: string;
    negotiatedPriceAmount?: number;
    askingPriceOverride?: number;
    notes?: string;
    sourceNotes?: string;
    lastContactAt?: string;
    hasLiftOverride?: boolean;
    hasGarageOverride?: boolean;
    hasStorageOverride?: boolean;
    garageCostOverride?: number;
    storageCostOverride?: number;
  }
) {
  return withDb(async (db) => {
    const contactStatus = normalizeListingContactStatus(input.contactStatus);
    const decisionStage = normalizeListingDecisionStage(input.decisionStage);
    const updated = await db.query<{ id: string }>(
      `
        insert into listing_manual_overrides (
          listing_id,
          contact_status,
          decision_stage,
          contact_name,
          contact_phone,
          contact_role,
          negotiated_price_amount,
          asking_price_override,
          notes,
          source_notes,
          last_contact_at,
          has_lift_override,
          has_garage_override,
          has_storage_override,
          garage_cost_override,
          storage_cost_override,
          updated_at
        )
        select
          l.id,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          now()
        from listings l
        where l.id = $1
        on conflict (listing_id)
        do update set
          contact_status = excluded.contact_status,
          decision_stage = excluded.decision_stage,
          contact_name = excluded.contact_name,
          contact_phone = excluded.contact_phone,
          contact_role = excluded.contact_role,
          negotiated_price_amount = excluded.negotiated_price_amount,
          asking_price_override = excluded.asking_price_override,
          notes = excluded.notes,
          source_notes = excluded.source_notes,
          last_contact_at = excluded.last_contact_at,
          has_lift_override = excluded.has_lift_override,
          has_garage_override = excluded.has_garage_override,
          has_storage_override = excluded.has_storage_override,
          garage_cost_override = excluded.garage_cost_override,
          storage_cost_override = excluded.storage_cost_override,
          updated_at = now()
        returning listing_id as id
      `,
      [
        listingId,
        contactStatus,
        decisionStage,
        normalizeNullableText(input.contactName),
        normalizeNullableText(input.contactPhone),
        normalizeNullableText(input.contactRole),
        normalizeNullableNumber(input.negotiatedPriceAmount),
        normalizeNullableNumber(input.askingPriceOverride),
        normalizeNullableText(input.notes),
        normalizeNullableText(input.sourceNotes),
        normalizeNullableTimestamp(input.lastContactAt),
        typeof input.hasLiftOverride === "boolean" ? input.hasLiftOverride : null,
        typeof input.hasGarageOverride === "boolean" ? input.hasGarageOverride : null,
        typeof input.hasStorageOverride === "boolean" ? input.hasStorageOverride : null,
        normalizeNullableNumber(input.garageCostOverride),
        normalizeNullableNumber(input.storageCostOverride)
      ]
    );

    if (!updated.rows[0]) {
      return null;
    }

    return getListingDetail(listingId);
  });
}

export async function addListingContactEvent(
  listingId: string,
  input: {
    eventType?: ListingContactEventType;
    occurredAt?: string;
    title?: string;
    notes?: string;
    contactName?: string;
    amount?: number;
  }
) {
  return withDb(async (db) => {
    const eventType = normalizeListingContactEventType(input.eventType);
    const occurredAt = normalizeNullableTimestamp(input.occurredAt);

    if (!eventType || !occurredAt) {
      return null;
    }

    const inserted = await db.query<{ id: string }>(
      `
        insert into listing_contact_events (
          listing_id,
          event_type,
          occurred_at,
          title,
          notes,
          contact_name,
          amount
        )
        select
          l.id,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        from listings l
        where l.id = $1
        returning id
      `,
      [
        listingId,
        eventType,
        occurredAt,
        normalizeNullableText(input.title),
        normalizeNullableText(input.notes),
        normalizeNullableText(input.contactName),
        normalizeNullableNumber(input.amount)
      ]
    );

    if (!inserted.rows[0]) {
      return null;
    }

    return getListingDetail(listingId);
  });
}

export async function getListingDetail(listingId: string): Promise<ListingDetail | null> {
  return withDb(async (db) => {
    const result = await db.query<ListingRow>(
      `
        select
          l.id,
          l.canonical_url,
          l.status,
          s.name as source_name,
          l.published_at::text,
          l.first_seen_at::text,
          l.title,
          l.description,
          l.city,
          l.district,
          l.neighborhood,
          l.address_text,
          l.latitude::text,
          l.longitude::text,
          l.source_contact_phone,
          l.price_amount::text,
          l.price_per_sqm::text,
          l.area_sqm::text,
          l.rooms::text,
          l.floor,
          l.total_floors,
          l.year_built,
          l.is_shortlisted,
          lv.id as viewing_id,
          lv.scheduled_at::text as viewing_scheduled_at,
          lv.status as viewing_status,
          lv.notes as viewing_notes,
          lmo.contact_status as manual_contact_status,
          lmo.decision_stage as manual_decision_stage,
          lmo.contact_name as manual_contact_name,
          lmo.contact_phone as manual_contact_phone,
          lmo.contact_role as manual_contact_role,
          lmo.negotiated_price_amount::text as manual_negotiated_price_amount,
          lmo.asking_price_override::text as manual_asking_price_override,
          lmo.notes as manual_notes,
          lmo.source_notes as manual_source_notes,
          lmo.last_contact_at::text as manual_last_contact_at,
          lmo.has_lift_override as manual_has_lift_override,
          lmo.has_garage_override as manual_has_garage_override,
          lmo.has_storage_override as manual_has_storage_override,
          lmo.garage_cost_override::text as manual_garage_cost_override,
          lmo.storage_cost_override::text as manual_storage_cost_override,
          lr.previous_listing_id::text as relisting_previous_listing_id,
          lr.previous_price_amount::text as relisting_previous_price_amount,
          lr.relisted_price_amount::text as relisting_relisted_price_amount,
          ls.payload_raw as snapshot_payload_raw
        from listings l
        join sources s on s.id = l.source_id
        left join listing_viewings lv on lv.listing_id = l.id
        left join listing_manual_overrides lmo on lmo.listing_id = l.id
        left join listing_relistings lr on lr.current_listing_id = l.id
        left join lateral (
          select payload_raw
          from listing_snapshots
          where listing_id = l.id
          order by captured_at desc
          limit 1
        ) ls on true
        where l.id = $1
        limit 1
      `,
      [listingId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const [images, priceHistoryResult, viewing, contactHistory, relatedListings, rcnTransactions] = await Promise.all([
      getListingImages(row.id),
      db.query<PriceEventRow>(
        `
          select listing_id, event_type, previous_price_amount::text, new_price_amount::text, changed_at::text
          from price_events
          where listing_id = $1
          order by changed_at asc
        `,
        [listingId]
      ),
      getListingViewing(listingId),
      listListingContactEvents(db, listingId),
      getRelatedListings(listingId),
      getRcnComparableTransactions(db, row)
    ]);
    const rcnBenchmark = await getRcnBenchmark(db, row);

    const resolvedImages = images
      .map((image) => ({
        ...image,
        resolvedUrl: image.storageKey && image.localFilePath
          ? getMediaResponsePath(image.storageKey)
          : image.sourceUrl
      }))
      .filter((image) => Boolean(image.resolvedUrl));
    const imageUrls = resolvedImages.map((image) => image.resolvedUrl);
    const primaryImage = resolvedImages.find((image) => image.isPrimary) ?? resolvedImages[0];
    const snapshotPayload = row.snapshot_payload_raw ?? undefined;
    const sourceContactPhone = normalizePhone(row.source_contact_phone)
      ?? extractSourceContactPhoneFromPayload(snapshotPayload ?? undefined)
      ?? undefined;
    const detail = mapListingSummary(
      { ...row, snapshot_payload_raw: snapshotPayload },
      undefined,
      rcnBenchmark,
      images.length,
      primaryImage?.resolvedUrl,
      imageUrls,
      undefined
    );
    return {
      ...detail,
      canonicalUrl: row.canonical_url,
      sourceContactPhone,
      sourceLabel: row.source_name ?? undefined,
      description: row.description ?? undefined,
      rooms: row.rooms ? Number(row.rooms) : undefined,
      floor: detail.floor,
      totalFloors: detail.totalFloors,
      yearBuilt: detail.yearBuilt,
      features: extractFeatures({
        description: row.description ?? "",
        addressText: row.address_text ?? undefined,
        snapshotPayload
      }),
      rcnTransactions,
      priceHistory: priceHistoryResult.rows.map((event) => ({
        eventType: event.event_type,
        changedAt: event.changed_at,
        previousPriceAmount: event.previous_price_amount ? Number(event.previous_price_amount) : undefined,
        newPriceAmount: event.new_price_amount ? Number(event.new_price_amount) : undefined
      })),
      viewing: viewing ?? undefined,
      commutes: [],
      amenities: [],
      manual: {
        contactStatus: parseListingContactStatus(row.manual_contact_status),
        decisionStage: parseListingDecisionStage(row.manual_decision_stage),
        contactName: row.manual_contact_name ?? undefined,
        contactPhone: normalizePhone(row.manual_contact_phone) ?? row.manual_contact_phone ?? undefined,
        contactRole: row.manual_contact_role ?? undefined,
        negotiatedPriceAmount: row.manual_negotiated_price_amount ? Number(row.manual_negotiated_price_amount) : undefined,
        askingPriceOverride: row.manual_asking_price_override ? Number(row.manual_asking_price_override) : undefined,
        notes: row.manual_notes ?? undefined,
        sourceNotes: row.manual_source_notes ?? undefined,
        lastContactAt: row.manual_last_contact_at ?? undefined,
        hasLiftOverride: row.manual_has_lift_override ?? undefined,
        hasGarageOverride: row.manual_has_garage_override ?? undefined,
        hasStorageOverride: row.manual_has_storage_override ?? undefined,
        garageCostOverride: row.manual_garage_cost_override ? Number(row.manual_garage_cost_override) : undefined,
        storageCostOverride: row.manual_storage_cost_override ? Number(row.manual_storage_cost_override) : undefined
      },
      contactHistory,
      relatedListings
    };
  });
}

export async function deleteListingRecord(listingId: string) {
  return withDb(async (db) => {
    const client = await db.connect();
    try {
      await client.query("begin");
      await client.query(`delete from listing_duplicate_group_members where listing_id = $1::uuid`, [listingId]);
      await client.query(`delete from listing_duplicate_reviews where listing_id_left = $1::uuid or listing_id_right = $1::uuid`, [listingId]);
      await client.query(`delete from listing_duplicate_groups g where not exists (select 1 from listing_duplicate_group_members gm where gm.group_id = g.id)`);
      const result = await client.query<{ id: string }>(`delete from listings where id = $1::uuid returning id`, [listingId]);
      await client.query("commit");
      return { deleted: Boolean(result.rows[0]?.id), id: result.rows[0]?.id ?? listingId };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function purgeInvalidSourceListing(input: { sourceKey: string; externalId: string; queueItemId: string }) {
  return withDb(async (db) => {
    const listing = await db.query<{ id: string }>(
      `select l.id from listings l join sources s on s.id = l.source_id where s.key = $1 and l.external_id = $2`,
      [input.sourceKey, input.externalId]
    );
    if (listing.rows[0]?.id) await deleteListingRecord(listing.rows[0].id);
    await db.query(`delete from listing_import_queue where id = $1`, [input.queueItemId]);
    return { purged: Boolean(listing.rows[0]?.id), listingId: listing.rows[0]?.id };
  });
}

export async function dismissListingRecord(listingId: string) {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `
        update listings
        set status = 'removed',
            exclusion_reason = 'manual_rejected',
            removed_at = now(),
            updated_at = now()
        where id = $1::uuid
        returning id
      `,
      [listingId]
    );
    return { dismissed: Boolean(result.rows[0]?.id), id: result.rows[0]?.id ?? listingId };
  });
}

export async function archiveListingRecord(listingId: string) {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `
        update listings
        set status = 'removed',
            exclusion_reason = 'source_archived',
            removed_at = coalesce(removed_at, now()),
            updated_at = now()
        where id = $1::uuid
        returning id
      `,
      [listingId]
    );
    return { archived: Boolean(result.rows[0]?.id), id: result.rows[0]?.id ?? listingId };
  });
}

export async function archiveListingsWithArchivedNotice() {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `
        update listings
        set status = 'removed',
            exclusion_reason = 'source_archived',
            removed_at = coalesce(removed_at, now()),
            updated_at = now()
        where status <> 'removed'
          and (
            title ilike '%ogłoszenie archiwalne%'
            or title ilike '%ogloszenie archiwalne%'
            or description ilike '%ogłoszenie archiwalne%'
            or description ilike '%ogloszenie archiwalne%'
          )
        returning id
      `
    );
    return { archived: result.rowCount ?? 0 };
  });
}

export async function getListingInsights(listingId: string, force = false) {
  const row = await withDb(async (db) => {
    const result = await db.query<Pick<ListingRow, "latitude" | "longitude">>(
      `
        select
          l.latitude::text,
          l.longitude::text
        from listings l
        where l.id = $1
        limit 1
      `,
      [listingId]
    );

    return result.rows[0] ?? null;
  });
  if (!row) return null;

  const settings = await getFamilySettings();
  return getNeighborhoodInsights({
    listingId,
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    settings,
    force
  });
}

async function getListingsPageByScope(scope: "region" | "all", filters: ListingFilters): Promise<ListingsPage> {
  return withDb(async (db) => {
    const clauses = [
      "1=1",
      filters.archivedOnly ? "l.status = 'removed' and coalesce(l.exclusion_reason, '') <> 'manual_rejected'" : "l.status = 'active'",
      "l.hidden_duplicate_of_id is null",
      filters.archivedOnly ? "1=1" : filters.hiddenOnly ? "coalesce(l.rooms, 0) = 2" : "coalesce(l.rooms, 0) <> 2",
      filters.archivedOnly ? "coalesce(l.price_amount, 0) > 0" : `(l.price_amount is null or l.price_amount <= ${MAX_VISIBLE_LISTING_PRICE})`,
      filters.archivedOnly ? "coalesce(l.area_sqm, 0) > 0" : `(l.area_sqm is null or l.area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM})`
    ];
    const values: Array<string | number | string[]> = [];
    let paramIndex = 1;

    if (scope === "region" && !filters.includeAllCities) {
      clauses.push(`l.city = any($${paramIndex}::text[])`);
      values.push(activeRegion.supportedCities);
      paramIndex += 1;
    }

    if (filters.city) {
      clauses.push(`l.city = $${paramIndex}`);
      values.push(filters.city);
      paramIndex += 1;
    }

    if (filters.district) {
      if (filters.district === "__none__") clauses.push(`(nullif(trim(coalesce(l.district, '')), '') is null or lower(trim(l.district)) = 'bez dzielnicy')`);
      else { clauses.push(`coalesce(l.district, '') ilike $${paramIndex}`); values.push(`%${filters.district}%`); }
      if (filters.district !== "__none__") paramIndex += 1;
    }

    if (filters.minPrice) {
      clauses.push(`l.price_amount is not null and l.price_amount >= $${paramIndex}`);
      values.push(filters.minPrice);
      paramIndex += 1;
    }

    if (filters.maxPrice) {
      clauses.push(`l.price_amount is not null and l.price_amount <= $${paramIndex}`);
      values.push(filters.maxPrice);
      paramIndex += 1;
    }

    if (filters.minArea) {
      clauses.push(`coalesce(l.area_sqm, 0) >= $${paramIndex}`);
      values.push(filters.minArea);
      paramIndex += 1;
    }

    if (filters.maxArea) {
      clauses.push(`coalesce(l.area_sqm, 0) <= $${paramIndex}`);
      values.push(filters.maxArea);
      paramIndex += 1;
    }

    if (filters.minYearBuilt) {
      clauses.push(`l.year_built is not null and l.year_built >= $${paramIndex}`);
      values.push(filters.minYearBuilt);
      paramIndex += 1;
    }

    if (filters.maxYearBuilt) {
      clauses.push(`l.year_built is not null and l.year_built <= $${paramIndex}`);
      values.push(filters.maxYearBuilt);
      paramIndex += 1;
    }

    if (filters.minPricePerSqm) {
      clauses.push(`coalesce(l.price_per_sqm, 0) >= $${paramIndex}`);
      values.push(filters.minPricePerSqm);
      paramIndex += 1;
    }

    if (filters.maxPricePerSqm) {
      clauses.push(`coalesce(l.price_per_sqm, 0) <= $${paramIndex}`);
      values.push(filters.maxPricePerSqm);
      paramIndex += 1;
    }

    if (filters.roomsMin) {
      clauses.push(`coalesce(l.rooms, 0) >= $${paramIndex}`);
      values.push(filters.roomsMin);
      paramIndex += 1;
    }

    if (filters.roomsMax) {
      clauses.push(`coalesce(l.rooms, 0) <= $${paramIndex}`);
      values.push(filters.roomsMax);
      paramIndex += 1;
    }

    if (filters.search) {
      clauses.push(`(l.title ilike $${paramIndex} or coalesce(l.description, '') ilike $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex += 1;
    }

    if (filters.shortlistedOnly) {
      clauses.push("l.is_shortlisted = true");
    }

    if (filters.priceChangedOnly) {
      clauses.push(`
        exists (
          select 1
          from price_events pe
          where pe.listing_id = l.id
            and pe.event_type in ('price_drop', 'price_increase')
        )
      `);
    }

    const totalResult = await db.query<{ total: string }>(
      `
        select count(*)::text as total
        from listings l
        where ${clauses.join(" and ")}
      `,
      values
    );

    const total = Number(totalResult.rows[0]?.total ?? "0");
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(filters.pageSize ?? 30, 5000));
    const offset = (page - 1) * pageSize;
    const isDreamSort = filters.sort === "dream_desc";
    const orderBy = buildListingOrderBy(isDreamSort ? "newest" : filters.sort);
    const dbLimit = isDreamSort ? Math.max(total, 1) : pageSize;
    const dbOffset = isDreamSort ? 0 : offset;
    const pagedValues = [...values, dbLimit, dbOffset];

    const listingsResult = await db.query<ListingRow>(
      `
        select
          l.id,
          l.canonical_url,
          l.status,
          s.name as source_name,
          l.published_at::text,
          l.first_seen_at::text,
          l.title,
          l.description,
          l.city,
          l.district,
          l.neighborhood,
          l.address_text,
          l.latitude::text,
          l.longitude::text,
          l.source_contact_phone,
          l.price_amount::text,
          l.price_per_sqm::text,
          l.area_sqm::text,
          l.rooms::text,
          l.floor,
          l.total_floors,
          l.year_built,
          l.is_shortlisted,
          lv.id as viewing_id,
          lv.scheduled_at::text as viewing_scheduled_at,
          lv.status as viewing_status,
          lv.notes as viewing_notes,
          lmo.contact_status as manual_contact_status,
          lmo.decision_stage as manual_decision_stage,
          lmo.contact_name as manual_contact_name,
          lmo.contact_phone as manual_contact_phone,
          lmo.contact_role as manual_contact_role,
          lmo.negotiated_price_amount::text as manual_negotiated_price_amount,
          lmo.asking_price_override::text as manual_asking_price_override,
          lmo.notes as manual_notes,
          lmo.source_notes as manual_source_notes,
          lmo.last_contact_at::text as manual_last_contact_at,
          lmo.has_lift_override as manual_has_lift_override,
          lmo.has_garage_override as manual_has_garage_override,
          lmo.has_storage_override as manual_has_storage_override
          ,lmo.garage_cost_override::text as manual_garage_cost_override
          ,lmo.storage_cost_override::text as manual_storage_cost_override
          ,lr.previous_listing_id::text as relisting_previous_listing_id
          ,lr.previous_price_amount::text as relisting_previous_price_amount
          ,lr.relisted_price_amount::text as relisting_relisted_price_amount
        from listings l
        join sources s on s.id = l.source_id
        left join listing_viewings lv on lv.listing_id = l.id
        left join listing_manual_overrides lmo on lmo.listing_id = l.id
        left join listing_relistings lr on lr.current_listing_id = l.id
        where ${clauses.join(" and ")}
        order by ${orderBy}
        limit $${paramIndex}
        offset $${paramIndex + 1}
      `,
      pagedValues
    );

    const listingIds = listingsResult.rows.map((row) => row.id);
    const [priceEventsResult, relatedCounts, imagesByListingId, rcnBenchmarks] = await Promise.all([
      db.query<PriceEventRow>(`
        select distinct on (pe.listing_id)
          pe.listing_id,
          pe.event_type,
          pe.previous_price_amount::text,
          pe.new_price_amount::text,
          pe.changed_at::text
        from price_events pe
        where pe.listing_id = any($1::uuid[])
        order by pe.listing_id, pe.changed_at desc
      `, [listingIds]),
      getRelatedCounts(listingIds),
      getListingImagesForListings(listingIds),
      Promise.all(listingsResult.rows.map((row) => getRcnBenchmark(db, row)))
    ]);

    const latestPriceEvents = new Map(priceEventsResult.rows.map((row) => [row.listing_id, row]));
    let items = listingsResult.rows.map((row, index) => {
        const images = imagesByListingId.get(row.id) ?? [];
        const resolvedImages = images
          .map((image) => ({
            ...image,
            resolvedUrl: image.storageKey && image.localFilePath
              ? getMediaResponsePath(image.storageKey)
              : image.sourceUrl
          }))
          .filter((image) => Boolean(image.resolvedUrl));
        const primaryImage = resolvedImages.find((image) => image.isPrimary) ?? resolvedImages[0];
        const thumbnailUrl = primaryImage?.resolvedUrl;
        const imageUrls = resolvedImages.map((image) => image.resolvedUrl);

        return mapListingSummary(
          row,
          latestPriceEvents.get(row.id),
          rcnBenchmarks[index],
          images.length,
          thumbnailUrl,
          imageUrls,
          undefined,
          relatedCounts.get(row.id) ?? 0,
          0
        );
      });

    if (isDreamSort) {
      const settings = await getFamilySettings();
      items = items
        .map((item) => ({
          ...item,
          dreamScore: computeDreamScore(item, settings.dreamProfile, settings.workplaces)
        }))
        .sort((left, right) => {
          const dreamDelta = (right.dreamScore ?? 0) - (left.dreamScore ?? 0);
          if (dreamDelta !== 0) {
            return dreamDelta;
          }

          return left.id.localeCompare(right.id);
        })
        .slice(offset, offset + pageSize);
    }

    return {
      total,
      items
    };
  });
}

async function getDashboardStats(): Promise<DashboardStat[]> {
  return withDb(async (db) => {
    const [activeListingsResult, weeklyNewListingsResult, priceChangedListingsResult, averageWarsawPricePerSqmResult, weeklyBaselineResult] = await Promise.all([
      db.query<{ count: string }>(
        `
          select count(*)::text as count
          from listings
          where status = 'active'
            and city = any($1::text[])
            and hidden_duplicate_of_id is null
            and coalesce(rooms, 0) <> 2
            and (price_amount is null or price_amount <= ${MAX_VISIBLE_LISTING_PRICE})
            and (area_sqm is null or area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM})
        `,
        [activeRegion.supportedCities]
      ),
      db.query<{ count: string }>(
        `
          select count(*)::text as count
          from listings l
          where l.status = 'active'
            and l.city = any($1::text[])
            and l.hidden_duplicate_of_id is null
            and coalesce(l.rooms, 0) <> 2
            and (l.price_amount is null or l.price_amount <= ${MAX_VISIBLE_LISTING_PRICE})
            and (l.area_sqm is null or l.area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM})
            and l.first_seen_at >= now() - interval '7 days'
        `,
        [activeRegion.supportedCities]
      ),
      db.query<{ count: string }>(
        `
          select count(distinct pe.listing_id)::text as count
          from price_events pe
          join listings l on l.id = pe.listing_id
          where pe.event_type in ('price_drop', 'price_increase')
            and l.status = 'active'
            and l.city = any($1::text[])
            and l.hidden_duplicate_of_id is null
            and coalesce(l.rooms, 0) <> 2
            and (l.price_amount is null or l.price_amount <= ${MAX_VISIBLE_LISTING_PRICE})
            and (l.area_sqm is null or l.area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM})
            and pe.changed_at >= now() - interval '7 days'
        `,
        [activeRegion.supportedCities]
      ),
      db.query<{ average: string | null }>(
        `
          select round(avg(price_amount / nullif(area_sqm, 0)))::text as average
          from listings
          where status = 'active'
            and lower(city) = 'warszawa'
            and hidden_duplicate_of_id is null
            and coalesce(rooms, 0) <> 2
            and price_amount > 0
            and price_amount <= ${MAX_VISIBLE_LISTING_PRICE}
            and area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM}
        `
      ),
      db.query<{ active_count: string; average: string | null; has_history: boolean }>(
        `
          with cutoff as (
            select now() - interval '7 days' as at
          ),
          historical as (
            select
              l.*,
              coalesce(
                (
                  select pe.previous_price_amount
                  from price_events pe, cutoff
                  where pe.listing_id = l.id
                    and pe.changed_at > cutoff.at
                  order by pe.changed_at asc
                  limit 1
                ),
                l.price_amount
              ) as historical_price
            from listings l, cutoff
            where l.first_seen_at <= cutoff.at
              and (l.removed_at is null or l.removed_at > cutoff.at)
              and (l.hidden_at is null or l.hidden_at > cutoff.at)
          )
          select
            count(*) filter (
              where history.city = any($1::text[])
                and coalesce(history.rooms, 0) <> 2
                and (history.historical_price is null or history.historical_price <= ${MAX_VISIBLE_LISTING_PRICE})
                and (history.area_sqm is null or history.area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM})
            )::text as active_count,
            round(avg(history.historical_price / nullif(history.area_sqm, 0)) filter (
              where lower(history.city) = 'warszawa'
                and coalesce(history.rooms, 0) <> 2
                and history.historical_price > 0
                and history.historical_price <= ${MAX_VISIBLE_LISTING_PRICE}
                and history.area_sqm >= ${MIN_VISIBLE_LISTING_AREA_SQM}
            ))::text as average,
            exists (select 1 from historical) as has_history
          from historical history
        `,
        [activeRegion.supportedCities]
      )
    ]);

    const weeklyBaseline = weeklyBaselineResult.rows[0];
    const currentActiveCount = Number(activeListingsResult.rows[0]?.count ?? 0);
    const currentAveragePricePerSqm = Number(averageWarsawPricePerSqmResult.rows[0]?.average ?? 0);
    const activeTrend = weeklyBaseline?.has_history
      ? formatWeeklyDelta(currentActiveCount - Number(weeklyBaseline.active_count ?? 0), "ofert")
      : "historia krótsza niż 7 dni";
    const averageTrend = weeklyBaseline?.has_history && weeklyBaseline.average !== null
      ? formatWeeklyDelta(currentAveragePricePerSqm - Number(weeklyBaseline.average), "zł/m²")
      : "historia krótsza niż 7 dni";

    return [
      {
        label: "Aktywne oferty",
        value: formatInteger(activeListingsResult.rows[0]?.count ?? "0"),
        description: "po normalizacji i deduplikacji w regionie warszawskim, z porównaniem do stanu sprzed 7 dni",
        trend: activeTrend
      },
      {
        label: "Nowe / 7 dni",
        value: formatInteger(weeklyNewListingsResult.rows[0]?.count ?? "0"),
        description: "aktywne, niezdublowane oferty pierwszy raz znalezione w ostatnich 7 dniach"
      },
      {
        label: "Zmiany cen / 7 dni",
        value: formatInteger(priceChangedListingsResult.rows[0]?.count ?? "0"),
        description: "aktywne oferty, których cena zmieniła się w ostatnich 7 dniach"
      },
      {
        label: "Średnia cena / m²",
        value: `${formatInteger(averageWarsawPricePerSqmResult.rows[0]?.average ?? "0")} zł`,
        description: "aktywne, niezdublowane oferty z Warszawy, z porównaniem do stanu sprzed 7 dni",
        trend: averageTrend
      },
    ];
  });
}

async function hydrateListingCoordinatesInPlace(
  db: Parameters<typeof withDb>[0] extends (db: infer T) => Promise<unknown> ? T : never,
  row: ListingRow
) {
  if (row.latitude && row.longitude) {
    return;
  }

  const payloadCoordinates = extractCoordinatesFromPayload(row.snapshot_payload_raw ?? undefined);
  if (payloadCoordinates) {
    const pointDistrict = row.city.toLowerCase() === "warszawa"
      ? await findWarsawDistrictAtPoint(payloadCoordinates.latitude, payloadCoordinates.longitude, db)
      : null;
    await db.query(
      `
        update listings
        set latitude = $2,
            longitude = $3,
            district = case when $4 is not null then $4 else district end,
            updated_at = now()
        where id = $1
      `,
      [row.id, payloadCoordinates.latitude, payloadCoordinates.longitude, pointDistrict]
    );

    row.latitude = String(payloadCoordinates.latitude);
    row.longitude = String(payloadCoordinates.longitude);
    if (pointDistrict) row.district = pointDistrict;
    return;
  }

  const resolvedDistrict = resolveDistrict(row);
  const resolvedNeighborhood = resolveNeighborhood(row);
  const resolvedStreet = resolveStreet(row);
  const resolvedAddressText = resolveAddressText(row, resolvedStreet, resolvedDistrict, resolvedNeighborhood);
  const geocoded = await geocodeListing({
    city: row.city,
    district: resolvedDistrict !== "Bez dzielnicy" ? resolvedDistrict : undefined,
    neighborhood: resolvedNeighborhood,
    street: resolvedStreet,
    addressText: resolvedAddressText
  });

  if (!geocoded) {
    return;
  }

  const pointDistrict = row.city.toLowerCase() === "warszawa"
    ? await findWarsawDistrictAtPoint(geocoded.latitude, geocoded.longitude, db)
    : null;

  await db.query(
    `
      update listings
      set latitude = $2,
          longitude = $3,
          district = case when $4 is not null then $4 else district end,
          updated_at = now()
      where id = $1
    `,
    [row.id, geocoded.latitude, geocoded.longitude, pointDistrict]
  );

  row.latitude = String(geocoded.latitude);
  row.longitude = String(geocoded.longitude);
  if (pointDistrict) row.district = pointDistrict;
}

function extractCoordinatesFromPayload(snapshotPayload?: Record<string, unknown>) {
  if (!snapshotPayload) {
    return null;
  }

  const nextData = getRecordAtPath(snapshotPayload, ["nextData"]);
  const productNode = findProductNode(getRecordAtPath(snapshotPayload, ["jsonLd"]));
  const geoNode = getRecordAtPath(productNode, ["geo"]);
  const latitude = firstNumber(
    readNumber(geoNode, "latitude"),
    readNumber(nextData, "props", "pageProps", "ad", "location", "coordinates", "latitude")
  );
  const longitude = firstNumber(
    readNumber(geoNode, "longitude"),
    readNumber(nextData, "props", "pageProps", "ad", "location", "coordinates", "longitude")
  );

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return { latitude, longitude };
}

function extractSourceContactPhoneFromPayload(snapshotPayload?: Record<string, unknown>) {
  if (!snapshotPayload) {
    return null;
  }

  const nextData = getRecordAtPath(snapshotPayload, ["nextData"]);
  const productNode = findProductNode(getRecordAtPath(snapshotPayload, ["jsonLd"]));
  const html = firstString(
    readString(snapshotPayload, "html"),
    readString(snapshotPayload, "primaryHtml")
  );
  return firstString(
    extractTopContactPhoneFromHtml(html),
    extractSerializedAgentPhoneFromHtml(html),
    normalizePhone(readString(nextData, "props", "pageProps", "ad", "contact", "phone")),
    normalizePhone(readString(nextData, "props", "pageProps", "ad", "contact", "telephone")),
    normalizePhone(readString(nextData, "props", "pageProps", "ad", "advertiser", "phone")),
    normalizePhone(readString(nextData, "props", "pageProps", "ad", "advertiser", "telephone")),
    normalizePhone(readString(productNode, "telephone")),
    normalizePhone(readString(getRecordAtPath(productNode, ["seller"]), "telephone")),
    normalizePhone(readString(getRecordAtPath(getRecordAtPath(productNode, ["offers"]), ["seller"]), "telephone")),
    extractPhoneFromHtml(html)
  );
}

function mapListingSummary(
  row: ListingRow,
  latestEvent: PriceEventRow | undefined,
  rcnBenchmark: RcnBenchmark | null,
  imageCount: number,
  thumbnailUrl?: string,
  imageUrls: string[] = [],
  rankingScore?: number,
  relatedCount = 0,
  potentialDuplicateCount = 0
): ListingSummary {
  const contactStatus = parseListingContactStatus(row.manual_contact_status);
  const decisionStage = parseListingDecisionStage(row.manual_decision_stage);
  const priceAmount = row.price_amount ? Number(row.price_amount) : null;
  const areaSqm = row.area_sqm ? Number(row.area_sqm) : 0;
  const pricePerSqm = row.price_per_sqm ? Number(row.price_per_sqm) : priceAmount && areaSqm > 0 ? priceAmount / areaSqm : null;
  const priceChangePercent = getPriceChangePercent(latestEvent);
  const rcnDeltaLabel = buildRcnDeltaLabel(pricePerSqm, rcnBenchmark);
  const resolvedDistrict = resolveDistrict(row);
  const resolvedNeighborhood = resolveNeighborhood(row);
  const resolvedStreet = resolveStreet(row);
  const resolvedAddressText = resolveAddressText(row, resolvedStreet, resolvedDistrict, resolvedNeighborhood);
  const extractedFeatures = extractFeatures({
    description: row.description ?? "",
    addressText: resolvedAddressText,
    snapshotPayload: row.snapshot_payload_raw ?? undefined
  });
  const commercialInfo = inferCommercialInfo(
    [row.title, row.description].filter(Boolean).join(" "),
    row.snapshot_payload_raw ?? undefined
  );
  const inferredBuildingDetails = inferBuildingDetails(row.description ?? "");
  const manualBadges = buildManualBadges(row);
  if (row.status === "removed") {
    manualBadges.unshift("Archiwalna");
  }
  const manualSummary = buildManualSummary(row);
  const amenities = resolveListingAmenities(extractedFeatures, { lift: row.manual_has_lift_override, garage: row.manual_has_garage_override }, row.description ?? "");
  const hasOutdoorParking = extractedFeatures.some((feature) => feature.key === "outdoor_parking" || feature.key === "estate_parking");
  const detectedStorage = extractedFeatures.some((feature) => feature.key === "storage");
  // A correction made after calling the seller is more reliable than portal text.
  const hasGarage = amenities.garage === true;
  const hasStorage = row.manual_has_storage_override ?? detectedStorage;
  const hasLift = amenities.lift === true;
  const hasBalcony = extractedFeatures.some((feature) => feature.key === "balcony" || feature.key === "terrace" || feature.key === "garden");
  const hasAirConditioning = extractedFeatures.some((feature) => feature.key === "air_conditioning");
  const amenityBadges = buildAmenityBadges(extractedFeatures).filter((badge) => (row.manual_has_lift_override !== true || badge !== "Brak windy") && (row.manual_has_garage_override !== true || badge !== "Brak miejsca postojowego"));
  if (row.manual_has_garage_override === true && !amenityBadges.includes("Garaż")) amenityBadges.push("Garaż");
  if (row.manual_has_lift_override === false && !amenityBadges.includes("Brak windy")) amenityBadges.push("Brak windy");
  const detectedCosts = extractAdditionalPurchaseCosts(row.description ?? "");
  const garageCost = row.manual_garage_cost_override ? Number(row.manual_garage_cost_override) : detectedCosts.garage;
  const storageCost = row.manual_storage_cost_override ? Number(row.manual_storage_cost_override) : detectedCosts.storage;
  const additionalPurchaseCosts = garageCost || storageCost
    ? { garage: garageCost, storage: storageCost, total: (garageCost ?? 0) + (storageCost ?? 0) }
    : undefined;
  const previousRelistingPrice = row.relisting_previous_price_amount ? Number(row.relisting_previous_price_amount) : undefined;
  const relistedPrice = row.relisting_relisted_price_amount ? Number(row.relisting_relisted_price_amount) : undefined;
  const relisting = row.relisting_previous_listing_id
    ? {
        previousListingId: row.relisting_previous_listing_id,
        previousPriceAmount: previousRelistingPrice,
        relistedPriceAmount: relistedPrice,
        priceChange: previousRelistingPrice !== undefined && relistedPrice !== undefined
          ? relistedPrice > previousRelistingPrice ? "higher" as const : relistedPrice < previousRelistingPrice ? "lower" as const : "same" as const
          : "same" as const
      }
    : undefined;

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    canonicalUrl: row.canonical_url,
    sourceLabel: row.source_name ?? undefined,
    isActive: row.status === "active",
    publishedAt: row.published_at ?? undefined,
    firstSeenAt: row.first_seen_at ?? undefined,
    city: row.city,
    district: resolvedDistrict,
    neighborhood: resolvedNeighborhood,
    street: resolvedStreet,
    addressText: resolvedAddressText,
    priceLabel: priceAmount ? formatCurrency(priceAmount) : "Brak ceny",
    areaLabel: `${areaSqm.toFixed(1)} m2`,
    pricePerSqmLabel: pricePerSqm ? `${formatInteger(String(Math.round(pricePerSqm)))} PLN/m2` : undefined,
    roomsCount: row.rooms ? Number(row.rooms) : undefined,
    floor: inferredBuildingDetails.floor ?? row.floor ?? undefined,
    totalFloors: inferredBuildingDetails.totalFloors ?? row.total_floors ?? undefined,
    yearBuilt: inferredBuildingDetails.yearBuilt ?? row.year_built ?? undefined,
    hasGarage,
    hasOutdoorParking,
    hasStorage,
    hasLift,
    hasBalcony,
    hasAirConditioning,
    finishQuality: inferFinishQuality(row.description),
    additionalPurchaseCosts,
    totalAcquisitionPrice: priceAmount && additionalPurchaseCosts ? priceAmount + additionalPurchaseCosts.total : undefined,
    rcnDeltaLabel,
    priceChangePercent,
    relisting,
    summary: buildListingSummary(row, latestEvent, rcnDeltaLabel, imageCount, manualSummary),
    thumbnailUrl,
    imageCount,
    imageUrls,
    badges: buildListingBadges({
      commercialBadges: commercialInfo.badges,
      amenityBadges,
      manualBadges,
      relatedCount,
      potentialDuplicateCount
    }),
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    coordinateAccuracy: inferCoordinateAccuracy(row),
    isShortlisted: row.is_shortlisted,
    contactStatus,
    decisionStage,
    rankingScore,
    relatedCount,
    potentialDuplicateCount,
    viewingScheduledAt: row.viewing_scheduled_at ?? undefined,
    viewingStatus: row.viewing_status ?? undefined
  };
}

function inferFinishQuality(description?: string | null): "ready" | "to_finish" | "unknown" {
  const normalized = normalizePolish(description ?? "");
  if (/(do remontu|do wykonczenia|stan deweloperski|niemal gotow\w* do odbioru|gotow\w* do odbioru)/.test(normalized)) {
    return "to_finish";
  }
  if (/(po remoncie|po generalnym remoncie|nie wymaga (?:remontu|odswiez\w*)|wysoki standard|wykonczon|gotowe do zamieszkania|premium|najwyzszej klasy material\w*|(?:za)?projekt\w* przez (?:renomowan\w* )?architekt)/.test(normalized)) {
    return "ready";
  }
  return "unknown";
}

export function resolveListingAmenities(features: ListingFeature[], manual: { lift?: boolean | null; garage?: boolean | null } = {}, description = "") {
  const has = (key: string) => features.some(feature => feature.key === key);
  const portalGarage = features.some(feature => feature.key === "garage" && feature.source === "payload");
  const noGarage = /\b(?:bez|brak|nie\s+ma|nie\s+posiada)\s+garazu\b/.test(normalizePolish(description));
  return {
    lift: manual.lift ?? (has("no_lift") ? false : has("lift") ? true : undefined),
    garage: manual.garage ?? (portalGarage ? true : noGarage || has("no_garage") ? false : has("garage") || has("garage_price") ? true : undefined)
  };
}

export function inferBuildingDetails(description: string) {
  const text = normalizePolish(description);
  const explicitFraction = text.match(/\bpietr(?:o|ze)?\s*[:,-]?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  const ordinalFloors: Array<[string, number]> = [
    ["pierwsz", 1], ["drug", 2], ["trzec", 3], ["czwart", 4], ["piat", 5],
    ["szost", 6], ["siodm", 7], ["osm", 8], ["dziewiat", 9], ["dziesiat", 10]
  ];
  const groundFloor = /\b(?:na\s+(?:(?:wysokim|niskim)\s+)?parterze|(?:wysoki|niski)\s+parter|pietro\s*[:=-]\s*parter|(?:mieszkanie|lokal)\s+parterow\w*)\b/g;
  const hasGroundFloor = [...text.matchAll(groundFloor)].some(match => {
    const before = text.slice(Math.max(0, match.index! - 70), match.index);
    const clause = before.split(/[.!?;]/).at(-1) ?? "";
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 45);
    if (/^\s+(?:(?:jest|sa|znajduj\w*\s+sie)\s+)?(?:sklep\w*|uslug\w*|recepcj\w*|garaz\w*|komork\w*)\b/.test(after)) return false;
    return !/\b(?:nie|bez|sklep\w*|uslug\w*|recepcj\w*|garaz\w*|komork\w*)\b/.test(clause);
  });
  const floorFromOrdinal = ordinalFloors.find(([stem]) => new RegExp(`\\b${stem}\\w*\\s+pietr(?:ze|o)\\b`).test(text))?.[1];
  const floorFromNumber = text.match(/\b(?:na\s+)?(\d{1,2})(?:\.|-\w+)?\s+pietr(?:ze|o)\b/)?.[1];
  const totalFloorWords: Array<[string, number]> = [
    ["jedno", 1], ["dwu", 2], ["trzy", 3], ["cztero", 4], ["piecio", 5],
    ["szescio", 6], ["siedmio", 7], ["osmio", 8], ["dziewiecio", 9], ["dziesiecio", 10]
  ];
  const totalFromWord = totalFloorWords.find(([prefix]) => new RegExp(`\\b${prefix}pietrow\\w*(?:\\s+(?:blok|budyn)\\w*)?`).test(text))?.[1];
  const totalFromNumber = text.match(/\b(\d{1,2})\s*[- ]?pietrow\w*(?:\s+(?:blok|budyn)\w*)?/)?.[1];
  const yearBuilt = inferConstructionYear(description);

  return {
    floor: explicitFraction ? Number(explicitFraction[1]) : floorFromOrdinal ?? (floorFromNumber ? Number(floorFromNumber) : hasGroundFloor ? 0 : undefined),
    totalFloors: explicitFraction ? Number(explicitFraction[2]) : totalFromWord ?? (totalFromNumber ? Number(totalFromNumber) : undefined),
    yearBuilt
  };
}

function buildListingBadges(input: {
  commercialBadges: string[];
  amenityBadges: string[];
  manualBadges: string[];
  relatedCount: number;
  potentialDuplicateCount: number;
}) {
  const badges = [...input.commercialBadges, ...input.amenityBadges, ...input.manualBadges];

  if (input.relatedCount > 0) {
    badges.push(`Powiązane ${input.relatedCount + 1} portale`);
  } else if (input.potentialDuplicateCount > 0) {
    badges.push(input.potentialDuplicateCount > 1 ? `Potencjalne duplikaty ${input.potentialDuplicateCount}` : "Potencjalny duplikat");
  }

  return badges;
}

export function buildAmenityBadges(features: ListingFeature[]) {
  const byKey = new Map(features.map((feature) => [feature.key, feature]));
  const badges: string[] = [];
  const garage = byKey.get("garage");
  const ownedParking = byKey.get("owned_parking");
  const estateParking = byKey.get("estate_parking");
  const outdoorParking = byKey.get("outdoor_parking");
  const noLift = byKey.get("no_lift");
  const developerStandard = byKey.get("developer_standard");
  if (garage) badges.push(garage.value === "rental" ? "Garaż na wynajem" : garage.value === "platform" ? "Miejsce na platformie" : Number(garage.value) > 1 ? `${garage.value} miejsca w garażu` : "Garaż");
  else if (ownedParking) badges.push(Number(ownedParking.value) > 1 ? `${ownedParking.value} prywatne miejsca postojowe` : "Prywatne miejsce postojowe");
  if (estateParking) badges.push(Number(estateParking.value) > 1 ? `${estateParking.value} miejsca postojowe na osiedlu` : "Miejsce postojowe na terenie osiedla");
  else if (outdoorParking) badges.push(Number(outdoorParking.value) > 1 ? `${outdoorParking.value} naziemne miejsca postojowe` : "Naziemne miejsce postojowe");
  if (!garage && !ownedParking && !estateParking && !outdoorParking) badges.push("Brak miejsca postojowego");
  if (noLift) badges.push("Brak windy");
  if (developerStandard) badges.push("Stan deweloperski");
  return badges;
}

function resolveDistrict(row: ListingRow) {
  const districtFromTitle = inferWarsawDistrictFromLocationTitle(row.title);
  if (districtFromTitle) {
    return districtFromTitle;
  }

  if (row.district && row.district !== "Bez dzielnicy") {
    return row.district;
  }

  const haystack = normalizePolish(
    [row.neighborhood, row.address_text, row.description, row.title].filter(Boolean).join(" ")
  );
  const districtInflections: Array<[RegExp, string]> = [
    [/\b(?:praga|pradze|prage|pragi)\s*(?:polnoc|polnocy|polnocna)\b/i, "Praga-Północ"],
    [/\b(?:praga|pradze|prage|pragi)\s*(?:poludnie|poludniu|poludniowa)\b/i, "Praga-Południe"],
    [/\bmokotow(?:ie|u|em)?\b/i, "Mokotów"],
    [/\bwoli|wole\b/i, "Wola"],
    [/\bzoliborzu|zoliborza\b/i, "Żoliborz"],
    [/\bursynowie|ursynowa\b/i, "Ursynów"],
    [/\bsrodmiesciu|srodmiescia\b/i, "Śródmieście"]
  ];

  const districtAliases: Array<[string, string]> = [
    ["bemowo", "Bemowo"],
    ["bialoleka", "Białołęka"],
    ["bielany", "Bielany"],
    ["mokotow", "Mokotów"],
    ["ochota", "Ochota"],
    ["praga polnoc", "Praga-Północ"],
    ["praga poludnie", "Praga-Południe"],
    ["srodmiescie", "Śródmieście"],
    ["targowek", "Targówek"],
    ["ursus", "Ursus"],
    ["ursynow", "Ursynów"],
    ["wawer", "Wawer"],
    ["wesola", "Wesoła"],
    ["wilanow", "Wilanów"],
    ["wlochy", "Włochy"],
    ["wola", "Wola"],
    ["zoliborz", "Żoliborz"]
  ];

  for (const [needle, district] of districtAliases) {
    if (haystack.includes(needle)) {
      return district;
    }
  }

  for (const [pattern, district] of districtInflections) {
    if (pattern.test(haystack)) return district;
  }

  const neighborhoodToDistrict: Array<[string, string]> = [
    ["stara praga", "Praga-Północ"],
    ["nowa praga", "Praga-Północ"],
    ["szmulowizna", "Praga-Północ"],
    ["szmulowiźnie", "Praga-Północ"],
    ["pelcowizna", "Praga-Północ"],
    ["pelcowiźnie", "Praga-Północ"],
    ["goclaw", "Praga-Południe"],
    ["grochow", "Praga-Południe"],
    ["saska kepa", "Praga-Południe"],
    ["saskiej kepie", "Praga-Południe"],
    ["grochowie", "Praga-Południe"],
    ["kamionek", "Praga-Południe"],
    ["kamionku", "Praga-Południe"],
    ["kamionka", "Praga-Południe"],
    ["goclawiu", "Praga-Południe"],
    ["grochowie", "Praga-Południe"],
    ["saskiej kepie", "Praga-Południe"],
    ["sluzewiec", "Mokotów"],
    ["sluzew", "Mokotów"],
    ["sadyba", "Mokotów"],
    ["stegny", "Mokotów"],
    ["stary mokotow", "Mokotów"],
    ["wierzbno", "Mokotów"],
    ["wierzbnie", "Mokotów"],
    ["wygledow", "Mokotów"],
    ["siekierki", "Mokotów"],
    ["siekierkach", "Mokotów"],
    ["okecie", "Włochy"],
    ["chrzanow", "Bemowo"],
    ["chrzanowie", "Bemowo"],
    ["jelonki", "Bemowo"],
    ["jelonkach", "Bemowo"],
    ["gorce", "Bemowo"],
    ["gorczach", "Bemowo"],
    ["skorosze", "Ursus"],
    ["skoroszach", "Ursus"],
    ["niedzwiadek", "Ursus"],
    ["stara milosna", "Wesoła"],
    ["miasteczko wilanow", "Wilanów"],
    ["miasteczku wilanow", "Wilanów"],
    ["powsin", "Wilanów"],
    ["powsinie", "Wilanów"],
    ["zawady", "Wilanów"],
    ["kabaty", "Ursynów"],
    ["natolin", "Ursynów"],
    ["natolinie", "Ursynów"],
    ["kabat", "Ursynów"],
    ["starym mokotowie", "Mokotów"],
    ["sluzewcu", "Mokotów"],
    ["powislu", "Śródmieście"],
    ["muranowie", "Śródmieście"],
    ["odolnach", "Wola"],
    ["imielin", "Ursynów"],
    ["imielinie", "Ursynów"],
    ["stoklosy", "Ursynów"],
    ["stoklosach", "Ursynów"],
    ["sady zoliborskie", "Żoliborz"],
    ["marymont", "Żoliborz"],
    ["marymoncie", "Żoliborz"],
    ["stare bielany", "Bielany"],
    ["starych bielanach", "Bielany"],
    ["mlociny", "Bielany"],
    ["mlocinach", "Bielany"],
    ["powisle", "Śródmieście"],
    ["muranow", "Śródmieście"],
    ["stare miasto", "Śródmieście"],
    ["mirow", "Wola"],
    ["mirowie", "Wola"],
    ["ulrychow", "Wola"],
    ["ulrychowie", "Wola"],
    ["odolany", "Wola"],
    ["odolanach", "Wola"],
    ["czyste", "Wola"]
  ];

  for (const [needle, district] of neighborhoodToDistrict) {
    if (haystack.includes(needle)) {
      return district;
    }
  }

  const streetToDistrict: Array<[RegExp, string]> = [
    [/\bpanienska\b/i, "Praga-Północ"],
    [/\btowarowa\b/i, "Wola"],
    [/\bpostepu\b/i, "Mokotów"]
  ];

  for (const [pattern, district] of streetToDistrict) {
    if (pattern.test(haystack)) {
      return district;
    }
  }

  return "Bez dzielnicy";
}

function resolveNeighborhood(row: ListingRow) {
  const cleaned = cleanLocationText(row.neighborhood);
  const district = resolveDistrict(row);
  if (row.city.toLowerCase() !== "warszawa") return !cleaned || cleaned === district ? undefined : cleaned;

  const neighborhood = canonicalWarsawNeighborhood(cleaned, district)
    ?? inferWarsawNeighborhood([row.title, row.description, row.address_text].filter(Boolean).join(" "), district);
  return neighborhood && normalizePolish(neighborhood) !== normalizePolish(district) ? neighborhood : undefined;
}

function resolveStreet(row: ListingRow) {
  const district = resolveDistrict(row);
  const neighborhood = resolveNeighborhood(row);
  if (row.city.toLowerCase() === "warszawa") {
    const canonicalAddress = normalizeWarsawStreetAddress(row.address_text);
    if (canonicalAddress && !isWarsawNeighborhoodLabel(canonicalAddress, district) && !sameStreetOrLocation(canonicalAddress, neighborhood)) return canonicalAddress;
  }
  const fromAddress = cleanLocationText(extractStreet(row.address_text ?? undefined, row.description ?? undefined));
  if (fromAddress) {
    if (row.city.toLowerCase() !== "warszawa") return fromAddress;
    const normalizedStreet = normalizeWarsawStreetCandidate(fromAddress);
    if (normalizedStreet && !isWarsawNeighborhoodLabel(normalizedStreet, district) && !sameStreetOrLocation(normalizedStreet, neighborhood)) return normalizedStreet;
  }

  const fallback = extractStreetFromLocationTitle(row.title, district, row.city) ?? extractStreetFromUrl(row.canonical_url, district);
  return isWarsawNeighborhoodLabel(fallback, district) || sameStreetOrLocation(fallback, neighborhood) ? undefined : fallback;
}

function resolveAddressText(
  row: ListingRow,
  street?: string,
  district?: string,
  neighborhood?: string
) {
  if (row.city.toLowerCase() === "warszawa") {
    const canonicalAddress = normalizeWarsawStreetAddress(row.address_text);
    if (canonicalAddress && !sameStreetOrLocation(canonicalAddress, neighborhood)) return compactAddressText(canonicalAddress, row.city);
  }
  const existingAddress = cleanAddressText(row.address_text);
  if (existingAddress && (!street || normalizePolish(existingAddress).includes(normalizePolish(street)))) {
    return existingAddress;
  }

  if (existingAddress && street) {
    return compactAddressText(street, existingAddress, normalizePolish(existingAddress).includes(normalizePolish(row.city)) ? undefined : row.city);
  }

  return compactAddressText(
    street,
    neighborhood && neighborhood !== district ? neighborhood : district && district !== "Bez dzielnicy" ? district : undefined,
    row.city
  );
}

function cleanAddressText(value?: string | null) {
  if (!value || isGenericLocationLabel(value)) {
    return undefined;
  }

  const cleanedParts = value
    .split(",")
    .map((part) => cleanLocationText(part))
    .filter((part): part is string => Boolean(part));

  return cleanedParts.length > 0 ? cleanedParts.join(", ") : undefined;
}

function cleanLocationText(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || isGenericLocationLabel(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function isGenericLocationLabel(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalized = normalizePolish(value);
  return [
    "mieszkania na sprzedaz",
    "mieszkanie na sprzedaz",
    "nieruchomosci",
    "ogloszenia",
    "gratka pl",
    "sprzedaz",
    "mieszkania"
  ].some((generic) => normalized === generic || normalized.includes(generic));
}

function extractStreetFromUrl(url: string, district: string) {
  const match = url.match(/\/nieruchomosci\/([^/?#]+)\/ob\//i);
  const slug = match?.[1];
  if (!slug) {
    return undefined;
  }

  const ignored = new Set([
    "mieszkanie",
    "mieszkania",
    "warszawa",
    ...normalizePolish(district).split(" ")
  ]);
  const words = slug
    .split("-")
    .filter((word) => word && !ignored.has(word));

  if (words.length === 0) {
    return undefined;
  }

  return titleCasePolish(words.join(" "));
}

function compactAddressText(...parts: Array<string | null | undefined>) {
  const filtered = parts.map((part) => cleanLocationText(part)).filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(", ") : undefined;
}

function titleCasePolish(value: string) {
  return value
    .split(" ")
    .map((word) => word ? `${word[0].toLocaleUpperCase("pl-PL")}${word.slice(1)}` : word)
    .join(" ");
}

function inferCoordinateAccuracy(row: ListingRow): "exact" | "approximate" | undefined {
  if (!row.latitude || !row.longitude) {
    return undefined;
  }

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return isKnownApproximateWarsawPoint(latitude, longitude) ? "approximate" : "exact";
}

function isKnownApproximateWarsawPoint(latitude: number, longitude: number) {
  const points = [
    [52.1719, 20.9989],
    [52.1749, 20.9993],
    [52.2382, 20.9134],
    [52.3202, 21.0106],
    [52.2921, 20.9347],
    [52.1937, 21.0340],
    [52.2122, 20.9727],
    [52.2601, 21.0292],
    [52.2380, 21.0838],
    [52.2319, 21.0067],
    [52.2751, 21.0587],
    [52.1952, 20.8842],
    [52.1410, 21.0323],
    [52.2084, 21.1604],
    [52.2540, 21.2241],
    [52.1637, 21.0876],
    [52.1862, 20.9489],
    [52.2326, 20.9521],
    [52.2680, 20.9864]
  ];

  return points.some(([pointLatitude, pointLongitude]) =>
    Math.abs(latitude - pointLatitude) < 0.00001 && Math.abs(longitude - pointLongitude) < 0.00001
  );
}

function buildListingSummary(
  row: ListingRow,
  latestEvent: PriceEventRow | undefined,
  rcnDelta: string,
  imageCount: number,
  manualSummary?: string
) {
  const imageFragment = imageCount > 0 ? ` Zapisane zdjecia: ${imageCount}.` : " Zdjecia jeszcze niezsynchronizowane.";
  const manualFragment = manualSummary ? ` ${manualSummary}.` : "";

  if (row.status === "removed") {
    return `Oferta archiwalna. Link zrodlowy przestal byc dostepny albo portal oznaczyl ogloszenie jako nieaktualne.${imageFragment}${manualFragment}`;
  }

  if (!latestEvent) {
    return `Nowa oferta ${row.rooms ?? "?"} pokojowa. Brak jeszcze historii zmian, porownanie: ${rcnDelta}.${imageFragment}${manualFragment}`;
  }

  if (latestEvent.event_type === "price_drop") {
    return `Wykryto spadek ceny. Ostatnia zmiana oferty zostala zapisana w historii, porownanie: ${rcnDelta}.${imageFragment}${manualFragment}`;
  }

  if (latestEvent.event_type === "price_increase") {
    return `Cena wzrosla wzgledem poprzedniego snapshotu. Sprawdz relacje do transakcji: ${rcnDelta}.${imageFragment}${manualFragment}`;
  }

  return `Oferta aktywna i monitorowana. Ostatni znany status: ${latestEvent.event_type}.${imageFragment}${manualFragment}`;
}

function buildManualBadges(row: ListingRow) {
  const badges: string[] = [];
  const contactStatus = parseListingContactStatus(row.manual_contact_status);
  const decisionStage = parseListingDecisionStage(row.manual_decision_stage);
  const askingOverride = row.manual_asking_price_override ? Number(row.manual_asking_price_override) : undefined;
  const negotiated = row.manual_negotiated_price_amount ? Number(row.manual_negotiated_price_amount) : undefined;

  if (decisionStage) {
    badges.push(decisionStageLabel(decisionStage));
  }

  if (contactStatus) {
    badges.push(contactStatusLabel(contactStatus));
  }

  if (askingOverride) {
    badges.push(`Po rozmowie ${formatCurrency(askingOverride)}`);
  }

  if (negotiated) {
    badges.push(`Do utargu ${formatCurrency(negotiated)}`);
  }

  return badges;
}

function buildManualSummary(row: ListingRow) {
  const parts: string[] = [];
  const decisionStage = parseListingDecisionStage(row.manual_decision_stage);
  const contactStatus = parseListingContactStatus(row.manual_contact_status);
  const contactName = row.manual_contact_name ?? undefined;
  const negotiated = row.manual_negotiated_price_amount ? Number(row.manual_negotiated_price_amount) : undefined;

  if (decisionStage) {
    parts.push(`etap: ${decisionStageLabel(decisionStage)}`);
  }

  if (contactStatus) {
    parts.push(contactStatusLabel(contactStatus));
  }

  if (contactName) {
    parts.push(`kontakt: ${contactName}`);
  }

  if (negotiated) {
    parts.push(`cel negocjacji ${formatCurrency(negotiated)}`);
  }

  return parts.join(", ");
}

function contactStatusLabel(status: ListingContactStatus) {
  return (
    {
      new: "Nowa",
      contacted: "Po kontakcie",
      negotiating: "W negocjacji",
      viewing_scheduled: "Ogladanie umowione",
      rejected: "Odrzucone",
      closed: "Zamkniete"
    } satisfies Record<ListingContactStatus, string>
  )[status];
}

function decisionStageLabel(stage: ListingDecisionStage) {
  return (
    {
      new: "Nowa oferta",
      to_call: "Do telefonu",
      after_call: "Po rozmowie",
      to_viewing: "Do oglądania",
      after_viewing: "Po oglądaniu",
      to_offer: "Do oferty",
      rejected: "Odrzucona",
      bought: "Kupiona"
    } satisfies Record<ListingDecisionStage, string>
  )[stage];
}

export function extractFeatures(input: {
  description: string;
  addressText?: string;
  snapshotPayload?: Record<string, unknown>;
}): ListingFeature[] {
  const features: ListingFeature[] = [];
  const descriptionNormalized = normalizePolish(input.description);
  // Structured portal details are authoritative; use the description only when
  // the portal did not provide an explicit lift value.
  const explicitlyWithoutLift = /\b(?:bez|brak|nie\s+ma|nie\s+posiada)\s+(?:windy|windzie|dzwigu)\b/.test(descriptionNormalized);
  const payloadFeatures = extractFeaturesFromPayload(input.snapshotPayload);
  const structuredWithoutLift = payloadFeatures.some((feature) => feature.key === "no_lift");
  const structuredWithLift = payloadFeatures.some((feature) => feature.key === "lift");
  const garagePrice = extractCurrencyNearKeywords(input.description, ["garaz", "garaż"]);
  const parkingPrice = extractCurrencyNearKeywords(input.description, ["miejsce parkingowe", "miejsce postojowe", "parking"]);
  const maintenanceFee = extractCurrencyNearKeywords(input.description, ["czynsz", "oplata", "opłata"]);
  const street = extractStreet(input.addressText, input.description);
  const amenities = inferAmenities(input.description);
  const developerStandardMatches = [...descriptionNormalized.matchAll(/\b(?:stan(?:ie|u|em)?\s+dewelopersk\w*|dewelopersk\w*\s+stan\w*|surowy\s+dewelop\w*|bezposrednio\s+od\s+deweloper\w*|(?:lokal|mieszkanie|apartament)\s+(?:jest\s+)?gotow\w*\s+do\s+wykonczenia)\b/g)];
  const hasDeveloperStandard = developerStandardMatches.some((match) => {
    const index = match.index ?? 0;
    const before = descriptionNormalized.slice(Math.max(0, index - 32), index);
    const context = descriptionNormalized.slice(Math.max(0, index - 100), index + 700);
    const describesPastDeveloperStage = /doprowadz\w*\s+do\s+stanu?\s+dewelopersk\w*/.test(context)
      && /(?:kompleksowo\s+(?:wy)?remont\w*|mozna\s+zamieszkac\s+od\s+razu|gotow\w*\s+do\s+(?:zamieszkania|wprowadzenia))/.test(context);
    if (describesPastDeveloperStage) return false;
    return !/\b(?:nie\s+jest|nie\s+bedzie|nie)\s+(?:w\s+)?$/.test(before);
  });

  if (street) {
    features.push({ key: "street", label: "Ulica", value: street, source: "derived" });
  }

  if (garagePrice) {
    features.push({ key: "garage_price", label: "Cena garazu", value: garagePrice, source: "description" });
  }

  if (parkingPrice) {
    features.push({ key: "parking_price", label: "Cena miejsca parkingowego", value: parkingPrice, source: "description" });
  }

  if (maintenanceFee) {
    features.push({ key: "fees", label: "Czynsz / oplaty", value: maintenanceFee, source: "description" });
  }

  if (amenities.garage) {
    features.push({ key: "garage", label: "Garaż", value: String(amenities.garageCount ?? amenities.garage), source: "description" });
  } else if (amenities.ownedParkingCount) {
    features.push({ key: "owned_parking", label: "Prywatne miejsce postojowe", value: String(amenities.ownedParkingCount), source: "description" });
  }

  if (amenities.estateParking) {
    features.push({ key: "estate_parking", label: "Miejsce postojowe na terenie osiedla", value: String(amenities.parkingCount ?? "tak"), source: "description" });
  } else if (amenities.outdoorParking) {
    features.push({ key: "outdoor_parking", label: "Naziemne miejsce postojowe", value: String(amenities.parkingCount ?? "tak"), source: "description" });
  }

  if (amenities.storage) {
    features.push({
      key: "storage",
      label: amenities.storage === "basement" ? "Piwnica" : "Komórka lokatorska",
      value: amenities.storage,
      source: "description"
    });
  }

  if (/\b(?:ogrzewan\w*\s+pod(?:l|ł)ogow\w*|pod(?:l|ł)ogow\w*\s+ogrzewan\w*)\b/.test(descriptionNormalized)) {
    features.push({ key: "underfloor_heating", label: "Ogrzewanie podłogowe", value: "tak", source: "description" });
  }

  if (/\b(?:(?:(?:za)?projekt\w*|zaaranz\w*|urzadz\w*)\s+przez\s+(?:renomowan\w*\s+)?architekt\w*|architekt\w*\s+(?:zaprojektow\w*|projektow\w*|zaaranz\w*))\b/.test(descriptionNormalized)) {
    features.push({ key: "architect_designed", label: "Projekt architekta", value: "tak", source: "description" });
  }

  if (amenities.balcony) features.push({ key: "balcony", label: "Balkon / loggia", value: String(amenities.balconyCount ?? "tak"), source: "description" });
  if (amenities.terrace) features.push({ key: "terrace", label: "Taras", value: "tak", source: "description" });
  if (amenities.garden) features.push({ key: "garden", label: "Ogródek", value: "tak", source: "description" });
  if (amenities.woodenFloor) features.push({ key: "wooden_floor", label: "Drewniane podłogi", value: "tak", source: "description" });
  if (amenities.airConditioning) features.push({ key: "air_conditioning", label: "Klimatyzacja", value: "tak", source: "description" });
  if (hasDeveloperStandard) features.push({ key: "developer_standard", label: "Stan deweloperski", value: "tak", source: "description" });

  if (!structuredWithoutLift && /\b(?:winda|windy|windzie|windą|windami|dzwig|dźwig)\b/i.test(input.description)) {
    features.push({ key: "lift", label: "Winda", value: "tak", source: "description" });
  }
  if (explicitlyWithoutLift && !structuredWithLift) {
    features.push({ key: "no_lift", label: "Brak windy", value: "tak", source: "description" });
  }

  const withoutLift = structuredWithoutLift || (explicitlyWithoutLift && !structuredWithLift);
  return dedupeFeatures(
    [...payloadFeatures, ...features].filter((feature) => withoutLift ? feature.key !== "lift" : structuredWithLift ? feature.key !== "no_lift" : true)
  );
}

function inferAmenities(description: string) {
  const text = normalizePolish(description);
  const garagePattern = /\b(?:gara(?:z|ż)\w*|miejsc(?:e|a|u|em|ach|ami)\s+(?:postojow\w*|parkingow\w*|gara(?:z|ż)ow\w*)|miejsc(?:e|a|u|em|ach|ami)\s+w\s+parking\w*\s+podziemn\w*|stanowisk(?:o|a|u|iem|ach|ami)\s+(?:postojow\w*|parkingow\w*|gara(?:z|ż)ow\w*))\b/g;
  const storagePattern = /\b(?:piwnic(?:a|y|e|ę|ą|ach|ami)?|komork(?:a|i|ę|ą|ach|ami)?(?:\s+lokatorsk(?:a|iej|ą|e|ich)?)?|schowek|box\s+lokatorski)\b/g;
  const estateParkingPattern = /\b(?:\d+\s+)?miejsc(?:e|a|u|em|ach|ami)\s+(?:postojow\w*|parkingow\w*)\s+(?:dla\s+mieszkanc\w*\s+)?(?:na|w)\s+terenie\s+(?:osiedl\w*|posesj\w*)/g;
  const outdoorParkingPattern = /\b(?:(?:(?:\d+|jedn\w*|dw\w*|trzy|cztery)\s+)?(?:naziemn\w*|zewnetrzn\w*)\s+miejsc(?:e|a|u|em|ach|ami)\s+(?:postojow\w*|parkingow\w*)|(?:(?:\d+|jedn\w*|dw\w*|trzy|cztery)\s+)?miejsc(?:e|a|u|em|ach|ami)\s+(?:postojow\w*|parkingow\w*)\s+(?:naziemn\w*|zewnetrzn\w*|przed\s+budynk\w*|na\s+posesj\w*|na\s+podwork\w*))/g;
  const ownedParkingPattern = /\bprzynalez\w*[^.!?;]{0,90}?(?:\d+|jedn\w*|dw\w*|trzy|cztery)\s+prywatn\w*\s+miejsc(?:e|a|u|em|ach|ami)\s+(?:postojow\w*|parkingow\w*)/g;
  const balconyPattern = /\b(?:balkon\w*|loggi\w*)\b/g;
  const terracePattern = /\btaras\w*\b/g;
  const gardenPattern = /\b(?:ogrod(?:ek|ka|kiem|ku|ki|kow|kach)|ogrodek|ogrodkiem|ogrodku|zielon\w*\s+taras\w*)\b/g;
  const woodenFloorPattern = /\b(?:drewnian\w*\s+(?:pod(?:l|ł)og\w*|parkiet\w*)|pod(?:l|ł)og\w*[^.!?;]{0,70}?(?:(?:egzotyczn\w*\s+)?drewn\w*|dab\w*\s+wedzon\w*)|egzotyczn\w*\s+drewn\w*(?:\s+merbau\w*)?|debow\w*\s+desk\w*|parkiet\w*|des(?:ka|ki|ce|ek)\s+pod(?:l|ł)ogow\w*)\b/g;
  const airConditioningPattern = /\b(?:klimatyzacj\w*|klimatyzowan\w*)\b/g;
  const isGuestOnly = (match: RegExpMatchArray) => /\bdla\s+gosci\b/.test(text.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 45).split(/[.!?;]/)[0]);
  const garageMatches = [...text.matchAll(garagePattern)].filter(match => !isGuestOnly(match));
  const storageMatches = [...text.matchAll(storagePattern)];
  const estateParkingMatches = [...text.matchAll(estateParkingPattern)].filter(match => !isGuestOnly(match));
  const outdoorParkingMatches = [...text.matchAll(outdoorParkingPattern)].filter(match => !isGuestOnly(match));
  const ownedParkingMatches = [...text.matchAll(ownedParkingPattern)];
  const balconyMatches = [...text.matchAll(balconyPattern)];
  const terraceMatches = [...text.matchAll(terracePattern)];
  const gardenMatches = [...text.matchAll(gardenPattern)];
  const woodenFloorMatches = [...text.matchAll(woodenFloorPattern)];
  const airConditioningMatches = [...text.matchAll(airConditioningPattern)];
  const hasPositiveGarage = garageMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0));
  const hasStorage = storageMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0));
  const hasEstateParking = estateParkingMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0));
  const hasOutdoorParking = outdoorParkingMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0));
  const ownedParkingCount = inferMentionCount(text, ownedParkingMatches);
  const parkingCount = inferMentionCount(text, [...estateParkingMatches, ...outdoorParkingMatches, ...garageMatches]);
  const balconyCount = inferMentionCount(text, balconyMatches);
  const storage = hasStorage
    ? storageMatches.some((match) => match[0].startsWith("piwnic") && !isNegatedAmenity(text, match.index ?? 0)) ? "basement" : "storage_unit"
    : undefined;
  const commonAmenities = {
    estateParking: hasEstateParking,
    storage,
    balcony: balconyMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0)),
    terrace: terraceMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0)),
    garden: gardenMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0)),
    woodenFloor: woodenFloorMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0)),
    airConditioning: airConditioningMatches.some((match) => !isNegatedAmenity(text, match.index ?? 0) && !isOnlyAirConditioningOption(text, match.index ?? 0)),
    ownedParkingCount,
    parkingCount,
    balconyCount
  };
  const explicitOutdoorParking = [...text.matchAll(/\bparking\w*\s+(?:za\s+szlaban\w*|(?:pod|przed|przy)\s+(?:blok\w*|budynk\w*|dom\w*)|zewnetrzn\w*|naziemn\w*)/g)].some(match => !isNegatedAmenity(text, match.index ?? 0) && !isGuestOnly(match));
  if (!hasPositiveGarage && !ownedParkingCount) return { garage: undefined, outdoorParking: hasOutdoorParking || explicitOutdoorParking ? "yes" : undefined, ...commonAmenities };

  const garageIsRental = garageMatches.some((match) => {
    const context = text.slice(Math.max(0, (match.index ?? 0) - 48), (match.index ?? 0) + match[0].length + 72);
    return /(?:na\s+wynajem|do\s+wynajecia|wynajem|mozliwosc\s+wynaj)/.test(context);
  });
  const isPlatform = /(?:platform(?:a|ie|y)|miejsce\s+zalezne|parking\s+zalezny)/.test(text);
  const hasActualGarage = garageMatches.some(match => !isNegatedAmenity(text, match.index ?? 0) && /(?:garaz|podziemn)/.test(match[0] + text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 45).split(/[.!?;]/)[0])) || isPlatform;
  return {
    garage: hasActualGarage ? (garageIsRental ? "rental" : isPlatform ? "platform" : "yes") : undefined,
    garageCount: hasActualGarage ? ownedParkingCount : undefined,
    outdoorParking: !isPlatform && (explicitOutdoorParking || hasOutdoorParking || !hasActualGarage) ? "yes" : undefined,
    ...commonAmenities
  };
}

function isOnlyAirConditioningOption(text: string, index: number) {
  const context = text.slice(Math.max(0, index - 90), index + 90);
  return /(?:opcj\w*|mozliwosc)\s+(?:wykonania\s+|instalacji\s+|zamontowania\s+|montazu\s+)?klimatyzacj\w*/.test(context)
    || /klimatyzacj\w*[^.!?;]{0,55}(?:do\s+montazu|mozna\s+zamontowac|opcjonaln\w*)/.test(context);
}

function inferMentionCount(text: string, matches: RegExpMatchArray[]) {
  const words: Record<string, number> = { jeden: 1, jedno: 1, jedna: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5 };
  let best: number | undefined;
  for (const match of matches) {
    const index = match.index ?? 0;
    const withPrefix = text.slice(Math.max(0, index - 16), index + match[0].length);
    const countMatch = withPrefix.match(/(?:^|\s)(\d+|jeden|jedno|jedna|dwa|dwie|trzy|cztery|piec)\s+(?:(?:naziemn|prywatn)\w*\s+)?(?:miejsc\w*|balkon\w*)/);
    const count = countMatch?.[1] ? Number(countMatch[1]) || words[countMatch[1]] : undefined;
    if (count && (!best || count > best)) best = count;
  }
  return best;
}

function extractAdditionalPurchaseCosts(description: string) {
  const text = normalizePolish(description);
  const extract = (keywords: string[]) => {
    for (const keyword of keywords) {
      const number = `(\\d{1,3}(?:[\\s.]\\d{3})+|\\d{1,6})(?:,(\\d{1,2}))?\\s*(tys(?:iecy|iÄ™cy)?|pln|zl|zĹ‚)`;
      const afterLabel = new RegExp(`${escapeRegExp(keyword)}[\\s\\S]{0,180}?(?:dodatkowo\\s+platn\\w*|za\\s+dodatkow\\w*\\s+oplata)\\s*[:,-]?\\s*${number}`, "i");
      // Some portals phrase this as "55 000 PLN (obligatoryjny zakup)".
      // The price comes before the qualifier, so accept it only when that
      // qualifier appears in the same short offer fragment.
      const obligatory = new RegExp(`${escapeRegExp(keyword)}[\\s\\S]{0,120}?[:,-]?\\s*${number}[\\s\\S]{0,100}?obligatoryjn\\w*\\s+(?:zakup|nabyci\\w*)`, "i");
      const match = text.match(afterLabel) ?? text.match(obligatory);
      if (!match?.[1]) continue;
      const numeric = Number(`${match[1].replace(/[\\s.]/g, "")}.${match[2] ?? "0"}`);
      if (Number.isFinite(numeric)) return /tys/i.test(match[3] ?? "") ? numeric * 1000 : numeric;
    }
    return undefined;
  };

  return {
    garage: extract(["garaz", "garaż", "miejsce postojowe", "miejsce w garazu", "miejsce w garażu"]),
    storage: extract(["komorka lokatorska", "komórka lokatorska", "box lokatorski"])
  };
}

function isNegatedAmenity(text: string, index: number) {
  const obligationContext = text.slice(Math.max(0, index - 150), index);
  if (/(?:zakup\s+obligatoryjn\w*|obowiazkow\w*\s+zakup|nie\s+ma\s+mozliwosci\s+zakupu[^.]{0,90}\s+bez)\s*$/.test(obligationContext)) {
    return false;
  }
  const before = text.slice(Math.max(0, index - 42), index);
  return /\b(?:bez|brak|nie\s+(?:ma|posiada|obejmuje|przysluguje)|nieposiada|nie\s+posiada)\s*$/.test(before)
    || /\b(?:bez|brak|nie\s+posiada|nieposiada)\b[^.]{0,28}$/.test(before);
}

function extractFeaturesFromPayload(payload?: Record<string, unknown>): ListingFeature[] {
  if (!payload) {
    return [];
  }

  const nextData = getRecordAtPath(payload, ["nextData"]);
  const jsonLd = getRecordAtPath(payload, ["jsonLd"]);
  const ad = getRecordAtPath(nextData, ["props", "pageProps", "ad"]);
  const product = findProductNode(jsonLd);
  const portalFeatures = getRecordAtPath(payload, ["portalFeatures"]);
  const additional = getArrayAtPath(product, ["additionalProperty"]) ?? [];
  const features: ListingFeature[] = [];
  const portalMaintenanceFee = readString(portalFeatures, "fees");
  if (portalMaintenanceFee) {
    features.push({ key: "fees", label: "Czynsz", value: portalMaintenanceFee, source: "payload" });
  }
  const portalLift = normalizePolish(readString(portalFeatures, "lift") ?? "");
  if (/^(?:tak|yes|true|1)$/.test(portalLift)) {
    features.push({ key: "lift", label: "Winda", value: "tak", source: "payload" });
  } else if (/^(?:nie|no|false|0)$/.test(portalLift)) {
    features.push({ key: "no_lift", label: "Brak windy", value: "tak", source: "payload" });
  }

  const extras = getArrayAtPath(ad, ["attributes", "extras_types"]) ?? [];
  if (extras.some((item) => item === "lift")) {
    features.push({ key: "lift", label: "Winda", value: "tak", source: "payload" });
  }
  if (extras.some((item) => item === "garage")) {
    features.push({ key: "garage", label: "Garaz", value: "tak", source: "payload" });
  }
  if (extras.some((item) => item === "balcony")) {
    features.push({ key: "balcony", label: "Balkon", value: "tak", source: "payload" });
  }

  for (const item of additional) {
    const record = getRecord(item);
    if (!record) {
      continue;
    }

    const name = readString(record, "name");
    const value = readString(record, "value");
    if (!name || !value) {
      continue;
    }

    const normalized = normalizePolish(name);
    const normalizedValue = normalizePolish(value);
    if (normalized === "winda" && /^(?:tak|yes|true|1)$/.test(normalizedValue)) {
      features.push({ key: "lift", label: "Winda", value: "tak", source: "payload" });
    } else if (normalized === "winda" && /^(?:nie|no|false|0)$/.test(normalizedValue)) {
      features.push({ key: "no_lift", label: "Brak windy", value: "tak", source: "payload" });
    } else if (normalized.includes("czynsz")) {
      features.push({ key: "fees", label: "Czynsz", value, source: "payload" });
    } else if (normalized.includes("pietro")) {
      features.push({ key: "floor", label: "Pietro", value, source: "payload" });
    } else if (normalized.includes("informacje dodatkowe")) {
      features.push({ key: "extras", label: "Informacje dodatkowe", value, source: "payload" });
    } else if (normalized.includes("rodzaj zabudowy")) {
      features.push({ key: "building_type", label: "Rodzaj zabudowy", value, source: "payload" });
    } else if (normalized.includes("rok budowy")) {
      features.push({ key: "year_built", label: "Rok budowy", value, source: "payload" });
    }
  }

  return features;
}

function dedupeFeatures(features: ListingFeature[]) {
  const seen = new Set<string>();
  return features.filter((feature) => {
    const key = `${feature.key}:${feature.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractCurrencyNearKeywords(description: string, keywords: string[]) {
  const normalizedDescription = normalizePolish(description);

  for (const keyword of keywords) {
    const normalizedKeyword = escapeRegExp(normalizePolish(keyword));
    const pattern = new RegExp(
      `${normalizedKeyword}[\\s\\S]{0,64}?(?<!\\d)((?:\\d{1,3}(?:[\\s.]\\d{3})+|\\d{1,6})(?:,\\d{2})?)(?!\\d)\\s*(tys(?:iecy|ięcy)?|pln|zl|zł)`,
      "i"
    );
    const match = normalizedDescription.match(pattern);

    if (match?.[1]) {
      const numeric = Number(match[1].replace(/\s+/g, "").replace(",", "."));
      if (!Number.isFinite(numeric)) {
        continue;
      }

      const finalValue = /tys/i.test(match[2] ?? "") ? numeric * 1000 : numeric;
      return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(finalValue)} PLN`;
    }
  }

  return null;
}

function extractStreet(addressText?: string, description?: string) {
  const descriptionStreetWithNumber =
    description?.match(/\b(?:na\s+ulicy|przy\s+ulicy|ul\.?|ulica)\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9][^,.;\n]{1,80}?\s+\d+[A-Za-z/]*)\b/i)?.[1]?.trim();
  // A number at the end of a transport sentence ("do centrum w 20") is not
  // a building number. Real street-plus-number candidates stay compact.
  if (descriptionStreetWithNumber && descriptionStreetWithNumber.split(/\s+/).length <= 7) {
    return descriptionStreetWithNumber;
  }

  const addressCandidate = addressText?.split(",")[0]?.trim();
  if (addressCandidate) {
    const normalizedAddressCandidate = normalizePolish(addressCandidate);
    const looksLikeNarrativeAddress =
      normalizedAddressCandidate.includes("lezy blisko")
      || normalizedAddressCandidate.includes("znajduje sie")
      || normalizedAddressCandidate.includes("stacji")
      || normalizedAddressCandidate.includes("metro")
      || normalizedAddressCandidate.includes("skm")
      || normalizedAddressCandidate.split(" ").length > 6;

    const cleanedAddressCandidate = addressCandidate
      .replace(/^(?:ul\.?|ulica)\s+/i, "")
      .replace(/\s+\d+[A-Za-z/]*$/, "")
      .trim();

    if (!looksLikeNarrativeAddress && cleanedAddressCandidate.length >= 3) {
      return cleanedAddressCandidate;
    }
  }

  const descriptionMatch = description?.match(/\b(?:na\s+ulicy|przy\s+ulicy|ul\.?|ulica)\s+([A-ZĄĆĘŁŃÓŚŹŻ0-9][^,.;\n]{1,80})/i);
  const descriptionCandidate = descriptionMatch?.[1]
    ?.replace(/\s{2,}.*/, "")
    ?.replace(/\s+na\s+(?:bialolece|mokotowie|woli|bemowie|ursynowie|wilanowie|targowku|ochocie|bielanach|pradze(?:\s+poludnie|\s+polnoc)?|zoliborzu|wawrze|ursusie|wesolej|wlochach|rembertowie)\b.*$/i, "")
    ?.replace(/\s+cze(?:ka|kajÄ…)[^,.;\n]*$/i, "")
    ?.replace(/\s+(?:Prezentowany|Mieszkanie|Lokal|Apartament)\b.*$/i, "")
    ?.trim();

  return descriptionCandidate || undefined;
}

export function inferCommercialInfo(description?: string, snapshotPayload?: Record<string, unknown>) {
  const normalizedDescription = normalizePolish(description ?? "");
  const directByNoIntermediation = /nie\s+(?:jestesmy|jestem)\s+zainteresowan(?:i|y)\s+posrednictwem/.test(normalizedDescription);
  const nextData = getRecordAtPath(snapshotPayload, ["nextData"]);
  const productNode = findProductNode(getRecordAtPath(snapshotPayload, ["jsonLd"]));
  const advertiserHint = firstString(
    readString(getRecordAtPath(nextData, ["props", "pageProps", "ad"]), "advertiserType"),
    readString(getRecordAtPath(nextData, ["props", "pageProps", "ad"]), "advertType"),
    findAdditionalPropertyValue(productNode, "Typ ogłoszeniodawcy")
  );
  const normalizedAdvertiserHint = normalizePolish(advertiserHint ?? "");
  const explicitlyDirect = /bezposrednio\s+od\s+w(?:l|ł)asciciel\w*|sprzedaz\s+bezposrednia|oferta\s+bezposrednia|bez\s+posrednik\w*|od\s+w(?:l|ł)asciciel\w*/.test(normalizedDescription);
  const explicitlyPrivate = explicitlyDirect || directByNoIntermediation || /sprzedaz prywatna|oferta prywatna|agencjom dziekujemy/.test(normalizedDescription);
  const isPrivate = normalizedAdvertiserHint.includes("prywat")
    || normalizedAdvertiserHint.includes("private")
    || explicitlyPrivate;
  const isBroker = !explicitlyPrivate && (
    normalizedAdvertiserHint.includes("agency")
    || normalizedAdvertiserHint.includes("business")
    || normalizedAdvertiserHint.includes("biuro")
    || normalizedAdvertiserHint.includes("posred")
    || /biur(?:o|a)?\s+nieruchomosci|agencja nieruchomosci|posrednik|agent nieruchomosci|oferta\s+wys[lł]ana\s+z\s+programu\s+dla\s+biur\s+nieruchomosci|zapraszamy\s+do\s+kontaktu\s+z\s+hamilton\s+may[^.]{0,180}prezentacj\w*\s+(?:tej\s+)?nieruchomosci/.test(normalizedDescription)
  );
  const noCommission = /bez prowizji|0% prowizji|kupujacy nie placi prowizji|kupujacy nie płaci prowizji|kupujący nie placi prowizji|kupujący nie płaci prowizji/.test(normalizedDescription);
  const noCommissionStatement = /nie\s+pobieramy\s+prowizji/.test(normalizedDescription);
  const hasCommission = !noCommission && !noCommissionStatement && (/prowizj/.test(normalizedDescription) || /wynagrodzenie biura|wynagrodzenie agencji/.test(normalizedDescription));
  const badges: string[] = [];

  if (noCommission || noCommissionStatement) {
    badges.push("Bez prowizji");
  } else if (hasCommission) {
    badges.push("Z prowizją");
  }

  if (isBroker && !isPrivate) {
    badges.push("Oferta pośrednika");
  } else if (isPrivate && !isBroker) {
    badges.push(explicitlyDirect || directByNoIntermediation ? "Oferta bezpośrednia" : "Oferta prywatna");
  }

  return { badges };
}

function buildRcnDeltaLabel(pricePerSqm: number | null, benchmark: RcnBenchmark | null) {
  if (!pricePerSqm || !benchmark) {
    return "brak danych RCN";
  }

  const delta = ((pricePerSqm - benchmark.avgPricePerSqm) / benchmark.avgPricePerSqm) * 100;
  const sign = delta >= 0 ? "+" : "";
  const scopeLabel =
    benchmark.scope === "street"
      ? "ulica"
      : benchmark.scope === "neighborhood"
        ? "poddzielnica"
      : benchmark.scope === "district"
        ? "dzielnica"
        : "dzielnica";
  return `${sign}${delta.toFixed(1)}% vs RCN (${scopeLabel}, n=${benchmark.sampleCount})`;
}

function getPriceChangePercent(latestEvent: PriceEventRow | undefined) {
  if (!latestEvent?.previous_price_amount || !latestEvent.new_price_amount) {
    return 0;
  }

  const previous = Number(latestEvent.previous_price_amount);
  const next = Number(latestEvent.new_price_amount);
  if (!previous || !next) {
    return 0;
  }

  return Number((((next - previous) / previous) * 100).toFixed(1));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0
  }).format(value);
}

function formatInteger(value: string) {
  return new Intl.NumberFormat("pl-PL").format(Number(value));
}

function formatWeeklyDelta(delta: number, unit: string) {
  if (!Number.isFinite(delta) || delta === 0) return "bez zmian vs 7 dni temu";
  const arrow = delta > 0 ? "↑" : "↓";
  return `${arrow} ${formatInteger(String(Math.abs(Math.round(delta))))} ${unit} vs 7 dni temu`;
}

function normalizeListingContactStatus(value?: string | null): ListingContactStatus | null {
  if (!value) {
    return null;
  }

  const allowed: ListingContactStatus[] = ["new", "contacted", "negotiating", "viewing_scheduled", "rejected", "closed"];
  return allowed.includes(value as ListingContactStatus) ? (value as ListingContactStatus) : null;
}

function parseListingContactStatus(value?: string | null): ListingContactStatus | undefined {
  return normalizeListingContactStatus(value) ?? undefined;
}

function normalizeListingDecisionStage(value?: string | null): ListingDecisionStage | null {
  if (!value) {
    return null;
  }

  const allowed: ListingDecisionStage[] = ["new", "to_call", "after_call", "to_viewing", "after_viewing", "to_offer", "rejected", "bought"];
  return allowed.includes(value as ListingDecisionStage) ? (value as ListingDecisionStage) : null;
}

function parseListingDecisionStage(value?: string | null): ListingDecisionStage | undefined {
  return normalizeListingDecisionStage(value) ?? undefined;
}

function normalizeListingContactEventType(value?: string | null): ListingContactEventType | null {
  if (!value) {
    return null;
  }

  const allowed: ListingContactEventType[] = ["call", "message", "email", "meeting", "viewing_note", "negotiation", "status_change", "other"];
  return allowed.includes(value as ListingContactEventType) ? (value as ListingContactEventType) : null;
}

function parseListingContactEventType(value?: string | null): ListingContactEventType | undefined {
  return normalizeListingContactEventType(value) ?? undefined;
}

function normalizeNullableText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNumber(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNullableTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function listListingContactEvents(
  db: Parameters<typeof withDb>[0] extends (db: infer T) => Promise<unknown> ? T : never,
  listingId: string
): Promise<ListingContactEvent[]> {
  const result = await db.query<ListingContactEventRow>(
    `
      select
        id,
        listing_id,
        event_type,
        occurred_at::text,
        title,
        notes,
        contact_name,
        amount::text,
        created_at::text
      from listing_contact_events
      where listing_id = $1
      order by occurred_at desc, created_at desc
    `,
    [listingId]
  );

  return result.rows.flatMap((row) => {
    const eventType = parseListingContactEventType(row.event_type);
    if (!eventType) {
      return [];
    }

    return [{
      id: row.id,
      listingId: row.listing_id,
      eventType,
      occurredAt: row.occurred_at,
      title: row.title ?? undefined,
      notes: row.notes ?? undefined,
      contactName: row.contact_name ?? undefined,
      amount: row.amount ? Number(row.amount) : undefined,
      createdAt: row.created_at
    }] satisfies ListingContactEvent[];
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getRcnBenchmark(db: Parameters<typeof withDb>[0] extends (db: infer T) => Promise<unknown> ? T : never, row: ListingRow) {
  const cityNormalized = normalizePolish(row.city);
  const districtValue = resolveDistrict(row);
  const districtNormalized = districtValue && districtValue !== "Bez dzielnicy" ? normalizePolish(districtValue) : null;
  const neighborhoodValue = resolveNeighborhood(row);
  const neighborhoodNormalized = neighborhoodValue ? normalizePolish(neighborhoodValue) : null;
  const streetNormalized = normalizeStreetName(extractStreet(row.address_text ?? undefined, row.description ?? undefined));

  const scopes: Array<{
    scope: RcnBenchmark["scope"];
    sql: string;
    values: string[];
    minSamples: number;
  }> = [];

  if (streetNormalized) {
    scopes.push({
      scope: "street",
      sql: `city_normalized = $1 and street_normalized = $2`,
      values: [cityNormalized, streetNormalized],
      minSamples: 3
    });
  }

  if (neighborhoodNormalized) {
    scopes.push({
      scope: "neighborhood",
      sql: `city_normalized = $1 and district_normalized = $2`,
      values: [cityNormalized, neighborhoodNormalized],
      minSamples: 4
    });
  }

  if (districtNormalized) {
    scopes.push({
      scope: "district",
      sql: `city_normalized = $1 and district_normalized = $2`,
      values: [cityNormalized, districtNormalized],
      minSamples: 5
    });
  }

  for (const scope of scopes) {
    const result = await db.query<{ avg_price_per_sqm: string | null; sample_count: string }>(
      `
        select
          avg(price_per_sqm)::text as avg_price_per_sqm,
          count(*)::text as sample_count
        from transaction_rcn
        where price_per_sqm is not null
          and transaction_date >= current_date - make_interval(years => ${RCN_BENCHMARK_YEARS})
          and ${scope.sql}
      `,
      scope.values
    );

    const sampleCount = Number(result.rows[0]?.sample_count ?? "0");
    const avgPricePerSqm = result.rows[0]?.avg_price_per_sqm ? Number(result.rows[0].avg_price_per_sqm) : null;

    if (avgPricePerSqm && sampleCount >= scope.minSamples) {
      return {
        avgPricePerSqm,
        sampleCount,
        scope: scope.scope
      } satisfies RcnBenchmark;
    }
  }

  return null;
}

async function getRcnComparableTransactions(
  db: Parameters<typeof withDb>[0] extends (db: infer T) => Promise<unknown> ? T : never,
  row: ListingRow
): Promise<RcnComparableTransaction[]> {
  const streetNormalized = normalizeStreetName(extractStreet(row.address_text ?? undefined, row.description ?? undefined));
  if (!streetNormalized || !row.latitude || !row.longitude) return [];
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const result = await db.query<{
    id: string; transaction_date: string; street: string | null; area_sqm: string; price_amount: string; price_per_sqm: string; market_type: "primary" | "secondary"; distance_meters: string;
  }>(
    `
      select id, transaction_date::text, street, area_sqm::text, price_amount::text, price_per_sqm::text, market_type,
        round((6371000 * acos(least(1, greatest(-1,
          cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude))
        ))))::numeric)::text as distance_meters
      from transaction_rcn
      where street_normalized = $3
        and latitude is not null and longitude is not null
        and area_sqm is not null and price_per_sqm is not null
        and transaction_date >= current_date - make_interval(years => ${RCN_BENCHMARK_YEARS})
        and 6371000 * acos(least(1, greatest(-1,
          cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude))
        ))) <= ${RCN_COMPARABLE_RADIUS_METERS}
      order by distance_meters asc, transaction_date desc
      limit 25
    `,
    [latitude, longitude, streetNormalized]
  );
  return result.rows.map((transaction) => ({
    id: transaction.id,
    transactionDate: transaction.transaction_date,
    street: transaction.street ?? undefined,
    areaSqm: Number(transaction.area_sqm),
    priceAmount: Number(transaction.price_amount),
    pricePerSqm: Number(transaction.price_per_sqm),
    distanceMeters: Number(transaction.distance_meters),
    marketType: transaction.market_type
  }));
}

function buildListingOrderBy(sort?: ListingFilters["sort"]) {
  if (sort === "oldest") {
    return `${EFFECTIVE_LISTING_DATE_SQL} asc nulls last, l.created_at asc`;
  }

  if (sort === "price_desc") {
    return `l.price_amount desc nulls last, ${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc`;
  }

  if (sort === "price_asc") {
    return `l.price_amount asc nulls last, ${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc`;
  }

  if (sort === "area_desc") {
    return `coalesce(l.area_sqm, 0) desc, ${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc`;
  }

  if (sort === "area_asc") {
    return `coalesce(l.area_sqm, 0) asc, ${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc`;
  }

  return `${EFFECTIVE_LISTING_DATE_SQL} desc nulls last, l.created_at desc`;
}

function computeDreamScore(listing: ListingSummary, profile: Awaited<ReturnType<typeof getFamilySettings>>["dreamProfile"], workplaces: FamilySettings["workplaces"]) {
  const districtNeedle = normalizeLocationComparable(`${listing.district} ${listing.neighborhood ?? ""}`);
  const preferredDistricts = profile.preferredDistricts
    .map((value) => normalizeLocationComparable(value))
    .filter(Boolean);
  const area = parseNumericLabel(listing.areaLabel);
  const price = parseNumericLabel(listing.priceLabel);
  const pricePerSqm = parseNumericLabel(listing.pricePerSqmLabel);
  const rooms = listing.roomsCount;
  let points = 0;
  let maxPoints = 0;
  const text = normalizePolish(`${listing.title} ${listing.description ?? ""}`).toLowerCase();
  const mentions = (...phrases: string[]) => phrases.some((phrase) => text.includes(normalizePolish(phrase).toLowerCase()));

  if (preferredDistricts.length > 0) {
    maxPoints += 20;
    if (preferredDistricts.some((district) => districtNeedle.includes(district) || district.includes(districtNeedle))) {
      points += 20;
    }
  }

  if (profile.minArea > 0 || profile.maxArea > 0) {
    maxPoints += 20;
    if (typeof area === "number") {
      const fitsMin = profile.minArea <= 0 || area >= profile.minArea;
      const fitsMax = profile.maxArea <= 0 || area <= profile.maxArea;
      if (fitsMin && fitsMax) {
        points += 20;
      } else if ((profile.minArea > 0 && area >= profile.minArea - 5) || (profile.maxArea > 0 && area <= profile.maxArea + 5)) {
        points += 10;
      }
    }
  }

  if (profile.minRooms > 0) {
    maxPoints += 18;
    if (typeof rooms === "number") {
      if (rooms === 4) {
        points += 18;
      } else if (rooms > 4) {
        points += 14;
      } else if (rooms >= profile.minRooms) {
        points += 11;
      }
    }
  }

  if (profile.maxPrice > 0) {
    maxPoints += 15;
    if (typeof price === "number") {
      if (price <= profile.maxPrice) {
        points += 15;
      } else if (price <= profile.maxPrice * 1.07) {
        points += 7;
      }
    }
  }

  if (profile.maxPricePerSqm > 0) {
    maxPoints += 20;
    if (typeof pricePerSqm === "number") {
      if (pricePerSqm <= profile.maxPricePerSqm) {
        const discountRatio = Math.min(1, Math.max(0, (profile.maxPricePerSqm - pricePerSqm) / (profile.maxPricePerSqm * 0.25)));
        points += Math.round(6 + discountRatio * 14);
      } else if (pricePerSqm <= profile.maxPricePerSqm * 1.07) {
        points += 3;
      }
    }
  }

  maxPoints += 16;
  if (listing.finishQuality === "ready") {
    points += 16;
  } else if (listing.finishQuality === "unknown") {
    points += 7;
  } else {
    // Developer standard requires a separate finishing budget, not merely
    // cosmetic work.
    points -= 10;
  }

  // These are deliberately asymmetric: their absence is a real drawback for the
  // family profile, not merely a missed small bonus.
  const garageBonus = profile.requiresGarage ? 24 : 16;
  const garagePenalty = profile.requiresGarage ? 36 : 10;
  maxPoints += garageBonus;
  points += listing.hasGarage ? garageBonus : -garagePenalty;
  if (!listing.hasGarage && listing.hasOutdoorParking) {
    maxPoints += 8;
    points += 8;
  }

  maxPoints += 6;
  if (listing.hasStorage) {
    points += 6;
  }

  const liftBonus = 21;
  maxPoints += liftBonus;
  points += listing.hasLift ? liftBonus : -20;

  // Having both makes day-to-day use with a family much easier, so it earns an
  // additional joint premium beyond the individual amenities.
  maxPoints += 12;
  if (listing.hasGarage && listing.hasLift) {
    points += 12;
  }

  // Missing construction year is neutral. Known buildings from 2000 onward
  // receive progressively more credit, without inventing data for older stock.
  if (typeof listing.yearBuilt === "number") {
    maxPoints += 12;
    if (listing.yearBuilt >= 2000) {
      const progress = Math.min(1, (listing.yearBuilt - 2000) / Math.max(1, new Date().getFullYear() - 2000));
      points += 2 + Math.round(progress * 10);
    }
  }

  if (typeof listing.floor === "number") {
    maxPoints += 5;
    if (listing.floor <= 0) {
      points -= 2;
    } else if (typeof listing.totalFloors === "number" && listing.totalFloors > 0) {
      points += listing.floor >= listing.totalFloors ? 5 : Math.max(1, Math.round((listing.floor / listing.totalFloors) * 4));
    } else {
      points += Math.min(5, Math.max(1, listing.floor));
    }
  }

  if (profile.prefersBalcony) {
    maxPoints += 10;
    if (listing.hasBalcony) {
      points += 10;
    }
  }

  if (mentions("drewniana podłoga", "drewniane podłogi", "parkiet", "deska podłogowa", "podłoga z drewna", "egzotycznego drewna", "merbau", "dębowa deska")
    || /\bpod(?:l|ł)og\w*[^.!?;]{0,70}?dab\w*\s+wedzon\w*\b/.test(text)) {
    maxPoints += 3;
    points += 3;
  }

  // Soft signals are deliberately bonuses only: portals often omit them, so
  // absence must not be interpreted as a defect.
  const premiumSignals = [
    ["projekt architekta", 8],
    ["architekta", 6],
    ["ogrzewanie podłogowe", 3],
    ["po remoncie", 4],
    ["swiezo wyremontowane", 4],
    ["odswiezone", 3],
    ["garderoba", 3],
    ["dwie lazienki", 4],
    ["2 lazienki", 4],
    ["gabinet", 5],
    ["wysoki standard", 4],
    ["wysokiej jakosci", 4],
    ["zamkniete osiedle", 3],
    ["monitoring", 2]
  ] as const;
  if (listing.hasAirConditioning) {
    maxPoints += 4;
    points += 4;
  }
  for (const [phrase, value] of premiumSignals) {
    if (mentions(phrase)) {
      maxPoints += value;
      points += value;
    }
  }

  if (listing.roomsCount && listing.roomsCount >= 4) {
    maxPoints += 8;
    points += listing.roomsCount === 4 ? 8 : 6;
  }

  if (typeof listing.floor !== "number" && mentions("parter")) points -= 2;
  if (mentions("jasne", "dobre naslonecznienie", "sloneczne")) {
    maxPoints += 5;
    points += 5;
  }

  // Opportunity signals are separate from the apartment's qualities, but they
  // deserve a small lift because they create room for a better final deal.
  if (listing.priceChangePercent <= -3) {
    maxPoints += 6;
    points += listing.priceChangePercent <= -7 ? 6 : 4;
  }
  const firstSeen = listing.firstSeenAt ?? listing.publishedAt;
  if (firstSeen && Number.isFinite(Date.parse(firstSeen))) {
    const daysOnMarket = (Date.now() - Date.parse(firstSeen)) / 86_400_000;
    if (daysOnMarket >= 60) {
      maxPoints += 3;
      points += 3;
    } else if (daysOnMarket >= 35) {
      maxPoints += 3;
      points += 2;
    }
  }

  if (profile.maxMetroDistanceMeters > 0) {
    maxPoints += 10;
    const nearestMetro = findNearestWarsawMetroStation(listing.latitude, listing.longitude);
    if (nearestMetro && nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters) {
      points += 10;
    } else if (nearestMetro && nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters * 1.5) {
      points += 5;
    }
  }

  const commuteDistances = workplaces
    .map((workplace) => straightLineDistanceKm(listing.latitude, listing.longitude, workplace.latitude, workplace.longitude))
    .filter((distance): distance is number => typeof distance === "number");
  if (commuteDistances.length > 0) {
    maxPoints += 12;
    const averageDistance = commuteDistances.reduce((sum, distance) => sum + distance, 0) / commuteDistances.length;
    if (averageDistance <= 7) {
      points += 12;
    } else if (averageDistance <= 12) {
      points += 8;
    } else if (averageDistance <= 18) {
      points += 4;
    }
  }

  // Commercial terms affect the real acquisition cost. A broker listing with
  // explicitly no commission stays neutral; only an actual commission is a penalty.
  if (listing.badges.includes("Z prowizją")) {
    points -= 12;
  } else if (listing.badges.includes("Oferta prywatna") || listing.badges.includes("Oferta bezpośrednia")) {
    points += 8;
  }

  return maxPoints > 0 ? Math.max(0, Math.round((points / maxPoints) * 100)) : 0;
}

function straightLineDistanceKm(latitude?: number, longitude?: number, targetLatitude?: number, targetLongitude?: number) {
  if ([latitude, longitude, targetLatitude, targetLongitude].some((value) => typeof value !== "number")) {
    return undefined;
  }

  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(targetLatitude! - latitude!);
  const longitudeDelta = toRadians(targetLongitude! - longitude!);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(latitude!)) * Math.cos(toRadians(targetLatitude!)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseNumericLabel(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/-?\d[\d\s.]*(?:,\d+)?/);
  if (!match?.[0]) {
    return undefined;
  }

  const numeric = Number(match[0].replace(/\s+/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeLocationComparable(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bna\b/g, " "],
    [/\bw\b/g, " "],
    [/\bwe\b/g, " "],
    [/\bprzy\b/g, " "],
    [/\bpradze\b/g, "praga"],
    [/\bpoludniu\b/g, "poludnie"],
    [/\bpolnocy\b/g, "polnoc"],
    [/\bsrodmiesciu\b/g, "srodmiescie"],
    [/\bzoliborzu\b/g, "zoliborz"],
    [/\bmokotowie\b/g, "mokotow"],
    [/\bwoli\b/g, "wola"],
    [/\bbemowie\b/g, "bemowo"],
    [/\bbialolece\b/g, "bialoleka"],
    [/\bbielanach\b/g, "bielany"],
    [/\bochocie\b/g, "ochota"],
    [/\bursynowie\b/g, "ursynow"],
    [/\bursusie\b/g, "ursus"],
    [/\bwilanowie\b/g, "wilanow"],
    [/\bwawrze\b/g, "wawer"],
    [/\bwesolej\b/g, "wesola"],
    [/\bwlochach\b/g, "wlochy"],
    [/\bgoclawiu\b/g, "goclaw"],
    [/\bsaskiej kepie\b/g, "saska kepa"]
  ];

  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-/g, " ");

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

type JsonRecord = Record<string, unknown>;

function getRecordAtPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }
  return current && typeof current === "object" && !Array.isArray(current) ? (current as JsonRecord) : null;
}

function getArrayAtPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }
  return Array.isArray(current) ? current : null;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function readString(value: unknown, ...path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }
  return typeof current === "string" ? current.trim() : null;
}

function readNumber(value: unknown, ...path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }

  if (typeof current === "number" && Number.isFinite(current)) {
    return current;
  }

  if (typeof current === "string") {
    const normalized = Number(current.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function firstString(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function firstNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function normalizePhone(value?: string | null) {
  if (!value) {
    return null;
  }

  if (value.includes("...")) {
    return null;
  }

  const normalized = value
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\d+()\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 ? formatPhoneDigits(digits) : null;
}

function formatPhoneDigits(value: string) {
  const digits = value.startsWith("48") && value.length === 11 ? value.slice(2) : value;
  if (digits.length === 9 && isPolishMobileNumber(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  if (digits.length === 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return digits;
}

function isPolishMobileNumber(value: string) {
  return /^(?:4[5-9]|5\d|6\d|7[2389]|8[08])/.test(value);
}

function extractPhoneFromHtml(html?: string | null) {
  if (!html) {
    return null;
  }

  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
  const match = text.match(/\+48[\s-]*\d{3}[\s-]*\d{3}[\s-]*\d{3}|\b\d{3}[\s-]*\d{3}[\s-]*\d{3}\b/);
  return normalizePhone(match?.[0] ?? null);
}

function extractTopContactPhoneFromHtml(html?: string | null) {
  if (!html) {
    return null;
  }

  const topContactMatch = html.match(/(?:topContactPersonName|details-contact__name)[\s\S]{0,2000}?(?:data-cy=["']phoneContactNumber["'][^>]*>|class=["'][^"']*phone-contact__number[^"']*["'][^>]*>)([\s\S]{5,80}?)<\//i);
  return normalizePhone(topContactMatch?.[1]?.replace(/<[^>]+>/g, " ") ?? null);
}

function extractSerializedAgentPhoneFromHtml(html?: string | null) {
  if (!html) {
    return null;
  }

  const agentPayloadMatch = html.match(/"person"\s*:\s*\d+[\s\S]{0,3000}?"AGENT"/i);
  const phones = Array.from(agentPayloadMatch?.[0].matchAll(/"(\+?\d[\d\s-]{6,16})"/g) ?? [])
    .map((match) => normalizePhone(match[1]))
    .filter((value): value is string => Boolean(value));
  return phones.at(-1) ?? null;
}

function findAdditionalPropertyValue(productNode: JsonRecord | null, name: string) {
  const properties = getArrayAtPath(productNode, ["additionalProperty"]) ?? [];

  for (const property of properties) {
    const record = getRecord(property);
    if (!record) {
      continue;
    }

    if (readString(record, "name") === name) {
      return readString(record, "value");
    }
  }

  return null;
}

function findProductNode(value: unknown) {
  const graph = getArrayAtPath(value, ["@graph"]);
  if (graph) {
    for (const item of graph) {
      const record = getRecord(item);
      const type = record?.["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.some((entry) => typeof entry === "string" && ["Product", "Apartment"].includes(entry))) {
        return record;
      }
    }
  }
  return getRecord(value);
}
