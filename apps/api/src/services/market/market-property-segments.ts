import type { Pool } from "pg";
import type { MarketSegment } from "@mieszkania/shared";
import { extractFeaturesFromPayload, inferFinishQuality } from "../listings/listing-repository";
import { marketSnapshotPayloadSql } from "./market-snapshot";
import { mapPriceSample } from "./market-sample";

export type PropertySegmentRow = {
  description: string | null;
  payload_raw: Record<string, unknown> | null;
  price_amount: string | null;
  area_sqm: string | null;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .toLowerCase();

export function readMonthlyFee(structured: string | undefined, description: string): number | null {
  // Only an unambiguous single amount: do not turn ranges, yearly or per-m² fees into monthly totals.
  const amount = "(\\d+(?:[ \\u00a0]\\d{3})*(?:[,.]\\d{1,2})?)";
  const structuredMatch = structured
    ?.trim()
    .match(
      new RegExp(
        `^(?:ok\\.?\\s*)?${amount}\\s*(?:(?:zł|PLN)(?:\\s*[/ ]\\s*(?:mies(?:iąc|ięcznie|\\.)?|msc))?)?$`,
        "i",
      ),
    );
  const match =
    structuredMatch ??
    description.match(
      new RegExp(
        `\\bczynsz\\s*(?:(?:administracyjny|miesięczny|wynosi|to|około|ok\\.?|w wysokości|obecnie|aktualnie)\\s*)*[:–-]?\\s*${amount}\\s*(?:zł|PLN)(?!\\s*(?:/\\s*(?:m[²2]|rok)|rocznie))`,
        "i",
      ),
    );
  if (!match) return null;
  const value = Number(match[1].replace(/[ \u00a0]/g, "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function classifyProperty(row: PropertySegmentRow) {
  const description = row.description ?? "";
  const features = extractFeaturesFromPayload(row.payload_raw ?? undefined);
  const finish = normalize(features.find((f) => f.key === "finish_quality")?.value ?? "");
  const quality =
    /do wykonczenia|dewelopersk|to_finish|to_completion|do remontu|to_renovation/.test(finish)
      ? "to_finish"
      : /gotow|do zamieszkania|wykonczon|ready|to_use/.test(finish)
        ? "ready"
        : inferFinishQuality(description);
  const fee = readMonthlyFee(
    features.find((f) => f.key === "fees" && f.source === "payload")?.value,
    description,
  );
  return {
    finish:
      quality === "ready"
        ? "Wykończone / do zamieszkania"
        : quality === "to_finish"
          ? "Do wykończenia / remontu"
          : "Brak danych o stanie",
    fee:
      fee == null
        ? "Brak danych o czynszu"
        : fee === 0
          ? "0 zł"
          : fee < 500
            ? "Poniżej 500 zł"
            : fee < 1000
              ? "500–<1000 zł"
              : fee < 1500
                ? "1000–<1500 zł"
                : "1500 zł i więcej",
  };
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const index = (values.length - 1) * fraction,
    lower = Math.floor(index);
  return String(values[lower] + (values[Math.ceil(index)] - values[lower]) * (index - lower));
}

export function buildPropertySegments(rows: PropertySegmentRow[]) {
  const classified = rows.map((row) => ({ ...row, ...classifyProperty(row) }));
  const group = (field: "finish" | "fee", labels: string[]): MarketSegment[] =>
    labels.flatMap((label) => {
      const members = classified.filter((row) => row[field] === label);
      if (!members.length) return [];
      const prices = members
        .filter((row) => Number(row.price_amount) > 0 && Number(row.area_sqm) > 0)
        .map((row) => Number(row.price_amount) / Number(row.area_sqm))
        .sort((a, b) => a - b);
      return [
        {
          label,
          count: members.length,
          sharePercent: Math.round((members.length / rows.length) * 1000) / 10,
          ...mapPriceSample({
            priced: String(prices.length),
            median_price: percentile(prices, 0.5),
            q1: percentile(prices, 0.25),
            q3: percentile(prices, 0.75),
          }),
        },
      ];
    });
  return {
    finishing: group("finish", [
      "Wykończone / do zamieszkania",
      "Do wykończenia / remontu",
      "Brak danych o stanie",
    ]),
    monthlyFees: group("fee", [
      "0 zł",
      "Poniżej 500 zł",
      "500–<1000 zł",
      "1000–<1500 zł",
      "1500 zł i więcej",
      "Brak danych o czynszu",
    ]),
  };
}

export async function getMarketPropertySegments(db: Pool, filters: string, periodDays: number) {
  const result = await db.query<PropertySegmentRow>(`
    select l.description,l.price_amount,l.area_sqm,snapshot.payload_raw
    from listings l left join lateral (
      select ${marketSnapshotPayloadSql} payload_raw
      from listing_snapshots where listing_id=l.id order by captured_at desc limit 1
    ) snapshot on true
    where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and ${filters}
  `);
  return buildPropertySegments(result.rows);
}
