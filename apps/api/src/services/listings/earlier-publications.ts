import type { ListingDetail } from "@mieszkania/shared";
import type { Pool } from "pg";

export async function getEarlierPublications(db: Pick<Pool, "query">, listingId: string) {
  // Follow group membership and established predecessors only. UNION also terminates cycles.
  const { rows } = await db.query<{
    id: string;
    source: string;
    known_since: Date;
    date_origin: "portal" | "first_seen";
  }>(
    `
    with recursive history(id) as (
      select id from listings where id = $1
      union
      select next_listing.id
      from history h
      cross join lateral (
        select peer.listing_id as id
        from listing_duplicate_group_members member
        join listing_duplicate_group_members peer using (group_id)
        where member.listing_id = h.id
        union all
        select previous_listing_id from listing_relistings where current_listing_id = h.id
      ) edge
      join listings next_listing on next_listing.id = edge.id
        and coalesce(next_listing.exclusion_reason, '') <> 'manual_rejected'
    )
    select old.id, s.name as source,
      least(old.published_at, old.first_seen_at) as known_since,
      case when old.published_at <= old.first_seen_at then 'portal' else 'first_seen' end as date_origin
    from history h
    join listings old on old.id = h.id
    join sources s on s.id = old.source_id
    join listings focus on focus.id = $1
    where old.id <> focus.id and old.status = 'removed'
      and least(old.published_at, old.first_seen_at) < least(focus.published_at, focus.first_seen_at)
    order by known_since, old.id
  `,
    [listingId],
  );
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    knownSince: row.known_since.toISOString(),
    dateOrigin: row.date_origin,
  })) satisfies NonNullable<ListingDetail["earlierPublications"]>;
}
