export const dashboardPeriods = [7, 30, 60] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];
export type DashboardPeriodCounts = { days7: string; days30: string; days60: string };
export type DashboardBaseline = {
  active_count: string;
  average: string | null;
  has_history: boolean;
};

export const dashboardNewListingsSql = `
  select
    count(*) filter (where l.first_seen_at >= now() - interval '7 days')::text as days7,
    count(*) filter (where l.first_seen_at >= now() - interval '30 days')::text as days30,
    count(*)::text as days60
  from listings l
  where l.status = 'active'
    and l.city = $1
    and l.hidden_duplicate_of_id is null
    and coalesce(l.rooms, 0) <> 2
    and (l.price_amount is null or l.price_amount <= $2)
    and (l.area_sqm is null or l.area_sqm >= $3)
    and l.first_seen_at >= now() - interval '60 days'
`;

export const dashboardBaselineSql = `
  with cutoff as (
    select now() - make_interval(days => $4::int) as at
  ),
  historical as (
    select
      l.*,
      coalesce(
        (
          select pe.previous_price_amount
          from price_events pe, cutoff
          where pe.listing_id = l.id and pe.changed_at > cutoff.at
          order by pe.changed_at asc
          limit 1
        ),
        l.price_amount
      ) as historical_price
    from listings l, cutoff
    where l.first_seen_at <= cutoff.at
      and (l.removed_at is null or l.removed_at > cutoff.at)
      and (l.hidden_at is null or l.hidden_at > cutoff.at)
  )
  select
    count(*) filter (
      where history.city = $1
        and coalesce(history.rooms, 0) <> 2
        and (history.historical_price is null or history.historical_price <= $2)
        and (history.area_sqm is null or history.area_sqm >= $3)
    )::text as active_count,
    round(avg(history.historical_price / nullif(history.area_sqm, 0)) filter (
      where lower(history.city) = 'warszawa'
        and coalesce(history.rooms, 0) <> 2
        and history.historical_price > 0
        and history.historical_price <= $2
        and history.area_sqm >= $3
    ))::text as average,
    exists (select 1 from historical) as has_history
  from historical history
`;
