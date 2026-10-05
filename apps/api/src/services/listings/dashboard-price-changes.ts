// Count offers, not events: several price updates still represent one changed offer.
export const dashboardPriceChangesSql = `
  select
    count(distinct pe.listing_id) filter (
      where pe.changed_at >= now() - interval '7 days'
    )::text as days7,
    count(distinct pe.listing_id) filter (
      where pe.changed_at >= now() - interval '30 days'
    )::text as days30,
    count(distinct pe.listing_id)::text as days180
  from price_events pe
  join listings l on l.id = pe.listing_id
  where pe.event_type in ('price_drop', 'price_increase')
    and l.status = 'active'
    and l.city = $1
    and l.hidden_duplicate_of_id is null
    and coalesce(l.rooms, 0) <> 2
    and (l.price_amount is null or l.price_amount <= $2)
    and (l.area_sqm is null or l.area_sqm >= $3)
    and pe.changed_at >= now() - interval '180 days'
`;
