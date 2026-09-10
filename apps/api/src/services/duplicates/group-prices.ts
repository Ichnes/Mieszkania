import type { Pool, PoolClient } from "pg";
type Db = Pick<Pool | PoolClient, "query">;

// price_amount is the shared asking price; source_price_amount preserves each portal's quote.
export async function syncDuplicateGroupPrice(db: Db, groupId: string) {
  const members = (
    await db.query<{
      id: string;
      price_amount: string | null;
      source_price_amount: string | null;
      is_primary: boolean;
      status: string;
      exclusion_reason: string | null;
      source_label: string;
      canonical_url: string;
    }>(
      `select l.id,l.price_amount::text,l.source_price_amount::text,m.is_primary,l.status,l.exclusion_reason,
      s.name source_label,l.canonical_url from listing_duplicate_group_members m
      join listings l on l.id=m.listing_id join sources s on s.id=l.source_id
      where m.group_id=$1 order by l.id for update of l`,
      [groupId],
    )
  ).rows;
  if (!members.length) return;
  const eligible = members.filter(
    (m) => Number(m.source_price_amount) > 0 && m.exclusion_reason !== "manual_rejected",
  );
  const active = eligible.filter((m) => m.status === "active");
  const cheapest = (active.length ? active : eligible).sort(
    (a, b) =>
      Number(a.source_price_amount) - Number(b.source_price_amount) || a.id.localeCompare(b.id),
  )[0];
  if (!cheapest) return;
  const primary = members.find((m) => m.is_primary) ?? members[0];
  const previous = Number(primary.price_amount),
    next = Number(cheapest.source_price_amount);
  if (previous > 0 && previous !== next) {
    await db.query(
      `insert into price_events(listing_id,event_type,previous_price_amount,new_price_amount,source_label,source_url)
      select listing_id,$2,$3,$4,$5,$6 from listing_duplicate_group_members where group_id=$1`,
      [
        groupId,
        next < previous ? "price_drop" : "price_increase",
        previous,
        next,
        cheapest.source_label,
        cheapest.canonical_url,
      ],
    );
  }
  await db.query(
    `update listings l set price_amount=$2,price_per_sqm=$2/nullif(l.area_sqm,0)
    from listing_duplicate_group_members m where m.group_id=$1 and m.listing_id=l.id
      and (l.price_amount is distinct from $2::numeric or l.price_per_sqm is distinct from $2/nullif(l.area_sqm,0))`,
    [groupId, next],
  );
}

export async function syncListingGroupPrice(db: Db, listingId: string) {
  const groups = await db.query<{ group_id: string }>(
    "select group_id from listing_duplicate_group_members where listing_id=$1",
    [listingId],
  );
  for (const group of groups.rows) await syncDuplicateGroupPrice(db, group.group_id);
}

export async function restoreSourcePrice(db: Db, listingId: string) {
  await db.query(
    "update listings set price_amount=source_price_amount,price_per_sqm=source_price_amount/nullif(area_sqm,0) where id=$1",
    [listingId],
  );
}

export async function syncAllDuplicateGroupPrices(pool: Pool) {
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(735189241)");
    const groups = await db.query<{ id: string }>(
      "select id from listing_duplicate_groups order by id",
    );
    for (const group of groups.rows) await syncDuplicateGroupPrice(db, group.id);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}
