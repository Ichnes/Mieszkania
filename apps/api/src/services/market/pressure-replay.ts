import {
  makePressureFrame,
  type BuyerObservation,
  type PressureFrame,
  type SearchContract,
} from "@mieszkania/shared";
import type { Pool } from "pg";
import { canonicalWarsawDistrict } from "../geography/warsaw-neighborhoods";
import { pressureHistory, pressureScope } from "./pressure-history";
import { createStatsCache } from "./stats-cache";
import type { MarketStatsQuery } from "./market-stats";

type Event = {
  id: string;
  day: number;
  status: string;
  title: string | null;
  address: string | null;
  price: number | null;
  area: number | null;
  rooms: number | null;
};
const cached = createStatsCache<PressureFrame[]>(3600000, 5);
export function replayHistory(
  db: Pool,
  contract: SearchContract,
  query: MarketStatsQuery,
  today: number,
  days = 30,
) {
  // Older snapshots don't reliably record manual amenity overrides and building years.
  if (
    query.elevator === "true" ||
    query.garage === "true" ||
    query.storage === "true" ||
    query.directions ||
    Number(query.minYear) > 0
  )
    return Promise.resolve([]);
  const scope = "portal-v1:" + pressureScope(contract, query, days);
  return cached(scope + today, async () => {
    const saved = await pressureHistory(db, scope, today);
    if (saved.some((f) => f.day === today)) return saved.map((f) => ({ ...f, replayed: true }));
    const result =
      await db.query<Event>(`select id,floor(extract(epoch from observed)/86400)::int as day,status,title,address,price,area,rooms from (
     select listing_id id,captured_at observed,status::text,title,
       coalesce(payload_raw#>>'{jsonLd,address,addressLocality}',payload_raw#>>'{jsonLd,0,address,addressLocality}',payload_raw#>>'{jsonLd,offers,areaServed,name}','') address,
       price_amount::float8 price,area_sqm::float8 area,rooms::float8 rooms,0 priority,id event_id from listing_snapshots
     union all select listing_id,changed_at,case when event_type='removed' then 'removed' else 'active' end,null,null,null,null,null,1,id
       from price_events where event_type in ('removed','relisted')
     ) observations where observed<=now() order by observed,priority,event_id`);
    const records = new Map<string, BuyerObservation>();
    const geography = new Map<string, { district: string; warsaw: boolean }>();
    const frames: PressureFrame[] = [];
    let index = 0;
    const first = result.rows[0]?.day ?? today;
    for (
      let day = today - 30 * Math.min(24, Math.floor((today - first) / 30));
      day <= today;
      day += 30
    ) {
      while (index < result.rows.length && result.rows[index].day <= day) {
        const event = result.rows[index++];
        let r = records.get(event.id);
        if (event.title !== null) {
          const text = (event.address ?? "") + " " + event.title;
          let loc = geography.get(text);
          if (!loc) {
            const district = canonicalWarsawDistrict(text) ?? "Bez dzielnicy";
            loc = {
              district,
              warsaw: /warszaw/i.test(text) || (!event.address && district !== "Bez dzielnicy"),
            };
            geography.set(text, loc);
          }
          if (!loc.warsaw) {
            records.delete(event.id);
            continue;
          }
          if (!r) {
            r = {
              id: event.id,
              district: loc.district,
              neighborhood: "",
              start: event.day,
              end: null,
              area: 0,
              rooms: 0,
              year: null,
              market: "",
              price: 0,
              relisted: false,
              history: [],
            };
            records.set(event.id, r);
          }
          r.district = loc.district;
          r.area = event.area ?? r.area;
          r.rooms = event.rooms ?? r.rooms;
          if (event.price && event.price > 0) {
            if (r.history.at(-1)?.[1] !== event.price) r.history.push([event.day, event.price]);
            r.price = event.price;
          }
        }
        if (r) {
          if (event.status === "active") r.end = null;
          else r.end ??= event.day;
        }
      }
      const rows = [...records.values()].filter(
        (r) =>
          (r.end === null || r.end > day - days) &&
          r.price >= contract.minPrice &&
          r.price <= contract.maxPrice &&
          r.rooms >= contract.roomsMin &&
          r.area >= Math.max(contract.minArea, Number(query.minArea) || 0) &&
          (!Number(query.maxArea) || r.area <= Number(query.maxArea)),
      );
      const frame = makePressureFrame(
        rows,
        day,
        frames.find((f) => f.day === day - days),
        days,
      );
      for (const s of Object.values(frame.groups)) {
        s.values.returns = null;
        if (day - first < days - 1) {
          for (const key of Object.keys(s.values) as (keyof typeof s.values)[])
            s.values[key] = null;
        }
      }
      frames.push(frame);
    }
    if (frames.length)
      await db.query(
        `insert into market_pressure_daily(scope,day,groups) select $1,d.day,d.groups from jsonb_to_recordset($2::jsonb) as d(day int,groups jsonb) on conflict do nothing`,
        [scope, JSON.stringify(frames)],
      );
    return (await pressureHistory(db, scope, today)).map((f) => ({ ...f, replayed: true }));
  });
}
