import { withDb } from "../db";

const brokenTitlePatterns = [
  "%gateway time-out%",
  "%gateway timeout%",
  "%error 504%",
  "%504: gateway time-out%",
  "%cloudflare%"
];
const unavailableOfferPatterns = [
  "%to ogloszenie nie jest juz dostepne%",
  "%to ogłoszenie nie jest już dostępne%",
  "%oferta nie jest dostepna%",
  "%oferta nie jest dostępna%",
  "%pod tym adresem nic nie ma%",
  "%nieruchomosc ma juz nowego wlasciciela%",
  "%nieruchomość ma już nowego właściciela%"
];

export async function sanitizeBrokenPortalListings() {
  return withDb(async (db) => {
    const brokenResult = await db.query<{ id: string; price_amount: string | null }>(
      `
        update listings l
        set status = 'removed',
            removed_at = coalesce(l.removed_at, now()),
            updated_at = now()
        from sources s
        where l.source_id = s.id
          and s.key = 'gratka'
          and l.status <> 'removed'
          and coalesce(l.price_amount, 0) = 0
          and coalesce(l.area_sqm, 0) = 0
          and exists (
            select 1
            from unnest($1::text[]) as pattern
            where lower(coalesce(l.title, '')) like pattern
               or lower(coalesce(l.address_text, '')) like pattern
          )
        returning l.id, l.price_amount::text
      `,
      [brokenTitlePatterns]
    );

    const missingPriceResult = await db.query<{ id: string; price_amount: string | null }>(
      `
        update listings l
        set status = 'removed',
            removed_at = coalesce(l.removed_at, now()),
            updated_at = now()
        from sources s
        where l.source_id = s.id
          and s.key = 'gratka'
          and l.status <> 'removed'
          and l.price_amount is null
        returning l.id, l.price_amount::text
      `
    );

    const unavailableResult = await db.query<{ id: string; price_amount: string | null }>(`
      update listings l set status = 'removed', removed_at = coalesce(l.removed_at, now()), updated_at = now()
      where l.status <> 'removed'
        and exists (select 1 from unnest($1::text[]) pattern where lower(coalesce(l.title, '')) like pattern or lower(coalesce(l.description, '')) like pattern)
      returning l.id, l.price_amount::text
    `, [unavailableOfferPatterns]);

    await insertRemovedEvents(db, [...brokenResult.rows, ...missingPriceResult.rows, ...unavailableResult.rows]);

    return {
      removedListings: brokenResult.rows.length + missingPriceResult.rows.length + unavailableResult.rows.length
    };
  });
}

async function insertRemovedEvents(
  db: Parameters<typeof withDb>[0] extends (db: infer T) => Promise<unknown> ? T : never,
  rows: Array<{ id: string; price_amount: string | null }>
) {
  if (rows.length === 0) {
    return;
  }

  await db.query(
    `
      insert into price_events (listing_id, event_type, previous_price_amount, new_price_amount)
      select item.id::uuid, 'removed', item.price_amount::numeric, item.price_amount::numeric
      from jsonb_to_recordset($1::jsonb) as item(id text, price_amount text)
      where not exists (
        select 1
        from price_events pe
        where pe.listing_id = item.id::uuid
          and pe.event_type = 'removed'
          and pe.changed_at >= now() - interval '12 hours'
      )
    `,
    [JSON.stringify(rows)]
  );
}
