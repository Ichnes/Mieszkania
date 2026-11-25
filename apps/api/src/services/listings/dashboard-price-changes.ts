import { observedPriceChangesCtes } from "./observed-price-changes";

export function changedListingsSql(eligible: string, daysSql?: string) {
  return `with recursive eligible as (${eligible}), ${observedPriceChangesCtes(daysSql)}
    select distinct on (listing_id) listing_id,changed_at,previous_price_amount,new_price_amount,relisting,
      case when new_price_amount<previous_price_amount then 'price_drop' else 'price_increase' end event_type from events
    where previous_price_amount>0 and new_price_amount>0 and previous_price_amount<>new_price_amount
    order by listing_id,changed_at desc,relisting,tie desc`;
}

export const dashboardPriceChangesSql = `
  select count(*) filter(where changed_at >= now()-interval '7 days')::text days7,
    count(*) filter(where changed_at >= now()-interval '30 days')::text days30,
    count(*)::text days60 from (${changedListingsSql(
      `select id from listings l where l.status='active' and l.city=$1 and l.hidden_duplicate_of_id is null
      and coalesce(l.rooms,0)<>2 and (l.price_amount is null or l.price_amount <= $2)
      and (l.area_sqm is null or l.area_sqm >= $3)`,
      "60",
    )}) changes`;
