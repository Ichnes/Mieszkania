import { createHash } from "node:crypto";
import { pool } from "../../db";
import { waitForNominatimSlot } from "./geocoding";

export async function searchWorkplaceAddress(address: string) {
  const query = address.trim();
  if (query.length < 5 || query.length > 250)
    throw new Error("Wpisz ulicę, numer budynku i miejscowość (5–250 znaków).");
  const key = `workplace-search:${createHash("sha256").update(query.toLowerCase()).digest("hex")}`;
  const cached = await pool.query(
    "select value from app_settings where key = $1 and updated_at > now() - interval '30 days'",
    [key],
  );
  if (cached.rows[0]) return cached.rows[0].value;
  const url = new URL(
    "search",
    process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org/",
  );
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "pl",
  }).toString();
  await waitForNominatimSlot();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent": process.env.NOMINATIM_USER_AGENT ?? "mieszkania-local-app/0.1",
      "accept-language": "pl",
      accept: "application/json",
    },
  });
  if (!response.ok)
    throw new Error(
      "Wyszukiwarka adresów jest chwilowo niedostępna. Wskaż punkt na mapie lub spróbuj później.",
    );
  const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const results = rows
    .map((row) => ({
      latitude: Number(row.lat),
      longitude: Number(row.lon),
      label: row.display_name,
    }))
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
  await pool.query(
    "insert into app_settings (key,value) values ($1,$2::jsonb) on conflict (key) do update set value=excluded.value, updated_at=now()",
    [key, JSON.stringify(results)],
  );
  return results;
}
