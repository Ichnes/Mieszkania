import type { RelistedListingMatch, RelistedListingsScanResponse } from "@mieszkania/shared";
import { withDb } from "../../db";
import { activeRegion } from "../../domain/region";

export type RelistingMatchRow = {
  id: string;
  status: "active" | "removed";
  title: string;
  sourceLabel: string;
  canonicalUrl: string | null;
  city: string;
  addressText: string | null;
  description: string | null;
  rooms: number;
  areaSqm: number;
  floor: number | null;
  latitude: number | null;
  longitude: number | null;
  priceAmount: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  removedAt: string | null;
};

type PreparedRelistingRow = RelistingMatchRow & {
  cityKey: string;
  descriptionTokens: string[];
  descriptionPrefix: string;
  addressKey: string;
  streetKey: string;
};

const descriptionPrefixWords = 30;
const descriptionSimilarityThreshold = 0.82;

export async function scanRelistedListings(limit = 100): Promise<RelistedListingsScanResponse> {
  const safeLimit = Math.max(1, Math.min(limit, 500));

  return withDb(async (db) => {
    const result = await db.query<{
      id: string;
      status: "active" | "removed";
      title: string;
      source_label: string | null;
      canonical_url: string | null;
      city: string;
      address_text: string | null;
      description: string | null;
      rooms: string;
      area_sqm: string;
      floor: number | null;
      latitude: string | null;
      longitude: string | null;
      price_amount: string | null;
      first_seen_at: string;
      last_seen_at: string;
      removed_at: string | null;
    }>(
      `
        select
          l.id,
          l.status::text,
          l.title,
          s.name as source_label,
          l.canonical_url,
          l.city,
          l.address_text,
          l.description,
          l.rooms::text,
          l.area_sqm::text,
          l.floor,
          l.latitude::text,
          l.longitude::text,
          l.price_amount::text,
          l.first_seen_at::text,
          l.last_seen_at::text,
          l.removed_at::text
        from listings l
        join sources s on s.id = l.source_id
        where l.status in ('active', 'removed')
          and l.hidden_duplicate_of_id is null
          and l.rooms is not null
          and l.area_sqm is not null
          and l.city = any($1::text[])
          and (l.status = 'active' or coalesce(l.exclusion_reason, '') <> 'manual_rejected')
      `,
      [activeRegion.supportedCities],
    );

    const rows: RelistingMatchRow[] = result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      title: row.title,
      sourceLabel: row.source_label ?? "Portal",
      canonicalUrl: row.canonical_url,
      city: row.city,
      addressText: row.address_text,
      description: row.description,
      rooms: Number(row.rooms),
      areaSqm: Number(row.area_sqm),
      floor: row.floor,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      priceAmount: row.price_amount ? Number(row.price_amount) : null,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      removedAt: row.removed_at,
    }));
    const matches = matchRelistedListingRows(rows);

    if (matches.length > 0) {
      const persistedMatches = matches.map((match) => ({
        current_listing_id: match.current.id,
        previous_listing_id: match.previous.id,
        confidence_score: match.confidenceScore,
        reason_summary: match.reasons.join(", "),
        previous_price_amount: match.previous.priceAmount ?? null,
        relisted_price_amount: match.current.priceAmount ?? null,
      }));
      await db.query(
        `
          insert into listing_relistings (
            current_listing_id,
            previous_listing_id,
            confidence_score,
            reason_summary,
            previous_price_amount,
            relisted_price_amount,
            last_detected_at
          )
          select
            match.current_listing_id,
            match.previous_listing_id,
            match.confidence_score,
            match.reason_summary,
            match.previous_price_amount,
            match.relisted_price_amount,
            now()
          from jsonb_to_recordset($1::jsonb) as match(
            current_listing_id uuid,
            previous_listing_id uuid,
            confidence_score smallint,
            reason_summary text,
            previous_price_amount numeric,
            relisted_price_amount numeric
          )
          on conflict (current_listing_id)
          do update set
            previous_listing_id = excluded.previous_listing_id,
            confidence_score = excluded.confidence_score,
            reason_summary = excluded.reason_summary,
            previous_price_amount = case
              when listing_relistings.previous_listing_id <> excluded.previous_listing_id then excluded.previous_price_amount
              else listing_relistings.previous_price_amount
            end,
            relisted_price_amount = case
              when listing_relistings.previous_listing_id <> excluded.previous_listing_id then excluded.relisted_price_amount
              else listing_relistings.relisted_price_amount
            end,
            last_detected_at = now()
        `,
        [JSON.stringify(persistedMatches)],
      );
    }

    return {
      checkedActive: rows.filter((row) => row.status === "active").length,
      checkedArchived: rows.filter((row) => row.status === "removed").length,
      matched: matches.length,
      items: matches.slice(0, safeLimit),
    };
  });
}

