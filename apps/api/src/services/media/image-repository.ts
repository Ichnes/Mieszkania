import { existsSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { mediaCacheRoot } from "../../config";
import { withDb } from "../../db";

export type ListingImageRecord = {
  id: string;
  sourceUrl: string;
  position: number;
  isPrimary: boolean;
  caption: string | null;
  storageKey: string | null;
  downloadStatus: string | null;
  localFilePath: string | null;
};

export type DownloadableMediaAsset = {
  assetId: string;
  storageKey: string;
  sourceUrl: string;
};

export async function getListingImages(listingId: string): Promise<ListingImageRecord[]> {
  return (await getListingImagesForListings([listingId])).get(listingId) ?? [];
}

export async function getListingImagesForListings(
  listingIds: string[],
): Promise<Map<string, ListingImageRecord[]>> {
  const imagesByListingId = new Map<string, ListingImageRecord[]>();
  if (listingIds.length === 0) {
    return imagesByListingId;
  }

  const rows = await withDb(async (db) => {
    const result = await db.query<{
      listing_id: string;
      id: string;
      source_url: string;
      position: number;
      is_primary: boolean;
      caption: string | null;
      storage_key: string | null;
      download_status: string | null;
    }>(
      `
        with requested(listing_id) as (
          select unnest($1::uuid[])
        ),
        candidate_sources as (
          select requested.listing_id as target_listing_id, requested.listing_id as source_listing_id, 0 as priority
          from requested
          union all
          select requested.listing_id, sibling.listing_id, 1
          from requested
          join listing_duplicate_group_members own on own.listing_id = requested.listing_id
          join listing_duplicate_group_members sibling on sibling.group_id = own.group_id
          where sibling.listing_id <> requested.listing_id
        ),
        ranked_sources as (
          select
            candidate_sources.target_listing_id,
            candidate_sources.source_listing_id,
            row_number() over (
              partition by candidate_sources.target_listing_id
              order by candidate_sources.priority asc, count(li.id) desc, candidate_sources.source_listing_id
            ) as source_rank
          from candidate_sources
          join listing_images li on li.listing_id = candidate_sources.source_listing_id
          group by candidate_sources.target_listing_id, candidate_sources.source_listing_id, candidate_sources.priority
        )
        select
          ranked_sources.target_listing_id as listing_id,
          li.id,
          li.source_url,
          li.position,
          li.is_primary,
          li.caption,
          lma.storage_key,
          lma.download_status::text
        from ranked_sources
        join listing_images li on li.listing_id = ranked_sources.source_listing_id
        left join listing_media_assets lma on lma.id = li.asset_id
        where ranked_sources.source_rank = 1
        order by ranked_sources.target_listing_id, li.position asc, li.created_at asc
      `,
      [listingIds],
    );

    return result.rows;
  });

  for (const row of rows) {
    const images = imagesByListingId.get(row.listing_id) ?? [];
    images.push({
      id: row.id,
      sourceUrl: row.source_url,
      position: row.position,
      isPrimary: row.is_primary,
      caption: row.caption,
      storageKey: row.storage_key,
      downloadStatus: row.download_status,
      localFilePath: row.storage_key ? findMediaFilePath(row.storage_key) : null,
    });
    imagesByListingId.set(row.listing_id, images);
  }

  return imagesByListingId;
}

export function getMediaResponsePath(storageKey: string) {
  return `/api/media/${encodeURIComponent(storageKey)}`;
}

export function findMediaFilePath(storageKey: string) {
  return findMediaFilePaths(storageKey)[0] ?? null;
}

export function findMediaFilePaths(storageKey: string) {
  const exactBasePath = resolve(mediaCacheRoot, storageKey);

  if (existsSync(exactBasePath)) {
    return [exactBasePath];
  }

  return globSync(`${exactBasePath}.*`);
}

export async function getMediaDownloadCandidates(input?: { listingId?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(1000, input?.limit ?? 100));

  return withDb(async (db) => {
    const values: Array<string | number> = [];
    const clauses = ["lma.storage_key is not null"];

    if (input?.listingId) {
      values.push(input.listingId);
      clauses.push(`li.listing_id = $${values.length}`);
    }

    values.push(limit);

    const result = await db.query<{
      asset_id: string;
      storage_key: string;
      source_url: string;
      download_status: string | null;
    }>(
      `
        select distinct on (lma.id)
          lma.id as asset_id,
          lma.storage_key,
          lma.source_url,
          lma.download_status::text
        from listing_media_assets lma
        inner join listing_images li on li.asset_id = lma.id
        where ${clauses.join(" and ")}
        order by
          lma.id,
          case
            when lma.download_status::text = 'failed' then 0
            when lma.download_status::text = 'pending' then 1
            when lma.download_status::text = 'downloaded' then 2
            else 3
          end,
          li.updated_at desc
        limit $${values.length}
      `,
      values,
    );

    return result.rows
      .filter((row) => row.download_status !== "downloaded" || !findMediaFilePath(row.storage_key))
      .map((row) => ({
        assetId: row.asset_id,
        storageKey: row.storage_key,
        sourceUrl: row.source_url,
      })) satisfies DownloadableMediaAsset[];
  });
}
