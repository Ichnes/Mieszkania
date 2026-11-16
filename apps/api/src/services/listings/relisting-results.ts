import type { RelistedListingMatch, RelistedListingsResponse } from "@mieszkania/shared";
import type { Pool } from "pg";
import { pool } from "../../db";
import { activeRegion } from "../../domain/region";
import { getDuplicateListingPreviews } from "../media/listing-preview";
import { visibleRelistingCandidateSql } from "./listing-relistings";

const establishedRelistingSql = `
  select jsonb_build_object(
    'manuallyConfirmed', exists(select 1 from listing_relisting_reviews review
      where review.current_listing_id=l.id and review.previous_listing_id=archived.id and review.decision='confirmed'),
    'previous', jsonb_strip_nulls(jsonb_build_object(
      'id',archived.id,'title',archived.title,'sourceLabel',previous_source.name,
      'canonicalUrl',archived.canonical_url,'priceAmount',relation.previous_price_amount,
      'eventAt',coalesce(archived.removed_at,archived.last_seen_at),
      'addressText',archived.address_text,'areaSqm',archived.area_sqm,'rooms',archived.rooms,'floor',archived.floor)),
    'current', jsonb_strip_nulls(jsonb_build_object(
      'id',l.id,'title',l.title,'sourceLabel',current_source.name,
      'canonicalUrl',l.canonical_url,'priceAmount',relation.relisted_price_amount,
      'eventAt',l.first_seen_at,'addressText',l.address_text,'areaSqm',l.area_sqm,'rooms',l.rooms,'floor',l.floor)),
    'priceDifferenceAmount',relation.relisted_price_amount-relation.previous_price_amount,
    'priceDifferencePercent',100*(relation.relisted_price_amount-relation.previous_price_amount)/nullif(relation.previous_price_amount,0),
    'confidenceScore',relation.confidence_score,'reasons',string_to_array(relation.reason_summary,', ')
  ) payload, l.first_seen_at
  from listing_relistings relation
  join listings l on l.id=relation.current_listing_id
  join listings archived on archived.id=relation.previous_listing_id
  join sources current_source on current_source.id=l.source_id
  join sources previous_source on previous_source.id=archived.source_id
  where l.status='active' and l.hidden_duplicate_of_id is null
    and archived.status='removed' and archived.hidden_duplicate_of_id is null
    and coalesce(archived.exclusion_reason,'') <> 'manual_rejected'
`;

export async function getEstablishedRelistingMatch(
  currentId: string,
  previousId: string,
  db: Pick<Pool, "query"> = pool,
) {
  const result = await db.query<{ payload: RelistedListingMatch }>(
    `select jsonb_strip_nulls(match.payload) payload from (
      ${establishedRelistingSql} and l.id=$1 and archived.id=$2
    ) match`,
    [currentId, previousId],
  );
  return result.rows[0]?.payload;
}

// Read saved relations without rerunning the matching algorithm or changing user decisions.
export async function getRelistingResults(
  limit = 20,
  offset = 0,
  db: Pick<Pool, "query"> = pool,
): Promise<RelistedListingsResponse> {
  const values = [
    Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 100)) : 20,
    Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0,
    activeRegion.supportedCities,
  ];
  type Page = { total: number; items: RelistedListingMatch[] };
  const queries = await Promise.allSettled([
    db.query<Page>(
      `with matches as (
        ${establishedRelistingSql} and l.city=any($3::text[])
      )
      select (select count(*)::int from matches) total,
        coalesce(jsonb_agg(jsonb_strip_nulls(page.payload) order by page.first_seen_at desc,page.payload->'current'->>'id'),'[]'::jsonb) items
      from (select * from matches order by first_seen_at desc,payload->'current'->>'id' limit $1 offset $2) page`,
      values,
    ),
    db.query<Page>(
      `with matches as (
        select candidate.match_payload payload from listings l
        cross join lateral (select rc.match_payload ${visibleRelistingCandidateSql}) candidate
        where l.city=any($3::text[])
      )
      select (select count(*)::int from matches) total,
        coalesce(jsonb_agg(page.payload order by (page.payload->>'confidenceScore')::int desc,
          page.payload->'current'->>'id',page.payload->'previous'->>'id'),'[]'::jsonb) items
      from (select * from matches order by (payload->>'confidenceScore')::int desc,
        payload->'current'->>'id',payload->'previous'->>'id' limit $1 offset $2) page`,
      values,
    ),
  ]);
  const [linked, potential] = queries.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value.rows[0];
  });
  await addRelistingPreviews([...linked.items, ...potential.items], db);
  return {
    matched: linked.total,
    items: linked.items,
    potentialCount: potential.total,
    potentialItems: potential.items,
  };
}

export async function addRelistingPreviews(
  items: RelistedListingMatch[],
  db: Pick<Pool, "query"> = pool,
) {
  const previews = await getDuplicateListingPreviews(
    [...new Set(items.flatMap((match) => [match.previous.id, match.current.id]))],
    db,
  );
  for (const match of items)
    for (const offer of [match.previous, match.current]) {
      offer.thumbnailUrls = previews.get(offer.id)?.urls ?? [];
      offer.thumbnailSharedFromIndex = previews.get(offer.id)?.sharedFromIndex;
    }
}
