import { withDb } from "../../db";

export async function deletePortalSourceData(sourceKey: string) {
  return withDb(async (db) => {
    const client = await db.connect();

    try {
      await client.query("begin");

      const sourceResult = await client.query<{ id: string }>(
        `select id from sources where key = $1 limit 1`,
        [sourceKey],
      );
      const sourceId = sourceResult.rows[0]?.id;

      const queueResult = await client.query<{ count: string }>(
        `with deleted as (
           delete from listing_import_queue
           where source_key = $1
           returning 1
         )
         select count(*)::text as count from deleted`,
        [sourceKey],
      );

      if (!sourceId) {
        await client.query("commit");
        return {
          sourceKey,
          listingsDeleted: 0,
          queueDeleted: Number(queueResult.rows[0]?.count ?? "0"),
          duplicateReviewsDeleted: 0,
          duplicateGroupsDeleted: 0,
          mediaAssetsDeleted: 0,
          sourceDeleted: false,
        };
      }

      const listingIdsResult = await client.query<{ id: string }>(
        `select id from listings where source_id = $1`,
        [sourceId],
      );
      const listingIds = listingIdsResult.rows.map((row) => row.id);

      let duplicateReviewsDeleted = 0;
      let duplicateGroupsDeleted = 0;

      if (listingIds.length > 0) {
        const reviewsResult = await client.query<{ count: string }>(
          `with deleted as (
             delete from listing_duplicate_reviews
             where listing_id_left = any($1::uuid[])
                or listing_id_right = any($1::uuid[])
             returning 1
           )
           select count(*)::text as count from deleted`,
          [listingIds],
        );
        duplicateReviewsDeleted = Number(reviewsResult.rows[0]?.count ?? "0");

        await client.query(
          `delete from listing_duplicate_group_members where listing_id = any($1::uuid[])`,
          [listingIds],
        );

        const groupsResult = await client.query<{ count: string }>(
          `with deleted as (
             delete from listing_duplicate_groups g
             where not exists (
               select 1 from listing_duplicate_group_members gm where gm.group_id = g.id
             )
             returning 1
           )
           select count(*)::text as count from deleted`,
        );
        duplicateGroupsDeleted = Number(groupsResult.rows[0]?.count ?? "0");
      }

      const listingsResult = await client.query<{ count: string }>(
        `with deleted as (
           delete from listings
           where source_id = $1
           returning 1
         )
         select count(*)::text as count from deleted`,
        [sourceId],
      );

      const mediaResult = await client.query<{ count: string }>(
        `with deleted as (
           delete from listing_media_assets a
           where a.storage_key like $1
             and not exists (select 1 from listing_images i where i.asset_id = a.id)
           returning 1
         )
         select count(*)::text as count from deleted`,
        [`sources/${sourceKey}/%`],
      );

      const sourceDeleteResult = await client.query<{ count: string }>(
        `with deleted as (
           delete from sources s
           where s.id = $1
             and not exists (select 1 from listings l where l.source_id = s.id)
             and not exists (select 1 from crawl_artifacts c where c.source_id = s.id)
             and not exists (select 1 from transaction_rcn t where t.source_id = s.id)
           returning 1
         )
         select count(*)::text as count from deleted`,
        [sourceId],
      );

      await client.query("commit");

      return {
        sourceKey,
        listingsDeleted: Number(listingsResult.rows[0]?.count ?? "0"),
        queueDeleted: Number(queueResult.rows[0]?.count ?? "0"),
        duplicateReviewsDeleted,
        duplicateGroupsDeleted,
        mediaAssetsDeleted: Number(mediaResult.rows[0]?.count ?? "0"),
        sourceDeleted: Number(sourceDeleteResult.rows[0]?.count ?? "0") > 0,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}
