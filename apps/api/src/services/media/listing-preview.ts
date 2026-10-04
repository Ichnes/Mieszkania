import type { Pool, PoolClient } from "pg";
import { pool } from "../../db";
import { findMediaFilePathAsync, getMediaResponsePath } from "./image-repository";

/** Only this listing's photos: a sibling's photo would hide mismatches during duplicate review. */
export async function getOwnListingPreviewUrls(
  ids: string[],
  db: Pick<Pool | PoolClient, "query"> = pool,
) {
  const result = new Map<string, string[]>();
  if (!ids.length) return result;
  const rows = (
    await db.query<{ listing_id: string; source_url: string; storage_key: string | null }>(
      `select listing_id,source_url,storage_key from (
    select image.listing_id,image.source_url,asset.storage_key,
      row_number() over(partition by image.listing_id order by (asset.download_status::text='downloaded') desc nulls last,
        (coalesce(image.caption,'')='Rzut') asc,image.is_primary desc,image.position asc,image.id) rank
    from listing_images image left join listing_media_assets asset on asset.id=image.asset_id
    where image.listing_id=any($1::uuid[])
    ) photos where rank<=4 order by listing_id,rank`,
      [ids],
    )
  ).rows;
  for (const row of rows) {
    const urls = result.get(row.listing_id) ?? [];
    if (row.storage_key && (await findMediaFilePathAsync(row.storage_key)))
      urls.push(getMediaResponsePath(row.storage_key));
    if (/^https?:\/\//i.test(row.source_url)) urls.push(row.source_url);
    result.set(row.listing_id, [...new Set(urls)]);
  }
  // Exhaust available local photos before using portal URLs which may reject hotlinking.
  for (const [id, urls] of result)
    result.set(id, [
      ...urls.filter((url) => !/^https?:/.test(url)),
      ...urls.filter((url) => /^https?:/.test(url)),
    ]);
  return result;
}
