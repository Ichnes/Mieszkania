import type {
  ListingViewing,
  ListingViewingStatus,
  UpcomingViewingsResponse
} from "@mieszkania/shared";
import { withDb } from "../db";
import { activeRegion } from "../domain/region";

type ListingViewingRow = {
  id: string;
  listing_id: string;
  scheduled_at: string;
  status: ListingViewingStatus;
  notes: string | null;
};

type UpcomingViewingRow = ListingViewingRow & {
  title: string;
  city: string;
  district: string | null;
  address_text: string | null;
};

export async function getListingViewing(listingId: string): Promise<ListingViewing | null> {
  return withDb(async (db) => {
    const result = await db.query<ListingViewingRow>(
      `
        select id, listing_id, scheduled_at::text, status, notes
        from listing_viewings
        where listing_id = $1
        limit 1
      `,
      [listingId]
    );

    const row = result.rows[0];
    return row ? mapViewing(row) : null;
  });
}

export async function upsertListingViewing(input: {
  listingId: string;
  scheduledAt: string;
  status?: ListingViewingStatus;
  notes?: string;
}) {
  return withDb(async (db) => {
    const result = await db.query<ListingViewingRow>(
      `
        insert into listing_viewings (listing_id, scheduled_at, status, notes, updated_at)
        values ($1, $2::timestamptz, $3, $4, now())
        on conflict (listing_id)
        do update set
          scheduled_at = excluded.scheduled_at,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = now()
        returning id, listing_id, scheduled_at::text, status, notes
      `,
      [input.listingId, input.scheduledAt, input.status ?? "scheduled", input.notes ?? null]
    );

    return mapViewing(result.rows[0]);
  });
}

export async function deleteListingViewing(listingId: string) {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `
        delete from listing_viewings
        where listing_id = $1
        returning id
      `,
      [listingId]
    );

    return Boolean(result.rows[0]?.id);
  });
}

export async function getUpcomingViewings(): Promise<UpcomingViewingsResponse> {
  return withDb(async (db) => {
    const result = await db.query<UpcomingViewingRow>(
      `
        select
          lv.id,
          lv.listing_id,
          lv.scheduled_at::text,
          lv.status,
          lv.notes,
          l.title,
          l.city,
          l.district,
          l.address_text
        from listing_viewings lv
        join listings l on l.id = lv.listing_id
        where lv.status = 'scheduled'
          and l.city = any($1::text[])
        order by lv.scheduled_at asc
        limit 20
      `,
      [activeRegion.supportedCities]
    );

    return {
      total: result.rows.length,
      items: result.rows.map((row) => ({
        id: row.id,
        listingId: row.listing_id,
        listingTitle: row.title,
        scheduledAt: row.scheduled_at,
        status: row.status,
        city: row.city,
        district: row.district ?? undefined,
        addressText: row.address_text ?? undefined,
        notes: row.notes ?? undefined
      }))
    };
  });
}

function mapViewing(row: ListingViewingRow): ListingViewing {
  return {
    id: row.id,
    listingId: row.listing_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    notes: row.notes ?? undefined
  };
}
