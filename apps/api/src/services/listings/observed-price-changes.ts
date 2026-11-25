/** Requires WITH RECURSIVE eligible(id). Bind the period as a SQL parameter or literal. */
export function observedPriceChangesCtes(daysSql?: string) {
  const cutoff = daysSql ? `now()-make_interval(days => ${daysSql})` : "'-infinity'::timestamptz";
  return `periods(root,id,until_at,closing_price,successor_price) as (
      select id,id,'infinity'::timestamptz,null::numeric,null::numeric from eligible
      union all
      select p.root,prior.id,opening.captured_at,prior.price_amount::numeric,opening.price_amount::numeric
      from periods p
      cross join lateral (
        select captured_at,price_amount from listing_snapshots where listing_id=p.id order by captured_at,id limit 1
      ) opening
      cross join lateral (
        select r.previous_listing_id id,last_price.price_amount from listing_relisting_reviews r
        cross join lateral (
          select captured_at,price_amount from listing_snapshots where listing_id=r.previous_listing_id
            and captured_at<opening.captured_at and price_amount>0 order by captured_at desc,id desc limit 1
        ) last_price
        where r.current_listing_id=p.id and r.decision='confirmed'
        order by last_price.captured_at desc,r.previous_listing_id limit 1
      ) prior
      where opening.captured_at<=now() and opening.captured_at < p.until_at and opening.captured_at >= ${cutoff}
    ), samples as (
      select p.root,s.id,s.listing_id,s.captured_at,s.price_amount,
        lag(s.price_amount) over(partition by p.root,p.id order by s.captured_at,s.id) previous
      from periods p join listing_snapshots s on s.listing_id=p.id
      where s.captured_at<=now() and s.captured_at<p.until_at and s.price_amount>0
    ), events as (
      select p.root listing_id,pe.changed_at,pe.previous_price_amount,pe.new_price_amount,
        pe.id tie,(pe.event_type='relisted') relisting
      from price_events pe join periods p on p.id=pe.listing_id
      where pe.event_type in ('price_drop','price_increase','relisted') and pe.changed_at >= ${cutoff}
        and pe.changed_at<=now() and pe.changed_at<p.until_at and (pe.snapshot_id is not null or pe.source_url is null)
      union all
      select s.root,s.captured_at,s.previous,s.price_amount,null,false from samples s
      where s.previous<>s.price_amount and s.captured_at >= ${cutoff}
        and not exists(select 1 from price_events pe where pe.snapshot_id=s.id
          and pe.event_type in ('price_drop','price_increase','relisted') and pe.previous_price_amount<>pe.new_price_amount)
      union all
      select root,until_at,closing_price,successor_price,null,true from periods where id<>root
    )`;
}
