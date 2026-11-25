import type { MarketStatsResponse } from "@mieszkania/shared";
import type { Pool } from "pg";
import { marketLocationJoinSql, normalizeMarketLocation } from "./market-locations";
import { compareListings } from "@mieszkania/shared";
import { pool } from "../../db";
import { pressureHistory, pressureScope } from "./pressure-history";
import { replayHistory } from "./pressure-replay";
import { getFamilySettings } from "../settings/family-settings";
import { calibratedPressure, pressureKey } from "@mieszkania/shared";
import { inferFinishQuality } from "../listings/listing-repository";

export async function getBuyerMarket(
  db: Pool,
  filters: string,
  mapping: string,
  days: number,
  targetId?: string,
) {
  type Observation = NonNullable<MarketStatsResponse["buyerMarket"]>["observations"][number];
  const observations = await db.query<Observation & { description: string | null }>(
    `
    select l.id, location.district, location.neighborhood, l.rooms::float8 rooms,l.floor,l.description,
      array(select distinct s.name from listings member join sources s on s.id=member.source_id
        where (member.id=l.id or member.hidden_duplicate_of_id=l.id)
        and coalesce(member.exclusion_reason,'')<>'manual_rejected') portals,
      l.area_sqm::float8 as area, l.year_built as "year", l.market_type as market,
      l.price_amount::float8 as price, floor(extract(epoch from l.first_seen_at)/86400)::int as "start",
      case when l.status='removed' then floor(extract(epoch from l.removed_at)/86400)::int end as "end",
      exists(select 1 from listing_relisting_reviews r where r.current_listing_id=l.id
        and r.decision='confirmed') relisted,
      coalesce((select jsonb_agg(jsonb_build_array(floor(extract(epoch from pe.changed_at)/86400)::int,
        pe.new_price_amount) order by pe.changed_at,pe.id) from price_events pe where pe.listing_id=l.id
        and pe.event_type in ('created','price_drop','price_increase','relisted') and pe.new_price_amount>0
        and pe.changed_at<=now() and (pe.snapshot_id is not null or pe.source_url is null)),'[]'::jsonb) history
    from listings l ${marketLocationJoinSql}
    where lower(l.city)='warszawa' and ${filters} and l.first_seen_at<=now()
      and (l.id=$3::uuid or l.status='active' or (l.status='removed' and l.removed_at>=now()-make_interval(days=>$2)
      and l.removed_at>=l.first_seen_at))
    order by l.id`,
    [mapping, days, targetId ?? null],
  );
  return {
    today: Math.floor(Date.now() / 86400000),
    observations: observations.rows.map(({ description, ...row }) => ({
      ...row,
      finish: inferFinishQuality(description),
    })),
  };
}
export async function getOfferComparison(id: string) {
  const locations = await pool.query(
    "select distinct district, neighborhood from listings where lower(city)='warszawa'",
  );
  const mapping = JSON.stringify(
    locations.rows.map((r) =>
      normalizeMarketLocation({ district: r.district, neighborhood: r.neighborhood }),
    ),
  );
  const data = await getBuyerMarket(
    pool,
    `(l.id=$3 or (l.status='active' and l.hidden_duplicate_of_id is null
    and coalesce(l.exclusion_reason,'')<>'manual_rejected' and exists(select 1 from listings target where target.id=$3
    and l.id<>coalesce(target.hidden_duplicate_of_id,target.id) and l.rooms=target.rooms and l.market_type=target.market_type
    and l.area_sqm between target.area_sqm*.85 and target.area_sqm*1.15)))`,
    mapping,
    0,
    id,
  );
  const target = data.observations.find((r) => r.id === id);
  if (!target) return null;
  const settings = await getFamilySettings();
  const history = await pressureHistory(pool, pressureScope(settings.searchContract), data.today);
  const replay = await replayHistory(pool, settings.searchContract, {}, data.today);
  const pressure = calibratedPressure([...history, ...replay], pressureKey(), data.today);
  return {
    ...compareListings(data.observations, data.today, target)[0],
    marketIndex: {
      score: pressure.score,
      coverage: pressure.coverage,
      months: pressure.months,
      preliminary: pressure.preliminary,
    },
  };
}
