import {
  makePressureFrame,
  type BuyerObservation,
  type PressureFrame,
  type SearchContract,
} from "@mieszkania/shared";
import type { Pool } from "pg";
import { createHash } from "node:crypto";
import type { MarketStatsQuery } from "./market-stats";
export function pressureScope(contract: SearchContract, query: MarketStatsQuery = {}, days = 30) {
  const scope = [
    contract.city,
    contract.roomsMin,
    contract.minPrice,
    contract.maxPrice,
    Math.max(contract.minArea, Number(query.minArea) || 0),
    Number(query.maxArea) || 0,
    Number(query.minYear) || 0,
    query.elevator === "true",
    query.garage === "true",
    query.storage === "true",
    query.directions?.split(",").filter(Boolean).sort() ?? [],
  ];
  if (days !== 30) scope.push(days);
  return createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}
export async function pressureHistory(
  db: Pool,
  scope: string,
  day: number,
): Promise<PressureFrame[]> {
  const result = await db.query<PressureFrame>(
    "select day,groups from market_pressure_daily where scope=$1 and day between $2::int-720 and $2::int and mod($2::int-day,30)=0 order by day",
    [scope, day],
  );
  return result.rows;
}
export async function recordPressure(
  db: Pool,
  scope: string,
  day: number,
  rows: BuyerObservation[],
  days = 30,
) {
  const frames = await pressureHistory(db, scope, day);
  if (frames.some((f) => f.day === day)) return frames;
  const frame = makePressureFrame(
    rows,
    day,
    frames.find((f) => f.day === day - days),
    days,
  );
  const inserted = await db.query(
    "insert into market_pressure_daily(scope,day,groups) values($1,$2,$3) on conflict do nothing",
    [scope, day, JSON.stringify(frame.groups)],
  );
  return inserted.rowCount ? [...frames, frame] : pressureHistory(db, scope, day);
}
