import { withDb } from "../db";

/**
 * Older versions used the lifecycle status to hide offers outside the search
 * contract. Visibility is already handled by listing filters, so restore those
 * records to a normal lifecycle status and let the 24-hour refresh job keep
 * checking them.
 */
export async function restoreCriteriaExcludedListings() {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `
        update listings
        set status = case when status = 'unknown' then 'active'::listing_status else status end,
            exclusion_reason = null,
            removed_at = case when status = 'unknown' then null else removed_at end,
            updated_at = now()
        where exclusion_reason = 'criteria'
        returning id
      `
    );

    return {
      affected: result.rowCount ?? result.rows.length
    };
  });
}
