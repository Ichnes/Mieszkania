import { withDb } from "../db";

export async function cleanupSeedData() {
  await withDb(async (db) => {
    await db.query("begin");

    try {
      const listingIdsResult = await db.query<{ id: string }>(
        `
          select id
          from listings
          where canonical_url like 'https://example.com/%'
             or external_id in ('oto-1001', 'oto-1002', 'dev-1003')
        `
      );

      const listingIds = listingIdsResult.rows.map((row) => row.id);

      if (listingIds.length > 0) {
        await db.query(`delete from crawl_artifacts where listing_id = any($1::uuid[])`, [listingIds]);
        await db.query(`delete from listing_images where listing_id = any($1::uuid[])`, [listingIds]);
        await db.query(`delete from price_events where listing_id = any($1::uuid[])`, [listingIds]);
        await db.query(`delete from listing_snapshots where listing_id = any($1::uuid[])`, [listingIds]);
        await db.query(`delete from listing_scores where listing_id = any($1::uuid[])`, [listingIds]);
        await db.query(`delete from listing_viewings where listing_id = any($1::uuid[])`, [listingIds]);
        await db.query(`delete from listings where id = any($1::uuid[])`, [listingIds]);
      }

      await db.query(`
        delete from alert_rules
        where user_id = 'local-user'
          and name in ('Mokotow do 1.2 mln', 'Oferty ponizej mediany RCN')
      `);

      await db.query(`
        delete from transaction_rcn
        where city = 'Warszawa'
          and district in ('Mokotow', 'Praga Poludnie', 'Wola')
          and payload_raw = '{}'::jsonb
      `);

      await db.query(`
        delete from sources
        where key = 'deweloperuch_rcn'
          and not exists (select 1 from transaction_rcn where source_id = sources.id)
      `);

      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}
