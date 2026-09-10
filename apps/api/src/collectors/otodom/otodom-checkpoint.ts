import { createHash } from "node:crypto";
import type { SearchContract } from "@mieszkania/shared";
import { withDb } from "../../db";
import { buildSearchUrls } from "./otodom-discovery";

export type OtodomCheckpoint = {
  nextPage: number;
  endPage: number;
  updatedAt: string;
  error?: string;
};

export function checkpointKey(city: string, contract: SearchContract) {
  const normalized = { ...contract, districts: [...(contract.districts ?? [])].sort() };
  const url = buildSearchUrls(city.trim().toLowerCase(), 1, normalized)[0];
  return `otodom-scan:${createHash("sha256").update(url).digest("hex")}`;
}

export async function readCheckpoint(key: string): Promise<OtodomCheckpoint | null> {
  return withDb(async (db) => {
    const result = await db.query<{ value: OtodomCheckpoint }>(
      "select value from app_settings where key = $1",
      [key],
    );
    return result.rows[0]?.value ?? null;
  });
}

export async function saveCheckpoint(key: string, value: OtodomCheckpoint | null) {
  await withDb(async (db) => {
    if (!value) {
      await db.query("delete from app_settings where key = $1", [key]);
    } else {
      await db.query(
        "insert into app_settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value",
        [key, JSON.stringify(value)],
      );
    }
  });
}
