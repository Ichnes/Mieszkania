import { withDb } from "../db";

type ResetOptions = {
  preserveSettings?: boolean;
};

export async function resetApplicationData(options: ResetOptions = {}) {
  const preserveSettings = options.preserveSettings ?? true;

  await withDb(async (db) => {
    await db.query("begin");

    try {
      await db.query(`
        truncate table
          crawl_artifacts,
          listing_images,
          listing_media_assets,
          listing_import_queue,
          listing_scores,
          listing_viewings,
          listing_manual_overrides,
          listing_contact_events,
          price_events,
          listing_snapshots,
          listings,
          property_candidates,
          alert_rules,
          transaction_rcn
        restart identity cascade
      `);

      if (!preserveSettings) {
        await db.query(`delete from app_settings where key = 'family-settings'`);
      }

      await db.query(`
        delete from sources
        where kind = 'portal' or key = 'deweloperuch_rcn'
      `);

      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}
