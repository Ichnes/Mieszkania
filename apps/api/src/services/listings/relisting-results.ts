import type {
  ListingRelistingHistory,
  RelistedListingMatch,
  RelistedListingsResponse,
  RelistingSort,
} from "@mieszkania/shared";
import type { Pool } from "pg";
import { pool } from "../../db";
import { activeRegion } from "../../domain/region";
import { getDuplicateListingPreviews } from "../media/listing-preview";
import { getRelatedListings } from "../duplicates/listing-duplicates";
import { visibleRelistingCandidateSql } from "./listing-relistings";

const establishedRelistingSql = `
  select jsonb_build_object(
    'manuallyConfirmed', exists(select 1 from listing_relisting_reviews review
      where review.current_listing_id=l.id and review.previous_listing_id=archived.id and review.decision='confirmed'),
    'previous', jsonb_strip_nulls(jsonb_build_object(
      'id',archived.id,'title',archived.title,'sourceLabel',previous_source.name,'firstSeenAt',archived.first_seen_at,'isActive',archived.status='active',
      'canonicalUrl',archived.canonical_url,'priceAmount',relation.previous_price_amount,
      'eventAt',coalesce(archived.removed_at,archived.last_seen_at),
      'addressText',archived.address_text,'areaSqm',archived.area_sqm,'rooms',archived.rooms,'floor',archived.floor)),
    'current', jsonb_strip_nulls(jsonb_build_object(
      'id',l.id,'title',l.title,'sourceLabel',current_source.name,'firstSeenAt',l.first_seen_at,'isActive',l.status='active',
      'canonicalUrl',l.canonical_url,'priceAmount',relation.relisted_price_amount,
      'eventAt',l.first_seen_at,'addressText',l.address_text,'areaSqm',l.area_sqm,'rooms',l.rooms,'floor',l.floor)),
    'priceDifferenceAmount',relation.relisted_price_amount-relation.previous_price_amount,
    'priceDifferencePercent',100*(relation.relisted_price_amount-relation.previous_price_amount)/nullif(relation.previous_price_amount,0),
    'confidenceScore',relation.confidence_score,'reasons',string_to_array(relation.reason_summary,', ')
  ) payload, l.first_seen_at, l.status as current_status, archived.status as previous_status,
    l.hidden_duplicate_of_id as current_primary_id, archived.hidden_duplicate_of_id as previous_primary_id,
    archived.exclusion_reason as previous_exclusion_reason
  from listing_relistings relation
  join listings l on l.id=relation.current_listing_id
  join listings archived on archived.id=relation.previous_listing_id
  join sources current_source on current_source.id=l.source_id
  join sources previous_source on previous_source.id=archived.source_id
`;

const currentRelistingSql = `
  ${establishedRelistingSql}
  where l.status='active' and l.hidden_duplicate_of_id is null
    and archived.status='removed' and archived.hidden_duplicate_of_id is distinct from l.id
    and coalesce(archived.exclusion_reason,'') <> 'manual_rejected'
`;

export async function getEstablishedRelistingMatch(
  currentId: string,
  previousId: string,
  db: Pick<Pool, "query"> = pool,
) {
  const result = await db.query<{ payload: RelistedListingMatch }>(
    `select jsonb_strip_nulls(match.payload) payload from (
      ${currentRelistingSql} and l.id=$1 and archived.id=$2
    ) match`,
    [currentId, previousId],
  );
  return result.rows[0]?.payload;
}

export async function getListingRelistingHistory(listingId: string) {
  const { rows } = await pool.query<{ payload: RelistedListingMatch; reviewable: boolean }>(
    `select jsonb_strip_nulls(history.payload) as payload,
      history.current_status='active' and history.previous_status='removed'
        and history.current_primary_id is null and history.previous_primary_id is distinct from (history.payload->'current'->>'id')::uuid
        and coalesce(history.previous_exclusion_reason,'') <> 'manual_rejected' as reviewable
      from (${establishedRelistingSql}
        join listings focus on focus.id=$1
        where coalesce(focus.hidden_duplicate_of_id,focus.id) in (
          coalesce(l.hidden_duplicate_of_id,l.id), coalesce(archived.hidden_duplicate_of_id,archived.id)
        )
      ) history
      order by (history.payload->'previous'->>'eventAt')::timestamptz desc, history.payload->'previous'->>'id'`,
    [listingId],
  );
  return rows.map(({ payload, reviewable }) => ({ ...payload, reviewable }));
}

