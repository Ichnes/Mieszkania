import type { RelistedListingMatch, RelistedListingsScanResponse } from "@mieszkania/shared";
import { pool } from "../../db";
import type { Pool } from "pg";
import type { RelistingReview } from "./relisting-review";
import { activeRegion } from "../../domain/region";
import { normalizePolish, normalizeWarsawStreetAddress } from "../geography/address-normalization";
import {
  canonicalWarsawDistrict,
  isWarsawNeighborhoodLabel,
} from "../geography/warsaw-neighborhoods";

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

type RelistingPairRow = { current_listing_id: string; previous_listing_id: string };

const descriptionPrefixWords = 30;
const descriptionSimilarityThreshold = 0.82;

// Shared by the card counter and the detail endpoint so stale/hidden archives disappear together.
export const visibleRelistingCandidateSql = `
  from listing_relisting_candidates rc
  join listings archived on archived.id = rc.previous_listing_id
  where rc.current_listing_id = l.id
    and l.status = 'active' and l.hidden_duplicate_of_id is null
    and archived.status = 'removed' and archived.hidden_duplicate_of_id is null
    and coalesce(archived.exclusion_reason, '') <> 'manual_rejected'
    and not exists (select 1 from listing_relistings confirmed
      where confirmed.current_listing_id = l.id and confirmed.previous_listing_id = rc.previous_listing_id)
    and not exists (select 1 from listing_relisting_reviews review where review.current_listing_id=rc.current_listing_id and review.previous_listing_id=rc.previous_listing_id and review.decision='rejected')
`;

export async function getPotentialRelistings(
  listingId: string,
  db: Pick<Pool, "query"> = pool,
): Promise<RelistedListingMatch[]> {
  const result = await db.query<{ match_payload: RelistedListingMatch }>(
    `
      select candidate.match_payload from listings l
      cross join lateral (select rc.match_payload ${visibleRelistingCandidateSql}) candidate
      where l.id = $1
      order by (candidate.match_payload->>'confidenceScore')::int desc
    `,
    [listingId],
  );
  return result.rows.map((row) => row.match_payload);
}

export async function getListingRelistingCandidates(
  listingId: string,
  db: Pick<Pool, "query"> = pool,
): Promise<RelistedListingMatch[]> {
  const [rows, stored, reviews, links] = await Promise.all([
    readRelistingRows(db, listingId),
    getPotentialRelistings(listingId, db),
    db.query<RelistingReview>(
      "select * from listing_relisting_reviews where current_listing_id=$1",
      [listingId],
    ),
    db.query<{ previous_listing_id: string }>(
      "select previous_listing_id from listing_relistings where current_listing_id=$1",
      [listingId],
    ),
  ]);
  const { matches, candidates } = findRelistedListingRows(rows, reviews.rows);
  const linked = new Set(links.rows.map(({ previous_listing_id }) => previous_listing_id));
  const pending = new Map<string, RelistedListingMatch>();
  for (const item of [...stored, ...candidates, ...matches]) {
    if (!item.manuallyConfirmed && !linked.has(item.previous.id))
      pending.set(item.previous.id, item);
  }
  return [...pending.values()].sort(
    (a, b) =>
      b.confidenceScore - a.confidenceScore ||
      b.previous.eventAt.localeCompare(a.previous.eventAt) ||
      a.previous.id.localeCompare(b.previous.id),
  );
}

