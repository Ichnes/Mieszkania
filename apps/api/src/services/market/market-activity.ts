/** Weekly stock uses prices known at the end of that week, not only newly found offers. */
export function marketActivitySql(filters: string, periodDays: number) {
  return `
    with weeks as (
      select w, least(w + interval '1 week', now()) cutoff
      from generate_series(date_trunc('week', current_date - make_interval(days => ${periodDays - 1})), date_trunc('week', current_date), interval '1 week') w
    ), scoped as materialized (
      select l.* from listings l where lower(l.city)='warszawa' and ${filters}
    )
    select to_char(w.w::date, 'YYYY-MM-DD') week,
      count(l.id) filter (where l.first_seen_at >= w.w and l.first_seen_at < w.cutoff)::text new_listings,
      count(l.id) filter (where l.removed_at >= w.w and l.removed_at < w.cutoff)::text archived_listings,
      percentile_cont(0.5) within group (order by l.price_amount/nullif(l.area_sqm,0))
        filter (where l.first_seen_at >= w.w and l.first_seen_at < w.cutoff and l.price_amount>0 and l.area_sqm>0)::text median_price,
      round(avg(h.price/nullif(l.area_sqm,0)) filter (
        where (l.removed_at is null or l.removed_at >= w.cutoff)
          and (l.status='active' or l.removed_at is not null)
          and h.price>0 and l.area_sqm>0
      ))::text average_price
    from weeks w
    left join scoped l on l.first_seen_at < w.cutoff
    left join lateral (
      select coalesce(
        (select pe.new_price_amount from price_events pe where pe.listing_id=l.id
          and pe.changed_at < w.cutoff and pe.new_price_amount>0
          order by pe.changed_at desc, pe.id desc limit 1),
        (select pe.previous_price_amount from price_events pe where pe.listing_id=l.id
          and pe.changed_at >= w.cutoff and pe.previous_price_amount>0
          order by pe.changed_at, pe.id limit 1),
        l.price_amount
      ) price
    ) h on true
    group by w.w order by w.w`;
}
