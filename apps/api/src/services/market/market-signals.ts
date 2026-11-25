import { observedPriceChangesCtes } from "../listings/observed-price-changes";
import type { MarketStatsResponse } from "@mieszkania/shared";
import type { Pool } from "pg";
import { marketLocationJoinSql } from "./market-locations";

export async function getMarketSignals(
  db: Pool,
  filters: string,
  periodDays: number,
  locationMapping: string,
) {
  // One row per visible offer, including only observed price changes in the chosen period.
  const result = await db.query<{
    district: string;
    active: string;
    aged: string;
    repeated: string;
    discounted: string;
    increases: string;
    relistings: string;
    fresh: string;
    observation_days: string;
    median_amount: number | null;
    median_percent: number | null;
    is_total: number;
  }>(
    `
    with recursive eligible as (
      select l.id, location.district, l.first_seen_at, l.last_seen_at
      from listings l ${marketLocationJoinSql.replace("$1", "$2")}
      where lower(l.city)='warszawa' and l.status='active' and ${filters}
    ), history as (
      select greatest(0, floor(max(extract(epoch from (now()-first_seen_at))/86400)))::int days
      from eligible
    ), ${observedPriceChangesCtes("$1")}, rises as (
      select distinct listing_id from events where new_price_amount>previous_price_amount and previous_price_amount>0
    ), cuts as (
      select listing_id, count(*) over (partition by listing_id) cut_count,
        previous_price_amount-new_price_amount amount,
        100.0*(previous_price_amount-new_price_amount)/previous_price_amount percent,
        relisting, row_number() over (partition by listing_id order by changed_at desc,relisting,tie desc) position
      from events where previous_price_amount > new_price_amount and new_price_amount > 0
    )
    select coalesce(nullif(trim(e.district),''),'Bez dzielnicy') district,
      grouping(e.district) is_total, count(*)::text active,
      count(*) filter (where e.first_seen_at <= now()-make_interval(days => (select days from history)))::text aged,
      floor(max(extract(epoch from (now()-e.first_seen_at))/86400))::text observation_days,
      count(*) filter (where c.cut_count >= 2)::text repeated,
      count(rises.listing_id)::text increases, count(c.listing_id)::text discounted, count(*) filter (where c.relisting)::text relistings,
      count(*) filter (where e.last_seen_at >= now()-interval '48 hours')::text fresh,
      percentile_cont(0.5) within group (order by c.amount) median_amount,
      percentile_cont(0.5) within group (order by c.percent) median_percent
    from eligible e left join cuts c on c.listing_id=e.id and c.position=1
    left join rises on rises.listing_id=e.id
    group by grouping sets ((e.district), ())
  `,
    [periodDays, locationMapping],
  );
  const total = result.rows.find((row) => row.is_total === 1);
  const signals: NonNullable<MarketStatsResponse["signals"]> = {
    active: Number(total?.active ?? 0),
    oldestObserved: Number(total?.aged ?? 0),
    observationDays: Math.max(0, Number(total?.observation_days ?? 0)),
    repeatedCuts: Number(total?.repeated ?? 0),
    relistingDiscounted: Number(total?.relistings ?? 0),
    discounted: Number(total?.discounted ?? 0),
    freshLast48Hours: Number(total?.fresh ?? 0),
    medianCutAmount: total?.median_amount == null ? null : Number(total.median_amount),
    medianCutPercent: total?.median_percent == null ? null : Number(total.median_percent),
    pressureDistricts: result.rows
      .filter((row) => !row.is_total && Number(row.active) >= 5 && Number(row.discounted) > 0)
      .map((row) => ({
        district: row.district,
        active: Number(row.active),
        discounted: Number(row.discounted),
        sharePercent: Math.round((Number(row.discounted) / Number(row.active)) * 1000) / 10,
      }))
      .sort((a, b) => b.sharePercent - a.sharePercent)
      .slice(0, 3),
  };

  const changesByDistrict = new Map(
    result.rows
      .filter((row) => !row.is_total)
      .map(
        (row) =>
          [
            row.district,
            { drops: Number(row.discounted), increases: Number(row.increases) },
          ] as const,
      ),
  );
  return { signals, changesByDistrict };
}