async function readRelistingRows(db: Pick<Pool, "query">, listingId?: string) {
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
          and (l.hidden_duplicate_of_id is null
            or ($2::uuid is not null and l.status='removed' and l.hidden_duplicate_of_id <> $2))
          and l.rooms is not null
          and l.area_sqm is not null
          and l.city = any($1::text[])
          and (l.status = 'active' or coalesce(l.exclusion_reason, '') <> 'manual_rejected')
          and ($2::uuid is null or l.id = $2 or (l.status = 'removed' and exists (
            select 1 from listings target where target.id = $2 and target.status = 'active'
              and target.hidden_duplicate_of_id is null and target.city = l.city and target.rooms = l.rooms
              and l.area_sqm between target.area_sqm - 3 and target.area_sqm + 3
          )))
      `,
    [activeRegion.supportedCities, listingId ?? null],
  );

  return result.rows.map<RelistingMatchRow>((row) => ({
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
}

export async function scanRelistedListings(
  limit = 100,
  db: Pool = pool,
): Promise<RelistedListingsScanResponse> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const [rows, reviews, existing] = await Promise.all([
    readRelistingRows(db),
    db.query<RelistingReview>("select * from listing_relisting_reviews"),
    db.query<RelistingPairRow>(
      "select current_listing_id, previous_listing_id from listing_relistings",
    ),
  ]);
  const { matches, candidates } = findRelistedListingRows(rows, reviews.rows, existing.rows);

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('relisting-candidates'))");
    // A former automatic match which no longer meets the rules returns to review.
    // Explicit user decisions remain authoritative across every scan.
    await client.query(
      `delete from listing_relistings relation
      where relation.current_listing_id=any($1::uuid[])
        and not exists(select 1 from unnest($2::uuid[], $3::uuid[]) kept(current_id, previous_id)
          where kept.current_id=relation.current_listing_id and kept.previous_id=relation.previous_listing_id)
        and not exists(select 1 from listing_relisting_reviews review
          where review.current_listing_id=relation.current_listing_id
            and review.previous_listing_id=relation.previous_listing_id and review.decision='confirmed')`,
      [
        rows.filter((row) => row.status === "active").map((row) => row.id),
        matches.map((match) => match.current.id),
        matches.map((match) => match.previous.id),
      ],
    );
    if (matches.length > 0) {
      const persistedMatches = matches.map((match) => ({
        current_listing_id: match.current.id,
        previous_listing_id: match.previous.id,
        confidence_score: match.confidenceScore,
        reason_summary: match.reasons.join(", "),
        previous_price_amount: match.previous.priceAmount ?? null,
        relisted_price_amount: match.current.priceAmount ?? null,
      }));
      await client.query(
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
          where not exists (select 1 from listing_relisting_reviews review
            where review.current_listing_id=match.current_listing_id
              and review.previous_listing_id=match.previous_listing_id)
          on conflict (current_listing_id, previous_listing_id)
          do update set
            confidence_score = excluded.confidence_score,
            reason_summary = excluded.reason_summary,
            last_detected_at = now()
        `,
        [JSON.stringify(persistedMatches)],
      );
    }

    // Replace suggestions atomically. They never become confirmed relistings.
    await client.query("delete from listing_relisting_candidates");
    if (candidates.length) {
      await client.query(
        `
          insert into listing_relisting_candidates (current_listing_id, previous_listing_id, match_payload)
          select (item->'current'->>'id')::uuid, (item->'previous'->>'id')::uuid, item
          from jsonb_array_elements($1::jsonb) item
          where not exists (select 1 from listing_relisting_reviews review
            where review.current_listing_id=(item->'current'->>'id')::uuid
              and review.previous_listing_id=(item->'previous'->>'id')::uuid)
        `,
        [JSON.stringify(candidates)],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return {
    checkedActive: rows.filter((row) => row.status === "active").length,
    checkedArchived: rows.filter((row) => row.status === "removed").length,
    matched: matches.length,
    items: matches.slice(0, safeLimit),
    potentialCount: candidates.length,
    potentialItems: candidates.slice(0, safeLimit),
  };
}

export function matchRelistedListingRows(rows: RelistingMatchRow[]): RelistedListingMatch[] {
  return findRelistedListingRows(rows).matches;
}

export function findRelistedListingRows(
  rows: RelistingMatchRow[],
  reviews: RelistingReview[] = [],
  existing: RelistingPairRow[] = [],
): {
  matches: RelistedListingMatch[];
  candidates: RelistedListingMatch[];
} {
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
  const potential: RelistedListingMatch[] = [];
  const archiveIds = new Set(archived.map((row) => row.id));
  const reviewsByCurrent = new Map<string, Map<string, RelistingReview>>();
  const linkedPairs = new Set(
    existing.map((row) => `${row.current_listing_id}:${row.previous_listing_id}`),
  );
  for (const review of reviews) {
    let byArchive = reviewsByCurrent.get(review.current_listing_id);
    if (!byArchive) {
      byArchive = new Map();
      reviewsByCurrent.set(review.current_listing_id, byArchive);
    }
    byArchive.set(review.previous_listing_id, review);
  }
  for (const current of active) {
    const decisions = reviewsByCurrent.get(current.id);
    let manuallyLinked = false;
    for (const review of decisions?.values() ?? []) {
      if (review.decision === "confirmed" && archiveIds.has(review.previous_listing_id)) {
        matches.push({ ...review.match_payload, manuallyConfirmed: true });
        manuallyLinked = true;
      }
    }
    const candidates = new Map<string, PreparedRelistingRow>();
    const areaBucket = Math.floor(current.areaSqm);
    for (let bucket = areaBucket - 3; bucket <= areaBucket + 3; bucket += 1) {
      for (const previous of archivedByPhysicalBucket.get(physicalBucket(current, bucket)) ?? []) {
        candidates.set(previous.id, previous);
      }
    }

    const scored = [...candidates.values()]
      .filter((previous) => decisions?.get(previous.id)?.decision !== "rejected")
      .map((previous) => scoreRelisting(previous, current))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort(
        (left, right) =>
          right.match.confidenceScore - left.match.confidenceScore ||
          new Date(right.match.previous.eventAt).getTime() -
            new Date(left.match.previous.eventAt).getTime(),
      );

    const best = scored.find(
      (item) =>
        item.strong &&
        (!manuallyLinked || linkedPairs.has(`${current.id}:${item.match.previous.id}`)),
    );
    if (best && !decisions?.has(best.match.previous.id)) matches.push(best.match);
    potential.push(
      ...scored
        .filter((item) => item !== best && !decisions?.has(item.match.previous.id))
        .map((item) => item.match),
    );
  }

  matches.sort(
    (left, right) =>
      new Date(right.current.eventAt).getTime() - new Date(left.current.eventAt).getTime(),
  );
  potential.sort(
    (left, right) =>
      right.confidenceScore - left.confidenceScore ||
      new Date(right.current.eventAt).getTime() - new Date(left.current.eventAt).getTime(),
  );
  return { matches, candidates: potential };
}

function scoreRelisting(
  previous: PreparedRelistingRow,
  current: PreparedRelistingRow,
): { strong: boolean; match: RelistedListingMatch } | null {
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

  const strongPrefixMatch =
    exactPrefix && (areaDifference <= 1 || sameAddress || nearbyCoordinates);
  const strongSimilarityMatch =
    descriptionSimilarity >= descriptionSimilarityThreshold &&
    areaDifference <= 1 &&
    sameAddress &&
    (sameAddress || sameFloor || nearbyCoordinates);
  const strong = strongPrefixMatch || strongSimilarityMatch;
  const conflictingFloors = previous.floor !== null && current.floor !== null && !sameFloor;
  const previousNumber = previous.addressKey.match(/\d+[a-z]?(?:[/-]\d+[a-z]?)?$/)?.[0];
  const currentNumber = current.addressKey.match(/\d+[a-z]?(?:[/-]\d+[a-z]?)?$/)?.[0];
  const conflictingNumbers = previousNumber && currentNumber && previousNumber !== currentNumber;
  const surnameOnly = (full: string, short: string) =>
    /^[a-z]{3,}(?:skiego|ckiego)$/.test(short) && full.endsWith(" " + short);
  const abbreviatedStreet =
    surnameOnly(previous.streetKey, current.streetKey) || surnameOnly(current.streetKey, previous.streetKey);
  const plausible =
    !conflictingFloors &&
    !conflictingNumbers &&
    ((abbreviatedStreet && sameFloor && areaDifference < 0.01) ||
      (sameStreet && sameFloor && areaDifference <= 1) ||
      (descriptionSimilarity >= 0.55 && areaDifference <= 1 && (sameStreet || nearbyCoordinates)));
  if (!strong && !plausible) return null;

  let confidenceScore = strong ? (exactPrefix ? 78 : 68) : 40;
  const reasons: string[] = [];
  if (exactPrefix) reasons.push(`identyczne pierwsze ${descriptionPrefixWords} słów opisu`);
  else if (descriptionSimilarity > 0)
    reasons.push(`${Math.round(descriptionSimilarity * 100)}% wspólnych słów opisu`);
  reasons.push("ta sama liczba pokoi");
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
  if (!strong && descriptionSimilarity >= 0.55) confidenceScore += 10;
  confidenceScore = Math.min(strong ? 100 : 79, confidenceScore);
  if (conflictingFloors || conflictingNumbers) {
    confidenceScore = Math.min(confidenceScore, 79);
    if (conflictingFloors) reasons.push("różne piętra — wymaga sprawdzenia");
    if (conflictingNumbers) reasons.push("różne numery budynków — wymaga sprawdzenia");
  }

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
    strong: strong && !conflictingFloors && !conflictingNumbers && confidenceScore >= 90,
    match: {
      previous: {
        id: previous.id,
        title: previous.title,
        sourceLabel: previous.sourceLabel,
        canonicalUrl: previous.canonicalUrl ?? undefined,
        priceAmount: previousPrice,
        eventAt: archivedAt,
        addressText: previous.addressText ?? undefined,
        areaSqm: previous.areaSqm,
        rooms: previous.rooms,
        floor: previous.floor ?? undefined,
      },
      current: {
        id: current.id,
        title: current.title,
        sourceLabel: current.sourceLabel,
        canonicalUrl: current.canonicalUrl ?? undefined,
        priceAmount: currentPrice,
        eventAt: current.firstSeenAt,
        addressText: current.addressText ?? undefined,
        areaSqm: current.areaSqm,
        rooms: current.rooms,
        floor: current.floor ?? undefined,
      },
      priceDifferenceAmount,
      priceDifferencePercent,
      confidenceScore,
      reasons,
    },
  };
}

