import type { Pool } from "pg";
import type { MarketStatsResponse } from "@mieszkania/shared";

export async function getMarketSignals(db: Pool, filters: string, periodDays: number): Promise<NonNullable<MarketStatsResponse["signals"]>> {
  // One row per visible offer, including only observed price changes in the chosen period.
  const result = await db.query<{
    district: string; active: string; aged: string; repeated: string; discounted: string;
    fresh: string; observation_days: string; median_amount: number | null; median_percent: number | null; is_total: number;
  }>(`
    with eligible as (
      select l.id, l.district, l.first_seen_at, l.last_seen_at
      from listings l
      where lower(l.city)='warszawa' and l.status='active' and ${filters}
    ), history as (
      select greatest(0, floor(max(extract(epoch from (now()-first_seen_at))/86400)))::int days
      from eligible
    ), cuts as (
      select pe.listing_id, count(*) over (partition by pe.listing_id) cut_count,
        pe.previous_price_amount-pe.new_price_amount amount,
        100.0*(pe.previous_price_amount-pe.new_price_amount)/pe.previous_price_amount percent,
        row_number() over (partition by pe.listing_id order by pe.changed_at desc, pe.id desc) position
      from price_events pe join eligible e on e.id=pe.listing_id
      where pe.event_type='price_drop' and pe.changed_at >= now()-make_interval(days => $1)
        and pe.previous_price_amount > pe.new_price_amount and pe.new_price_amount > 0
    )
    select coalesce(nullif(trim(e.district),''),'Bez dzielnicy') district,
      grouping(e.district) is_total, count(*)::text active,
      count(*) filter (where e.first_seen_at <= now()-make_interval(days => (select days from history)))::text aged,
      floor(max(extract(epoch from (now()-e.first_seen_at))/86400))::text observation_days,
      count(*) filter (where c.cut_count >= 2)::text repeated,
      count(c.listing_id)::text discounted,
      count(*) filter (where e.last_seen_at >= now()-interval '48 hours')::text fresh,
      percentile_cont(0.5) within group (order by c.amount) median_amount,
      percentile_cont(0.5) within group (order by c.percent) median_percent
    from eligible e left join cuts c on c.listing_id=e.id and c.position=1
    group by grouping sets ((e.district), ())
  `, [periodDays]);
  const total = result.rows.find(row => row.is_total === 1);
  return {
    active: Number(total?.active ?? 0), oldestObserved: Number(total?.aged ?? 0), observationDays: Math.max(0, Number(total?.observation_days ?? 0)),
    repeatedCuts: Number(total?.repeated ?? 0), discounted: Number(total?.discounted ?? 0),
    freshLast48Hours: Number(total?.fresh ?? 0),
    medianCutAmount: total?.median_amount == null ? null : Number(total.median_amount),
    medianCutPercent: total?.median_percent == null ? null : Number(total.median_percent),
    pressureDistricts: result.rows.filter(row => !row.is_total && Number(row.active) >= 20 && Number(row.discounted) >= 3)
      .map(row => ({ district: row.district, active: Number(row.active), discounted: Number(row.discounted), sharePercent: Math.round(Number(row.discounted) / Number(row.active) * 1000) / 10 }))
      .sort((a, b) => b.sharePercent - a.sharePercent).slice(0, 3)
  };
}