export async function addRelistingArchiveCopies(
  items: Array<RelistedListingMatch & Partial<Pick<ListingRelistingHistory, "archiveCopies">>>,
) {
  const copies = new Map<string, ReturnType<typeof getRelatedListings>>();
  await Promise.all(
    items.map(async (item) => {
      let archiveCopies = copies.get(item.previous.id);
      if (!archiveCopies) {
        archiveCopies = getRelatedListings(item.previous.id);
        copies.set(item.previous.id, archiveCopies);
      }
      item.archiveCopies = await archiveCopies;
    }),
  );
}

// Read saved relations without rerunning the matching algorithm or changing user decisions.
export async function getRelistingResults(
  limit = 20,
  offset = 0,
  db: Pick<Pool, "query"> = pool,
  sort?: string,
  grouped = false,
): Promise<RelistedListingsResponse> {
  const values = [
    Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 100)) : 20,
    Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0,
    activeRegion.supportedCities,
  ];
  type Page = { total: number; items: RelistedListingMatch[] };
  const orderBy: Record<RelistingSort, string> = {
    newest: "(payload->'current'->>'eventAt')::timestamptz desc nulls last",
    oldest: "(payload->'current'->>'eventAt')::timestamptz asc nulls last",
    confidence: "(payload->>'confidenceScore')::int desc nulls last",
    price_change: "abs((payload->>'priceDifferencePercent')::numeric) desc nulls last",
    price_drop: "(payload->>'priceDifferencePercent')::numeric asc nulls last",
  };
  const order = sort && Object.hasOwn(orderBy, sort) ? orderBy[sort as RelistingSort] : undefined;
  if (grouped) {
    const result = await db.query<{ payload: RelistedListingMatch; reviewable: boolean }>(
      `
      select jsonb_strip_nulls(payload) payload, current_status='active' as reviewable
      from (${establishedRelistingSql}
        where l.city=any($1::text[]) and l.status in ('active','removed')
          and l.hidden_duplicate_of_id is null and archived.status='removed'
          and archived.hidden_duplicate_of_id is distinct from l.id
          and coalesce(archived.exclusion_reason,'') <> 'manual_rejected'
          and coalesce(l.exclusion_reason,'') <> 'manual_rejected'
      ) matches order by ${order ?? orderBy.newest}, payload->'current'->>'id', payload->'previous'->>'id'
    `,
      [activeRegion.supportedCities],
    );
    const all = groupRelistings(
      result.rows.map((row) => ({ ...row.payload, reviewable: row.reviewable })),
    );
    const start = Number(values[1]);
    const page = all.slice(start, start + Number(values[0]));
    await addRelistingPreviews(page.flat(), db);
    return {
      matched: result.rows.length,
      items: [],
      potentialCount: 0,
      potentialItems: [],
      groups: page,
      groupCount: all.length,
    };
  }
  const readPage = (matches: string, defaultOrder: RelistingSort) =>
    db.query<Page>(
      `with matches as materialized (${matches}), page as (
       select payload, row_number() over (
         order by ${order ?? orderBy[defaultOrder]}, payload->'current'->>'id', payload->'previous'->>'id'
       ) as position from matches order by position limit $1 offset $2
     )
     select (select count(*)::int from matches) as total,
       coalesce(jsonb_agg(jsonb_strip_nulls(page.payload) order by position),'[]'::jsonb) as items
     from page`,
      values,
    );
  const queries = await Promise.allSettled([
    readPage(`${currentRelistingSql} and l.city=any($3::text[])`, "newest"),
    readPage(
      `select candidate.match_payload payload from listings l
        cross join lateral (select rc.match_payload ${visibleRelistingCandidateSql}) candidate
        where l.city=any($3::text[])`,
      "confidence",
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

export function groupRelistings(matches: RelistedListingMatch[]) {
  const neighbors = new Map<string, Set<string>>();
  for (const { previous, current } of matches) {
    for (const [a, b] of [
      [previous.id, current.id],
      [current.id, previous.id],
    ]) {
      const links = neighbors.get(a) ?? new Set<string>();
      links.add(b);
      neighbors.set(a, links);
    }
  }
  const membership = new Map<string, RelistedListingMatch[]>();
  const groups: RelistedListingMatch[][] = [];
  for (const match of matches) {
    let group = membership.get(match.current.id);
    if (!group) {
      group = [];
      groups.push(group);
      const pending = [match.current.id];
      while (pending.length) {
        const id = pending.pop()!;
        if (membership.has(id)) continue;
        membership.set(id, group);
        for (const next of neighbors.get(id) ?? []) pending.push(next);
      }
    }
    group.push(match);
  }
  return groups;
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