function prepareRow(row: RelistingMatchRow): PreparedRelistingRow {
  const prefixTokens = normalizeWords(row.description);
  const street = normalizeWarsawStreetAddress(row.addressText);
  const usableStreet =
    street &&
    !canonicalWarsawDistrict(street) &&
    !isWarsawNeighborhoodLabel(street) &&
    normalizeCompact(street) !== normalizeCompact(row.city);
  return {
    ...row,
    cityKey: normalizeCompact(row.city),
    descriptionTokens: tokenizeDescription(row.description),
    descriptionPrefix:
      prefixTokens.length >= descriptionPrefixWords
        ? prefixTokens.slice(0, descriptionPrefixWords).join(" ")
        : "",
    addressKey: usableStreet ? normalizeCompact(street) : "",
    streetKey: usableStreet
      ? normalizeWords(street.replace(/\s+\d+[a-z]?(?:[/-]\d+[a-z]?)?$/iu, "")).join(" ")
      : "",
  };
}

function physicalBucket(row: Pick<PreparedRelistingRow, "cityKey" | "rooms">, areaBucket: number) {
  return `${row.cityKey}:${row.rooms}:${areaBucket}`;
}

function normalizeWords(value?: string | null) {
  if (!value) return [];
  return normalizePolish(value)
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
