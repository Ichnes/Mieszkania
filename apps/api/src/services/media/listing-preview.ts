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
    ) photos order by listing_id,rank`,
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
      ...urls.filter((url) => !/^https?:/.test(url)).slice(0, 4),
      ...urls.filter((url) => /^https?:/.test(url)).slice(0, 4),
    ]);
  return result;
}

/** Include an explicitly labelled fallback from an already merged sibling. */
export async function getDuplicateListingPreviews(
  ids: string[],
  db: Pick<Pool | PoolClient, "query"> = pool,
) {
  const result = new Map<string, { urls: string[]; sharedFromIndex?: number }>();
  if (!ids.length) return result;
  const siblings = (
    await db.query<{ listing_id: string; sibling_id: string }>(
      `select own.listing_id, sibling.listing_id as sibling_id
     from listing_duplicate_group_members own
     join listing_duplicate_group_members sibling on sibling.group_id=own.group_id
     where own.listing_id=any($1::uuid[]) and sibling.listing_id<>own.listing_id
     order by own.listing_id,sibling.is_primary desc,sibling.listing_id`,
      [ids],
    )
  ).rows;
  const own = await getOwnListingPreviewUrls(
    [...new Set([...ids, ...siblings.map((row) => row.sibling_id)])],
    db,
  );
  for (const id of ids) {
    const urls = [...(own.get(id) ?? [])];
    const shared = [
      ...new Set(
        siblings
          .filter((row) => row.listing_id === id)
          .flatMap((row) => own.get(row.sibling_id) ?? []),
      ),
    ].filter((url) => !urls.includes(url));
    shared.sort((a, b) => Number(/^https?:/.test(a)) - Number(/^https?:/.test(b)));
    result.set(id, {
      urls: [...urls, ...shared.slice(0, 8)],
      sharedFromIndex: shared.length ? urls.length : undefined,
    });
  }
  return result;
}