export function matchRelistedListingRows(rows: RelistingMatchRow[]): RelistedListingMatch[] {
  const prepared = rows.map(prepareRow);
  const active = prepared.filter((row) => row.status === "active");
  const archived = prepared.filter((row) => row.status === "removed");
  const archivedByPhysicalBucket = new Map<string, PreparedRelistingRow[]>();

  for (const row of archived) {
    const bucket = physicalBucket(row, Math.floor(row.areaSqm));
    const items = archivedByPhysicalBucket.get(bucket);
    if (items) items.push(row);
    else archivedByPhysicalBucket.set(bucket, [row]);
  }

  const matches: RelistedListingMatch[] = [];
  for (const current of active) {
    const candidates = new Map<string, PreparedRelistingRow>();
    const areaBucket = Math.floor(current.areaSqm);
    for (let bucket = areaBucket - 3; bucket <= areaBucket + 3; bucket += 1) {
      for (const previous of archivedByPhysicalBucket.get(physicalBucket(current, bucket)) ?? []) {
        candidates.set(previous.id, previous);
      }
    }

    const best = [...candidates.values()]
      .map((previous) => scoreRelisting(previous, current))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort(
        (left, right) =>
          right.confidenceScore - left.confidenceScore ||
          new Date(right.previous.eventAt).getTime() - new Date(left.previous.eventAt).getTime(),
      )[0];

    if (best) matches.push(best);
  }

  return matches.sort(
    (left, right) =>
      new Date(right.current.eventAt).getTime() - new Date(left.current.eventAt).getTime(),
  );
}

function scoreRelisting(
  previous: PreparedRelistingRow,
  current: PreparedRelistingRow,
): RelistedListingMatch | null {
  const archivedAt = previous.removedAt ?? previous.lastSeenAt;
  if (new Date(archivedAt).getTime() > new Date(current.firstSeenAt).getTime()) return null;
  if (new Date(previous.firstSeenAt).getTime() >= new Date(current.firstSeenAt).getTime())
    return null;

  const areaDifference = Math.abs(previous.areaSqm - current.areaSqm);
  if (areaDifference > 3 || previous.rooms !== current.rooms) return null;

  const exactPrefix = Boolean(
    previous.descriptionPrefix && previous.descriptionPrefix === current.descriptionPrefix,
  );
  const descriptionSimilarity = computeDescriptionSimilarity(
    previous.descriptionTokens,
    current.descriptionTokens,
  );
  const sameAddress = Boolean(previous.addressKey && previous.addressKey === current.addressKey);
  const sameStreet = Boolean(previous.streetKey && previous.streetKey === current.streetKey);
  const sameFloor =
    previous.floor !== null && current.floor !== null && previous.floor === current.floor;
  const nearbyCoordinates = areCoordinatesNearby(previous, current);

  const strongPrefixMatch = exactPrefix && (areaDifference <= 1 || sameStreet || nearbyCoordinates);
  const strongSimilarityMatch =
    descriptionSimilarity >= descriptionSimilarityThreshold &&
    areaDifference <= 1 &&
    sameStreet &&
    (sameAddress || sameFloor || nearbyCoordinates);
  if (!strongPrefixMatch && !strongSimilarityMatch) return null;

  let confidenceScore = exactPrefix ? 78 : 68;
  const reasons: string[] = [];
  if (exactPrefix) reasons.push(`identyczne pierwsze ${descriptionPrefixWords} słów opisu`);
  else reasons.push(`${Math.round(descriptionSimilarity * 100)}% wspólnych słów opisu`);
  if (areaDifference <= 0.5) {
    confidenceScore += 8;
    reasons.push("ten sam metraż");
  } else if (areaDifference <= 1) {
    confidenceScore += 6;
    reasons.push("niemal ten sam metraż");
  } else {
    confidenceScore += 3;
    reasons.push("podobny metraż");
  }
  if (sameAddress) {
    confidenceScore += 8;
    reasons.push("ten sam adres");
  } else if (sameStreet) {
    confidenceScore += 4;
    reasons.push("ta sama ulica");
  }
  if (sameFloor) {
    confidenceScore += 4;
    reasons.push("to samo piętro");
  }
  if (nearbyCoordinates) {
    confidenceScore += 5;
    reasons.push("ten sam punkt na mapie");
  }
  confidenceScore = Math.min(100, confidenceScore);

  const previousPrice = previous.priceAmount ?? undefined;
  const currentPrice = current.priceAmount ?? undefined;
  const priceDifferenceAmount =
    previousPrice !== undefined && currentPrice !== undefined
      ? currentPrice - previousPrice
      : undefined;
  const priceDifferencePercent =
    priceDifferenceAmount !== undefined && previousPrice && previousPrice > 0
      ? (priceDifferenceAmount / previousPrice) * 100
      : undefined;

  return {
    previous: {
      id: previous.id,
      title: previous.title,
      sourceLabel: previous.sourceLabel,
      canonicalUrl: previous.canonicalUrl ?? undefined,
      priceAmount: previousPrice,
      eventAt: archivedAt,
    },
    current: {
      id: current.id,
      title: current.title,
      sourceLabel: current.sourceLabel,
      canonicalUrl: current.canonicalUrl ?? undefined,
      priceAmount: currentPrice,
      eventAt: current.firstSeenAt,
    },
    priceDifferenceAmount,
    priceDifferencePercent,
    confidenceScore,
    reasons,
  };
}

function prepareRow(row: RelistingMatchRow): PreparedRelistingRow {
  const prefixTokens = normalizeWords(row.description);
  return {
    ...row,
    cityKey: normalizeCompact(row.city),
    descriptionTokens: tokenizeDescription(row.description),
    descriptionPrefix:
      prefixTokens.length >= descriptionPrefixWords
        ? prefixTokens.slice(0, descriptionPrefixWords).join(" ")
        : "",
    addressKey: normalizeCompact(row.addressText),
    streetKey: normalizeCompact(row.addressText?.split(",", 1)[0]),
  };
}

function physicalBucket(row: Pick<PreparedRelistingRow, "cityKey" | "rooms">, areaBucket: number) {
  return `${row.cityKey}:${row.rooms}:${areaBucket}`;
}

function normalizeWords(value?: string | null) {
  if (!value) return [];
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeCompact(value?: string | null) {
  return normalizeWords(value).join("");
}

function tokenizeDescription(value?: string | null) {
  const stopWords = new Set([
    "oraz",
    "jest",
    "jako",
    "przy",
    "ktore",
    "ktory",
    "ktora",
    "mieszkanie",
    "sprzedaz",
    "oferta",
    "nieruchomosci",
    "warszawa",
    "lokalizacja",
    "pokojowe",
    "pokojowy",
  ]);
  return normalizeWords(value).filter((token) => token.length >= 4 && !stopWords.has(token));
}

function computeDescriptionSimilarity(leftTokens: string[], rightTokens: string[]) {
  if (leftTokens.length < 25 || rightTokens.length < 25) return 0;
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.min(left.size, right.size);
}

function areCoordinatesNearby(left: PreparedRelistingRow, right: PreparedRelistingRow) {
  return (
    left.latitude !== null &&
    left.longitude !== null &&
    right.latitude !== null &&
    right.longitude !== null &&
    Math.abs(left.latitude - right.latitude) <= 0.001 &&
    Math.abs(left.longitude - right.longitude) <= 0.001
  );
}
