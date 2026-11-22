import type {
  DuplicateCandidate,
  DuplicateCandidatesResponse,
  DuplicateGroupOverview,
  DuplicateGroupQuery,
  DuplicateGroupsResponse,
  DuplicateListingPreview,
  DuplicateReviewStatus,
  RelatedListingSummary,
} from "@mieszkania/shared";
import type { Pool, PoolClient } from "pg";
import { withDb } from "../../db";
import { getDuplicateListingPreviews } from "../media/listing-preview";
import { syncDuplicateGroupPrice, restoreSourcePrice } from "./group-prices";

type QueryableDb = Pick<Pool | PoolClient, "query">;

type DuplicateCandidateRow = {
  total_count?: string;
  left_id: string;
  left_title: string;
  left_canonical_url: string;
  left_source_label: string | null;
  left_city: string;
  left_district: string | null;
  left_neighborhood: string | null;
  left_address_text: string | null;
  left_price_amount: string | null;
  left_price_per_sqm: string | null;
  left_area_sqm: string | null;
  left_rooms: string | null;
  left_group_size: string | null;
  right_id: string;
  right_title: string;
  right_canonical_url: string;
  right_source_label: string | null;
  right_city: string;
  right_district: string | null;
  right_neighborhood: string | null;
  right_address_text: string | null;
  right_price_amount: string | null;
  right_price_per_sqm: string | null;
  right_area_sqm: string | null;
  right_rooms: string | null;
  right_group_size: string | null;
  left_status: string;
  right_status: string;
  left_floor: number | null;
  right_floor: number | null;
  left_source_price_amount: string | null;
  right_source_price_amount: string | null;
  address_conflict: boolean;
  confidence_score: string;
  reason_summary: string;
  review_status: string | null;
};

type RelatedListingRow = {
  status: string;
  source_contact_phone: string | null;
  primary_listing_id: string;
  id: string;
  title: string;
  canonical_url: string;
  source_label: string | null;
  price_amount: string | null;
  area_sqm: string | null;
  relation_note: string | null;
};

type AutoMergeListingRow = {
  id: string;
  source_key: string;
  city: string;
  description: string | null;
  rooms: string | null;
  area_sqm: string | null;
  price_amount: string | null;
  address_text: string | null;
  created_at: string;
  existing_primary_id: string | null;
};

type AutoMergeCandidateRow = AutoMergeListingRow & {
  review_status: string | null;
};

const automaticDescriptionSimilarityThreshold = 0.8;
const exactDescriptionPrefixWordCount = 25;
const sourcePriority = [
  "otodom",
  "gratka",
  "morizon",
  "adresowo",
  "domiporta",
  "nieruchomosci_online",
  "maxon",
  "olx",
];

export async function getDuplicateCandidates(
  limit = 50,
  listingId?: string,
  options: { minConfidence?: number; maxConfidence?: number; sort?: string; offset?: number } = {},
): Promise<DuplicateCandidatesResponse> {
  const leftAddressKey = "l1.match_address_key";
  const rightAddressKey = "l2.match_address_key";
  const leftDistrictKey = "l1.match_district_key";
  const rightDistrictKey = "l2.match_district_key";
  const leftStreetKey = "l1.match_street_key";
  const rightStreetKey = "l2.match_street_key";
  const sameStreet = `nullif(${leftStreetKey}, '') is not null and ${leftStreetKey} = ${rightStreetKey}`;
  const sameLocation = `l1.latitude is not null and l1.longitude is not null
    and l2.latitude is not null and l2.longitude is not null
    and abs(l1.latitude - l2.latitude) <= 0.0009
    and abs(l1.longitude - l2.longitude) <= 0.0009`;
  const descriptionOverlap = "description.overlap";

  return withDb(async (db) => {
    const result = await db.query<DuplicateCandidateRow>(
      `
        with nearby_pairs as materialized (
          select least(l1.id, other.id) as left_id, greatest(l1.id, other.id) as right_id
          from listings l1
          join lateral (
            select l2.id from listings l2 where l2.city = l1.city and l2.rooms = l1.rooms
              and l2.area_sqm between l1.area_sqm - 3 and l1.area_sqm + 3
              and l2.price_amount between least(l1.price_amount - 60000, l1.price_amount * 0.95)
                and greatest(l1.price_amount + 60000, l1.price_amount * 1.053)
              and l2.status in ('active', 'removed', 'sold', 'reserved')
              and l2.hidden_duplicate_of_id is null
              and l2.price_amount is not null
              and l2.id <> l1.id and ($1::uuid is not null or l1.id < l2.id)
              and (
                abs(l1.price_amount - l2.price_amount) <= 60000 or
                abs(l1.price_amount - l2.price_amount) <= greatest(l1.price_amount, l2.price_amount) * 0.05
              )
            offset 0
          ) other on true
          where l1.hidden_duplicate_of_id is null and l1.status in ('active', 'removed', 'sold', 'reserved')
            and l1.rooms is not null and l1.area_sqm is not null and l1.price_amount is not null
            and ($1::uuid is null or l1.id = $1::uuid)
        ), relevant_ids as (
          select left_id as id from nearby_pairs union select right_id from nearby_pairs
        ), normalized_listings as materialized (
          select l.id, l.source_id, l.title, l.canonical_url, l.city, l.district, l.neighborhood,
            l.address_text, l.price_amount, l.source_price_amount, l.price_per_sqm, l.area_sqm,
            l.rooms, l.floor, l.status, l.latitude, l.longitude,
            ${normalizedAddressKeySql("coalesce(l.address_text, '')")} as match_address_key,
            ${normalizedStreetKeySql("coalesce(l.address_text, '')")} as match_street_key,
            ${normalizedTextKeySql("coalesce(l.district, '')")} as match_district_key,
            tokens.words as match_tokens, tokens.signature,
            cardinality(tokens.words) - bit_count(tokens.signature) as collisions
          from relevant_ids join listings l using (id)
          cross join lateral (
            select coalesce(array_agg(token), '{}'::text[]) as words,
              coalesce(bit_or(set_bit(B'0'::bit(256), hashtext(token) & 255, 1)), B'0'::bit(256)) as signature
            from (
              select distinct token
              from unnest(regexp_split_to_array(substring(${normalizedTextKeySql("coalesce(l.description, '')")} from 1 for 300), '\\s+')) token
              where length(token)>=4 and token not in ('mieszkanie','sprzedaz','oferta','nieruchomosci','warszawa','lokalizacja','pokojowe','pokojowy')
            ) distinct_tokens
          ) tokens
        ), pair_base as (
          select
            l1.id as left_id,
            l1.title as left_title,
            l1.canonical_url as left_canonical_url,
            s1.name as left_source_label,
            l1.city as left_city,
            l1.district as left_district,
            l1.neighborhood as left_neighborhood,
            l1.address_text as left_address_text,
            l1.price_amount::text as left_price_amount,
            l1.price_per_sqm::text as left_price_per_sqm,
            l1.area_sqm::text as left_area_sqm,
            l1.rooms::text as left_rooms,
            l1.status as left_status,
            l1.floor as left_floor,
            l1.source_price_amount::text as left_source_price_amount,
            coalesce(g1.group_size::text, '0') as left_group_size,
            l2.id as right_id,
            l2.title as right_title,
            l2.canonical_url as right_canonical_url,
            s2.name as right_source_label,
            l2.city as right_city,
            l2.district as right_district,
            l2.neighborhood as right_neighborhood,
            l2.address_text as right_address_text,
            l2.price_amount::text as right_price_amount,
            l2.price_per_sqm::text as right_price_per_sqm,
            l2.area_sqm::text as right_area_sqm,
            l2.rooms::text as right_rooms,
            l2.status as right_status,
            l2.floor as right_floor,
            l2.source_price_amount::text as right_source_price_amount,
            coalesce(g2.group_size::text, '0') as right_group_size,
            (nullif(${leftStreetKey}, '') is not null and nullif(${rightStreetKey}, '') is not null
              and ${leftStreetKey} <> ${rightStreetKey}) as address_conflict,
            (
              case
                when nullif(${leftStreetKey}, '') is not null and ${leftStreetKey} = ${rightStreetKey} then 22
                when nullif(trim(coalesce(l1.address_text, '')), '') is not null and ${leftAddressKey} = ${rightAddressKey} then 18
                else 0 end
            ) +
            (
              case
                when ${leftDistrictKey} = ${rightDistrictKey}
                  and nullif(trim(coalesce(l1.district, '')), '') is not null
                then 10 else 0 end
            ) +
            (
              case
                when l1.floor is not null and l2.floor is not null and l1.floor = l2.floor then 8
                else 0 end
            ) +
            (
              case
                when l1.rooms is not null and l2.rooms is not null and l1.rooms = l2.rooms then 14
                else 0 end
            ) +
            (
              case
                when l1.area_sqm is not null and l2.area_sqm is not null and abs(l1.area_sqm - l2.area_sqm) <= 1.0 then 18
                when l1.area_sqm is not null and l2.area_sqm is not null and abs(l1.area_sqm - l2.area_sqm) <= 3.0 then 10
                else 0 end
            ) +
            (
              case
                when l1.price_amount is not null and l2.price_amount is not null and abs(l1.price_amount - l2.price_amount) <= 20000 then 16
                when l1.price_amount is not null and l2.price_amount is not null and abs(l1.price_amount - l2.price_amount) <= 60000 then 9
                when l1.price_amount is not null and l2.price_amount is not null
                  and greatest(l1.price_amount, l2.price_amount) > 0
                  and abs(l1.price_amount - l2.price_amount) / greatest(l1.price_amount, l2.price_amount) <= 0.05
                then 7
                else 0 end
            ) +
            (
              case
                when ${descriptionOverlap} >= 20 then 18
                when ${descriptionOverlap} >= 12 then 12
                when ${descriptionOverlap} >= 7 then 6
                else 0 end
            ) +
            (
              case
                when l1.latitude is not null and l1.longitude is not null and l2.latitude is not null and l2.longitude is not null
                  and abs(l1.latitude - l2.latitude) <= 0.0009
                  and abs(l1.longitude - l2.longitude) <= 0.0009
                then 18 else 0 end
            ) as confidence_score,
            concat_ws(', ',
              case
                when nullif(${leftStreetKey}, '') is not null and ${leftStreetKey} = ${rightStreetKey}
                then 'ta sama ulica' end,
              case
                when ${leftDistrictKey} = ${rightDistrictKey}
                  and nullif(trim(coalesce(l1.district, '')), '') is not null
                then 'ta sama dzielnica' end,
              case
                when l1.floor is not null and l2.floor is not null and l1.floor = l2.floor
                then 'to samo pietro' end,
              case
                when l1.rooms is not null and l2.rooms is not null and l1.rooms = l2.rooms
                then 'ta sama liczba pokoi' end,
              case
                when l1.area_sqm is not null and l2.area_sqm is not null and abs(l1.area_sqm - l2.area_sqm) <= 3.0
                then 'bardzo podobny metraz' end,
              case
                when l1.price_amount is not null and l2.price_amount is not null and abs(l1.price_amount - l2.price_amount) <= 60000
                then 'bardzo podobna cena' end,
              case
                when ${descriptionOverlap} >= 12
                then concat('wspolny poczatek opisu: ', ${descriptionOverlap}, ' slow') end,
              case
                when l1.latitude is not null and l1.longitude is not null and l2.latitude is not null and l2.longitude is not null
                  and abs(l1.latitude - l2.latitude) <= 0.0009
                  and abs(l1.longitude - l2.longitude) <= 0.0009
                then 'prawie ten sam punkt na mapie' end
            ) as reason_summary,
            r.status as review_status
          from nearby_pairs pair
          join normalized_listings l1 on l1.id = pair.left_id
          join normalized_listings l2 on l2.id = pair.right_id
          cross join lateral (
            -- Shared buckets plus collisions bound the maximum possible overlap.
            select case when bit_count(l1.signature & l2.signature) + least(l1.collisions, l2.collisions)
              >= case when (${sameStreet}) or (${sameLocation}) then 7 else 12 end
              then (select count(*)::int from unnest(l1.match_tokens) token where token = any(l2.match_tokens))
              else 0 end as overlap
            offset 0
          ) description
          join sources s1 on s1.id = l1.source_id
          join sources s2 on s2.id = l2.source_id
          left join (
            select group_id, count(*) as group_size
            from listing_duplicate_group_members
            group by group_id
          ) g1 on g1.group_id = (select group_id from listing_duplicate_group_members where listing_id = l1.id)
          left join (
            select group_id, count(*) as group_size
            from listing_duplicate_group_members
            group by group_id
          ) g2 on g2.group_id = (select group_id from listing_duplicate_group_members where listing_id = l2.id)
          left join listing_duplicate_reviews r
            on r.pair_key = concat(least(l1.id::text, l2.id::text), ':', greatest(l1.id::text, l2.id::text))
          where coalesce(r.status, 'pending') <> 'different_listing' and (
              (${sameStreet}) or ${descriptionOverlap} >= 12 or (${sameLocation})
            )
        )
        select *, count(*) over()::text as total_count
        from pair_base
        where least(confidence_score, 100) between $3 and $4
        order by
          case when coalesce(review_status, 'pending') = 'pending' then 0 else 1 end,
          case when $5::text = 'confidence_desc' then address_conflict end,
          case when $5::text='confidence_asc' then confidence_score end asc,
          case when $5::text='related_desc' then coalesce(left_group_size,'0')::int+coalesce(right_group_size,'0')::int end desc,
          confidence_score desc,
          left_title asc, left_id, right_id
        limit $2 offset $6
      `,
      [
        listingId ?? null,
        Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, 500)),
        Math.max(60, Math.min(100, options.minConfidence ?? 60)),
        Math.max(60, Math.min(100, options.maxConfidence ?? 100)),
        options.sort ?? "confidence_desc",
        Math.max(0, options.offset ?? 0),
      ],
    );

    const items = result.rows.map(mapDuplicateCandidateRow);
    const listingIds = [...new Set(items.flatMap((item) => [item.left.id, item.right.id]))];
    const [previews, primaryOptions] = await Promise.all([
      getDuplicateListingPreviews(listingIds, db),
      getDuplicatePrimaryOptions(db, listingIds, undefined, true),
    ]);
    const byId = new Map(primaryOptions.map((option) => [option.id, option]));
    const firstByGroup = new Map<string, PrimaryOption>();
    for (const option of primaryOptions) {
      if (option.group_id && !firstByGroup.has(option.group_id))
        firstByGroup.set(option.group_id, option);
    }
    for (const pair of items) {
      const options = [pair.left, pair.right].flatMap(({ id }) => {
        const option = byId.get(id);
        if (!option) return [];
        return [option.group_id ? (firstByGroup.get(option.group_id) ?? option) : option];
      });
      const primary = options.sort(compareDuplicatePrimaryOptions)[0];
      if (primary) {
        const fromLeft =
          primary.id === pair.left.id ||
          (primary.group_id && primary.group_id === byId.get(pair.left.id)?.group_id);
        pair.primaryPreview = {
          id: primary.id,
          title: primary.title,
          sourceLabel: primary.source_label,
          addedCount: ((fromLeft ? pair.right.relatedCount : pair.left.relatedCount) ?? 0) + 1,
        };
      }
    }
    for (const item of items)
      for (const offer of [item.left, item.right]) {
        offer.thumbnailUrls = previews.get(offer.id)?.urls ?? [];
        offer.thumbnailSharedFromIndex = previews.get(offer.id)?.sharedFromIndex;
        offer.thumbnailUrl = offer.thumbnailUrls[0];
      }
    return {
      total: Number(result.rows[0]?.total_count ?? 0),
      items,
    };
  });
}

export class DuplicateAreaConflict extends Error {
  constructor(
    readonly canConfirmArchive: boolean,
    minArea: number,
    maxArea: number,
    memberCount: number,
  ) {
    super(
      `Metraże w porównywanych ogłoszeniach (${memberCount}) wynoszą od ${minArea.toLocaleString("pl-PL")} do ${maxArea.toLocaleString("pl-PL")} m². Różnica przekracza 2%.`,
    );
  }
}

export async function reviewDuplicateCandidate(input: {
  leftId: string;
  rightId: string;
  primaryListingId?: string;
  status: Exclude<DuplicateReviewStatus, "pending">;
  confirmArchiveAreaDifference?: boolean;
  notes?: string;
}) {
  return withDb(async (pool) => {
    const db = await pool.connect();
    const leftId = input.leftId < input.rightId ? input.leftId : input.rightId;
    const rightId = input.leftId < input.rightId ? input.rightId : input.leftId;
    const pairKey = buildDuplicatePairKey(leftId, rightId);
    let mergedPrimaryId: string | undefined;

    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(735189241)");
      await db.query(
        `
          insert into listing_duplicate_reviews (
            pair_key,
            listing_id_left,
            listing_id_right,
            status,
            notes,
            reviewed_at
          )
          values ($1, $2, $3, $4, $5, now())
          on conflict (pair_key)
          do update set
            status = excluded.status,
            notes = excluded.notes,
            reviewed_at = now()
        `,
        [pairKey, leftId, rightId, input.status, normalizeNullableText(input.notes)],
      );

      if (input.status === "same_listing") {
        const check = await checkDuplicateGroups(db, leftId, rightId, false);
        if (
          !check.compatible &&
          !(check.can_confirm_archive && input.confirmArchiveAreaDifference === true)
        ) {
          throw new DuplicateAreaConflict(
            check.can_confirm_archive,
            Number(check.min_area),
            Number(check.max_area),
            check.member_count,
          );
        }
        const primaryListingId = await choosePreferredPrimaryListingId(
          db,
          input.leftId,
          input.rightId,
        );
        const duplicateListingId = primaryListingId === input.leftId ? input.rightId : input.leftId;
        mergedPrimaryId = await mergeDuplicateGroup(db, primaryListingId, duplicateListingId);
      }

      if (input.status === "different_listing") {
        const detached = await db.query<{ listing_id: string; group_id: string }>(
          `
            delete from listing_duplicate_group_members
            where listing_id in ($1, $2)
              and group_id in (
                select group_id
                from listing_duplicate_group_members
                where listing_id in ($1, $2)
                group by group_id
                having count(*) = 2
              )
            returning listing_id, group_id
          `,
          [leftId, rightId],
        );
        for (const member of detached.rows) await restoreSourcePrice(db, member.listing_id);
        for (const groupId of new Set(detached.rows.map((member) => member.group_id))) {
          await syncDuplicateGroupPrice(db, groupId);
        }
        await db.query(
          `
            update listings
            set hidden_duplicate_of_id = null,
                hidden_at = null,
                updated_at = now()
            where id in ($1, $2)
              and hidden_duplicate_of_id in ($1, $2)
          `,
          [leftId, rightId],
        );
      }

      await db.query("commit");
      return { pairKey, status: input.status, primaryListingId: mergedPrimaryId };
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  });
}

export async function autoMergeDuplicateByDescription(db: QueryableDb, listingId: string) {
  const listingResult = await db.query<AutoMergeListingRow>(
    `
      select
        l.id,
        s.key as source_key,
        l.city,
        l.description,
        l.rooms::text,
        l.area_sqm::text,
        l.price_amount::text,
        l.address_text,
        l.created_at::text,
        gm_primary.listing_id as existing_primary_id
      from listings l
      join sources s on s.id = l.source_id
      left join listing_duplicate_group_members gm_self on gm_self.listing_id = l.id
      left join listing_duplicate_group_members gm_primary
        on gm_primary.group_id = gm_self.group_id
       and gm_primary.is_primary = true
      where l.id = $1
        and l.status = 'active'
      limit 1
    `,
    [listingId],
  );
  const listing = listingResult.rows[0];
  const listingTokens = tokenizeDescription(listing?.description);
  const listingPrefixTokens = tokenizeDescriptionPrefix(listing?.description);

  if (
    !listing ||
    (listingTokens.length < 25 && listingPrefixTokens.length < exactDescriptionPrefixWordCount)
  ) {
    return null;
  }

  const exactDescriptionPrefix = descriptionPrefixMatchSql(
    "coalesce(other.description, '')",
    "(select coalesce(description, '') from listings where id = $1::uuid)",
  );

  const candidatesResult = await db.query<AutoMergeCandidateRow>(
    `
      select
        other.id,
        os.key as source_key,
        other.city,
        other.description,
        other.rooms::text,
        other.area_sqm::text,
        other.price_amount::text,
        other.address_text,
        other.created_at::text,
        gm_primary.listing_id as existing_primary_id,
        r.status as review_status
      from listings other
      join sources os on os.id = other.source_id
      left join listing_duplicate_group_members gm_self on gm_self.listing_id = other.id
      left join listing_duplicate_group_members gm_primary
        on gm_primary.group_id = gm_self.group_id
       and gm_primary.is_primary = true
      left join listing_duplicate_reviews r
        on r.pair_key = concat(least(($1::uuid)::text, other.id::text), ':', greatest(($1::uuid)::text, other.id::text))
      where other.id <> $1::uuid
        and other.status = 'active'
        and other.hidden_duplicate_of_id is null
        and other.city = $2
        -- Skip members of the same group, but allow repeated ads on one portal.
        and not exists (
          select 1
          from listing_duplicate_group_members self_member
          join listing_duplicate_group_members grouped_member
            on grouped_member.group_id = self_member.group_id
          join listings grouped_listing on grouped_listing.id = grouped_member.listing_id
          where self_member.listing_id = $1::uuid
            and grouped_listing.id = other.id
        )
        and coalesce(r.status, 'pending') <> 'different_listing'
        and other.area_sqm > 0 and $3::numeric > 0
        and abs(other.area_sqm - $3::numeric) <= least(other.area_sqm, $3::numeric) * 0.02
        and (
          ${exactDescriptionPrefix}
          or (
            other.source_id <> (select source_id from listings where id = $1::uuid)
            and
            abs(other.area_sqm - $3::numeric) <= 1.0
            and nullif(${normalizedStreetKeySql("coalesce(other.address_text, '')")}, '') = $4
          )
        )
      order by
        case when os.key = 'otodom' then 0 else 1 end,
        other.last_seen_at desc
      limit 100
    `,
    [
      listing.id,
      listing.city,
      Number(listing.area_sqm),
      normalizedStreetKey(listing.address_text ?? ""),
    ],
  );

  const compatibleCandidates: AutoMergeCandidateRow[] = [];
  for (const candidate of candidatesResult.rows) {
    if (await duplicateGroupsCompatible(db, listing.id, candidate.id, true))
      compatibleCandidates.push(candidate);
  }
  const best = compatibleCandidates
    .map((candidate) => {
      const similarity = computeDescriptionSimilarity(
        listingTokens,
        tokenizeDescription(candidate.description),
      );
      const matchingPrefixWords = countMatchingDescriptionPrefixWords(
        listingPrefixTokens,
        tokenizeDescriptionPrefix(candidate.description),
      );
      return { candidate, similarity, matchingPrefixWords };
    })
    .filter(
      (match) =>
        match.matchingPrefixWords >= exactDescriptionPrefixWordCount ||
        match.similarity >= automaticDescriptionSimilarityThreshold,
    )
    .sort(
      (left, right) =>
        right.matchingPrefixWords - left.matchingPrefixWords || right.similarity - left.similarity,
    )[0];

  if (!best) {
    return null;
  }

  const primaryListingId = choosePrimaryListingId(listing, best.candidate);
  const duplicateListingId = primaryListingId === listing.id ? best.candidate.id : listing.id;
  const leftId = listing.id < best.candidate.id ? listing.id : best.candidate.id;
  const rightId = listing.id < best.candidate.id ? best.candidate.id : listing.id;
  const pairKey = buildDuplicatePairKey(leftId, rightId);
  const similarityPercent = Math.round(best.similarity * 100);

  await db.query(
    `
      insert into listing_duplicate_reviews (
        pair_key,
        listing_id_left,
        listing_id_right,
        status,
        notes,
        reviewed_at
      )
      values ($1, $2, $3, 'same_listing', $4, now())
      on conflict (pair_key)
      do update set
        status = excluded.status,
        notes = excluded.notes,
        reviewed_at = now()
    `,
    [
      pairKey,
      leftId,
      rightId,
      best.matchingPrefixWords >= exactDescriptionPrefixWordCount
        ? `Automatycznie polaczona: identyczne pierwsze ${exactDescriptionPrefixWordCount} slow opisu.`
        : `Automatycznie polaczona: ta sama ulica, zgodny metraz i ${similarityPercent}% wspolnych slow opisu.`,
    ],
  );

  const mergedPrimaryId = await mergeDuplicateGroup(db, primaryListingId, duplicateListingId);

  return {
    pairKey,
    primaryListingId: mergedPrimaryId,
    duplicateListingId:
      mergedPrimaryId === duplicateListingId ? primaryListingId : duplicateListingId,
    similarity: best.similarity,
  };
}

export async function runAutomaticDuplicateMergeByDescription(limit = 10_000) {
  const safeLimit = Math.max(1, Math.min(limit, 20_000));

  return withDb(async (pool) => {
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(735189241)");
      const result = await db.query<AutoMergeListingRow>(
        `
        select
          l.id,
          s.key as source_key,
          l.city,
          l.description,
          l.rooms::text,
          l.area_sqm::text,
          l.price_amount::text,
          l.address_text,
          l.created_at::text,
          gm_primary.listing_id::text as existing_primary_id
        from listings l
        join sources s on s.id = l.source_id
        left join listing_duplicate_group_members gm_self on gm_self.listing_id = l.id
        left join listing_duplicate_group_members gm_primary
          on gm_primary.group_id = gm_self.group_id
         and gm_primary.is_primary = true
        where l.status = 'active'
          and l.hidden_duplicate_of_id is null
          and coalesce(l.description, '') <> ''
        order by l.last_seen_at desc nulls last, l.created_at desc
        limit $1
      `,
        [safeLimit],
      );

      // The old implementation issued two or more SQL queries for every listing.
      // Ten thousand offers therefore meant tens of thousands of database round
      // trips. The automatic rule is an identical 25-word prefix, so fetch once,
      // normalize once and compare only records that share the same signature.
      const signatureGroups = new Map<string, AutoMergeListingRow[]>();
      for (const listing of result.rows) {
        const prefix = tokenizeDescriptionPrefix(listing.description).slice(
          0,
          exactDescriptionPrefixWordCount,
        );
        if (prefix.length < exactDescriptionPrefixWordCount) continue;
        const signature = `${listing.city.trim().toLowerCase()}:${prefix.join(" ")}`;
        const group = signatureGroups.get(signature);
        if (group) group.push(listing);
        else signatureGroups.set(signature, [listing]);
      }

      const candidateGroups = [...signatureGroups.values()].filter((group) => group.length > 1);
      const rejectedPairsResult = await db.query<{ pair_key: string }>(
        `select pair_key from listing_duplicate_reviews where status = 'different_listing'`,
      );
      const rejectedPairKeys = new Set(rejectedPairsResult.rows.map((row) => row.pair_key));
      let merged = 0;
      const concurrency = 1;
      for (let offset = 0; offset < candidateGroups.length; offset += concurrency) {
        const batch = candidateGroups.slice(offset, offset + concurrency);
        const outcomes = await Promise.all(
          batch.map(async (group) => {
            const ordered = [...group].sort((left, right) => {
              const leftPriority = sourcePriority.indexOf(left.source_key);
              const rightPriority = sourcePriority.indexOf(right.source_key);
              return (
                (leftPriority < 0 ? 999 : leftPriority) -
                  (rightPriority < 0 ? 999 : rightPriority) ||
                new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
              );
            });
            const primary =
              ordered.find((listing) => listing.existing_primary_id === listing.id) ?? ordered[0];
            let groupMerged = 0;

            for (const duplicate of ordered) {
              if (duplicate.id === primary.id) continue;
              const leftId = primary.id < duplicate.id ? primary.id : duplicate.id;
              const rightId = primary.id < duplicate.id ? duplicate.id : primary.id;
              const pairKey = buildDuplicatePairKey(leftId, rightId);
              if (rejectedPairKeys.has(pairKey)) continue;
              if (!(await duplicateGroupsCompatible(db, primary.id, duplicate.id, true))) continue;

              await db.query(
                `insert into listing_duplicate_reviews (pair_key, listing_id_left, listing_id_right, status, notes, reviewed_at)
             values ($1, $2, $3, 'same_listing', $4, now())
             on conflict (pair_key) do update set status = excluded.status, notes = excluded.notes, reviewed_at = now()`,
                [
                  pairKey,
                  leftId,
                  rightId,
                  `Automatycznie polaczona: identyczne pierwsze ${exactDescriptionPrefixWordCount} slow opisu.`,
                ],
              );
              await mergeDuplicateGroup(db, primary.id, duplicate.id);
              groupMerged += 1;
            }
            return groupMerged;
          }),
        );
        merged += outcomes.reduce((sum, count) => sum + count, 0);
      }

      await db.query("commit");
      return { checked: result.rows.length, merged };
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  });
}

export async function getRelatedListings(listingId: string): Promise<RelatedListingSummary[]> {
  return withDb(async (db) => getRelatedListingsWithDb(db, listingId));
}

export async function getDuplicateGroupOverviews(
  limit = 200,
  {
    page = 1,
    sort = "conflicts",
    search = "",
    source = "",
    onlyConflicts = false,
  }: Partial<DuplicateGroupQuery> = {},
): Promise<DuplicateGroupsResponse> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 500)) : 200;
  return withDb(async (db) => {
    const {
      rows: [result],
    } = await db.query<DuplicateGroupsResponse>(
      `
      with review_groups as materialized (
        select gm.group_id, count(*)::int as members,
          array_remove(array[
            case when count(distinct l.floor) > 1 then 'Różne piętra' end,
            case when count(distinct l.rooms) > 1 then 'Różna liczba pokoi' end,
            case when max(l.area_sqm) - min(l.area_sqm) > min(l.area_sqm) * 0.02 then 'Rozbieżny metraż' end
          ], null) as conflicts
        from listing_duplicate_groups dg
        join listing_duplicate_group_members gm on gm.group_id = dg.id
        join listings l on l.id = gm.listing_id
        join sources s on s.id = l.source_id
        where not dg.manually_confirmed
        group by gm.group_id
        having count(*) > 1 and bool_or(gm.is_primary)
          and ($3 = '' or bool_or(s.name = $3))
          and ($4 = '' or bool_or(strpos(
            ${normalizedTextKeySql("lower(concat_ws(' ', l.title, l.address_text, l.district, l.city, s.name, l.id, l.external_id, l.canonical_url))")},
            ${normalizedTextKeySql("lower($4::text)")}
          ) > 0))
      ), matching as materialized (
        select * from review_groups where not $5::boolean or cardinality(conflicts) > 0
      ), totals as (
        select count(*)::int as total, coalesce(sum(members), 0)::int as members,
          greatest(1, least($2::int, (count(*)::int + $1::int - 1) / $1::int)) as page
        from matching
      ), selected as (
        select *, row_number() over (
          order by case when $6 = 'members_desc' then members end desc,
            case when $6 = 'members_asc' then members end asc, cardinality(conflicts) desc, group_id
        ) as position
        from matching
      ), page_groups as (
        select selected.position, jsonb_build_object(
          'groupId', selected.group_id,
          'primaryListingId', max(l.id::text) filter (where gm.is_primary),
          'primaryTitle', max(l.title) filter (where gm.is_primary),
          'conflicts', selected.conflicts,
          'members', jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', l.id, 'title', l.title, 'sourceLabel', s.name, 'canonicalUrl', l.canonical_url,
            'priceLabel', l.price_amount, 'sourcePriceLabel', l.source_price_amount,
            'areaLabel', l.area_sqm, 'addressText', coalesce(l.address_text, concat_ws(', ', l.district, l.city)),
            'listingStatus', l.status, 'floor', l.floor, 'rooms', l.rooms, 'isPrimary', gm.is_primary
          )) order by gm.is_primary desc, l.last_seen_at desc nulls last, l.id)
        ) as payload
        from selected
        join listing_duplicate_group_members gm on gm.group_id = selected.group_id
        join listings l on l.id = gm.listing_id
        join sources s on s.id = l.source_id
        cross join totals
        where selected.position between (totals.page - 1) * $1 + 1 and totals.page * $1
        group by selected.group_id, selected.conflicts, selected.position
      )
      select totals.total, totals.page, totals.members as "totalMembers",
        totals.members - totals.total as "totalCopies",
        array(select distinct name from sources order by name) as sources,
        coalesce((select jsonb_agg(payload order by position) from page_groups), '[]'::jsonb) as items
      from totals`,
      [
        safeLimit,
        Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1,
        source,
        search.trim(),
        onlyConflicts,
        sort,
      ],
    );
    const members = result.items.flatMap((group) => group.members);
    const previews = await getDuplicateListingPreviews(
      members.map((member) => member.id),
      db,
    );
    for (const member of members) {
      member.priceLabel = formatCurrencyLabel(member.priceLabel);
      member.sourcePriceLabel = member.sourcePriceLabel
        ? formatCurrencyLabel(member.sourcePriceLabel)
        : undefined;
      member.areaLabel = formatAreaLabel(member.areaLabel);
      member.thumbnailUrls = previews.get(member.id)?.urls ?? [];
      member.thumbnailSharedFromIndex = previews.get(member.id)?.sharedFromIndex;
      member.thumbnailUrl = member.thumbnailUrls[0];
    }
    return result;
  });
}
export async function unmergeDuplicateListing(
  primaryListingId: string,
  duplicateListingId: string,
) {
  return withDb(async (pool) => {
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(735189241)");
      const member = await db.query<{ group_id: string; is_primary: boolean }>(
        `select group_id::text, is_primary from listing_duplicate_group_members where listing_id = $1`,
        [duplicateListingId],
      );
      const group = member.rows[0];
      if (!group || group.is_primary)
        throw new Error("Nie można rozłączyć oferty głównej tą akcją.");
      const primary = await db.query<{ found: boolean }>(
        `select exists(select 1 from listing_duplicate_group_members where group_id = $1::uuid and listing_id = $2::uuid and is_primary = true) as found`,
        [group.group_id, primaryListingId],
      );
      if (!primary.rows[0]?.found) throw new Error("Oferta nie należy do wskazanej grupy.");
      // Remember the rejection against every remaining member, including future primaries.
      await db.query(
        `
        insert into listing_duplicate_reviews (pair_key, listing_id_left, listing_id_right, status, notes, reviewed_at)
        select concat(least(listing_id::text, $1::text), ':', greatest(listing_id::text, $1::text)),
          least(listing_id, $1::uuid), greatest(listing_id, $1::uuid), 'different_listing', 'Ręcznie rozłączono grupę', now()
        from listing_duplicate_group_members where group_id = $2::uuid and listing_id <> $1::uuid
        on conflict (pair_key) do update set status = excluded.status, notes = excluded.notes, reviewed_at = now()
      `,
        [duplicateListingId, group.group_id],
      );
      await db.query(`delete from listing_duplicate_group_members where listing_id = $1::uuid`, [
        duplicateListingId,
      ]);
      await db.query(
        `update listings set hidden_duplicate_of_id = null, hidden_at = null, updated_at = now() where id = $1::uuid`,
        [duplicateListingId],
      );
      await restoreSourcePrice(db, duplicateListingId);
      const remaining = await db.query<{ listing_id: string }>(
        "select listing_id from listing_duplicate_group_members where group_id=$1",
        [group.group_id],
      );
      if (remaining.rows.length === 1) await restoreSourcePrice(db, remaining.rows[0].listing_id);
      else await syncDuplicateGroupPrice(db, group.group_id);
      await db.query(
        `delete from listing_duplicate_groups g where g.id = $1::uuid and (select count(*) from listing_duplicate_group_members m where m.group_id = g.id) < 2`,
        [group.group_id],
      );
      await db.query("commit");
      return { primaryListingId, duplicateListingId, unmerged: true };
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  });
}

export async function confirmDuplicateGroup(primaryListingId: string) {
  return withDb(async (db) => {
    const result = await db.query<{ group_id: string }>(
      `select group_id::text from listing_duplicate_group_members where listing_id = $1::uuid and is_primary = true limit 1`,
      [primaryListingId],
    );
    const groupId = result.rows[0]?.group_id;
    if (!groupId) throw new Error("Nie znaleziono aktywnej grupy duplikatów.");
    await db.query(
      `update listing_duplicate_groups set manually_confirmed = true where id = $1::uuid`,
      [groupId],
    );
    return { groupId, confirmed: true };
  });
}

export async function getRelatedCounts(listingIds: string[]) {
  if (listingIds.length === 0) {
    return new Map<string, number>();
  }

  return withDb(async (db) => {
    const result = await db.query<{ listing_id: string; related_count: string }>(
      `
        select
          gm.listing_id,
          greatest(count(other.listing_id) - 1, 0)::text as related_count
        from listing_duplicate_group_members gm
        join listing_duplicate_group_members other on other.group_id = gm.group_id
        where gm.listing_id = any($1::uuid[])
        group by gm.listing_id
      `,
      [listingIds],
    );

    return new Map(result.rows.map((row) => [row.listing_id, Number(row.related_count)]));
  });
}

function mapDuplicateCandidateRow(row: DuplicateCandidateRow): DuplicateCandidate {
  return {
    pairKey: buildDuplicatePairKey(row.left_id, row.right_id),
    confidenceScore: Math.min(100, Number(row.confidence_score)),
    addressConflict: row.address_conflict,
    reasons: row.reason_summary
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    status: parseReviewStatus(row.review_status),
    left: mapDuplicatePreview("left", row),
    right: mapDuplicatePreview("right", row),
  };
}

function mapDuplicatePreview(
  side: "left" | "right",
  row: DuplicateCandidateRow,
): DuplicateListingPreview {
  const id = side === "left" ? row.left_id : row.right_id;
  const title = side === "left" ? row.left_title : row.right_title;
  const canonicalUrl = side === "left" ? row.left_canonical_url : row.right_canonical_url;
  const sourceLabel = side === "left" ? row.left_source_label : row.right_source_label;
  const city = side === "left" ? row.left_city : row.right_city;
  const district = side === "left" ? row.left_district : row.right_district;
  const neighborhood = side === "left" ? row.left_neighborhood : row.right_neighborhood;
  const addressText = side === "left" ? row.left_address_text : row.right_address_text;
  const priceAmount = side === "left" ? row.left_price_amount : row.right_price_amount;
  const pricePerSqm = side === "left" ? row.left_price_per_sqm : row.right_price_per_sqm;
  const areaSqm = side === "left" ? row.left_area_sqm : row.right_area_sqm;
  const rooms = side === "left" ? row.left_rooms : row.right_rooms;
  const relatedCount = side === "left" ? row.left_group_size : row.right_group_size;
  const floor = side === "left" ? row.left_floor : row.right_floor;
  const sourcePrice =
    side === "left" ? row.left_source_price_amount : row.right_source_price_amount;

  return {
    id,
    title,
    canonicalUrl,
    sourceLabel: sourceLabel ?? undefined,
    city,
    district: district ?? "Bez dzielnicy",
    neighborhood: neighborhood ?? undefined,
    addressText: addressText ?? undefined,
    priceLabel: formatCurrencyLabel(priceAmount),
    sourcePriceLabel: sourcePrice ? formatCurrencyLabel(sourcePrice) : undefined,
    listingStatus: side === "left" ? row.left_status : row.right_status,
    floor: floor ?? undefined,
    areaLabel: formatAreaLabel(areaSqm),
    pricePerSqmLabel: pricePerSqm ? `${formatIntegerLabel(pricePerSqm)} PLN/m2` : undefined,
    roomsLabel: rooms ? `${trimNumeric(rooms)} pokoje` : undefined,
    badges: [
      sourceLabel ?? "Portal",
      rooms ? `${trimNumeric(rooms)} pokoje` : "",
      addressText ? "Adres dopasowany" : "",
    ].filter(Boolean),
    relatedCount: Math.max(Number(relatedCount ?? "0") - 1, 0),
  };
}

async function getRelatedListingsWithDb(
  db: QueryableDb,
  listingId: string,
): Promise<RelatedListingSummary[]> {
  const result = await db.query<RelatedListingRow>(
    `
      select
        other.id,
        other.title,
        other.status,
        other.canonical_url,
        other.source_contact_phone,
        s.name as source_label,
        other.price_amount::text,
        other.area_sqm::text,
        r.notes as relation_note,
        (select listing_id from listing_duplicate_group_members where group_id = self_member.group_id and is_primary = true) as primary_listing_id
      from listing_duplicate_group_members self_member
      join listing_duplicate_group_members other_member on other_member.group_id = self_member.group_id
      join listings other on other.id = other_member.listing_id
      join sources s on s.id = other.source_id
      left join listing_duplicate_reviews r
        on r.pair_key = concat(least(self_member.listing_id::text, other.id::text), ':', greatest(self_member.listing_id::text, other.id::text))
       and r.status = 'same_listing'
      where self_member.listing_id = $1
        and other.id <> $1
      order by s.name asc, other.last_seen_at desc
    `,
    [listingId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    isActive: row.status === "active",
    canonicalUrl: row.canonical_url,
    sourceContactPhone: row.source_contact_phone ?? undefined,
    sourceLabel: row.source_label ?? undefined,
    priceLabel: formatCurrencyLabel(row.price_amount),
    areaLabel: formatAreaLabel(row.area_sqm),
    relationNote: row.relation_note ?? undefined,
    primaryListingId: row.primary_listing_id,
  }));
}

export async function duplicateGroupsCompatible(
  db: QueryableDb,
  leftId: string,
  rightId: string,
  automatic: boolean,
) {
  return (await checkDuplicateGroups(db, leftId, rightId, automatic)).compatible;
}

async function checkDuplicateGroups(
  db: QueryableDb,
  leftId: string,
  rightId: string,
  automatic: boolean,
) {
  const result = await db.query<{
    compatible: boolean;
    can_confirm_archive: boolean;
    min_area: string | null;
    max_area: string | null;
    member_count: number;
  }>(
    `
    with members as (
      select l.id, l.area_sqm, l.rooms, l.floor, l.status,
        coalesce(l.hidden_duplicate_of_id, l.id) as primary_id from listings l
      where l.id in ($1::uuid, $2::uuid) or l.id in (
        select m.listing_id from listing_duplicate_group_members m
        where m.group_id in (select group_id from listing_duplicate_group_members where listing_id in ($1::uuid, $2::uuid))
      )
    )
    select coalesce(max(area_sqm) - min(area_sqm) <= min(area_sqm) * 0.02, not $3::boolean)
      and (not $3::boolean or count(*) filter (where area_sqm > 0) = count(*))
      and (not $3::boolean or (count(distinct rooms) <= 1 and count(distinct floor) <= 1))
      and (not $3::boolean or not exists (
        select 1 from listing_duplicate_reviews r
        where r.status = 'different_listing'
          and r.listing_id_left in (select id from members)
          and r.listing_id_right in (select id from members)
      )) as compatible,
      count(distinct primary_id) = 2 and
        count(distinct primary_id) filter (where status = 'active') = 1 as can_confirm_archive,
      min(area_sqm)::text as min_area, max(area_sqm)::text as max_area, count(*)::int as member_count
    from members
  `,
    [leftId, rightId, automatic],
  );
  return result.rows[0];
}

async function mergeDuplicateGroup(
  db: QueryableDb,
  primaryListingId: string,
  duplicateListingId: string,
) {
  await db.query("select pg_advisory_xact_lock(735189241)");
  const existingGroups = await db.query<{ listing_id: string; group_id: string }>(
    `
      select listing_id, group_id
      from listing_duplicate_group_members
      where listing_id in ($1, $2)
    `,
    [primaryListingId, duplicateListingId],
  );

  const primaryGroup = existingGroups.rows.find(
    (row) => row.listing_id === primaryListingId,
  )?.group_id;
  const duplicateGroup = existingGroups.rows.find(
    (row) => row.listing_id === duplicateListingId,
  )?.group_id;

  let targetGroupId = primaryGroup ?? duplicateGroup;
  if (!targetGroupId) {
    const created = await db.query<{ id: string }>(
      `
        insert into listing_duplicate_groups default values
        returning id
      `,
    );
    targetGroupId = created.rows[0].id;
  }

  await db.query(
    `
      insert into listing_duplicate_group_members (listing_id, group_id, is_primary)
      values ($1, $3, true), ($2, $3, false)
      on conflict (listing_id)
      do update set
        group_id = excluded.group_id,
        is_primary = excluded.is_primary
    `,
    [primaryListingId, duplicateListingId, targetGroupId],
  );

  if (primaryGroup && duplicateGroup && primaryGroup !== duplicateGroup) {
    await db.query(
      `
        update listing_duplicate_group_members
        set group_id = $2
        where group_id = $1
      `,
      [duplicateGroup, targetGroupId],
    );

    await db.query(
      `
        delete from listing_duplicate_groups
        where id = $1
      `,
      [duplicateGroup],
    );
  }

  primaryListingId = await choosePreferredPrimaryListingId(
    db,
    primaryListingId,
    duplicateListingId,
    targetGroupId,
  );
  await db.query(
    `
      update listing_duplicate_group_members
      set is_primary = listing_id = $2
      where group_id = $1
    `,
    [targetGroupId, primaryListingId],
  );

  await inheritStableDuplicateFacts(db, targetGroupId);
  await syncDuplicateGroupPrice(db, targetGroupId);
  await markDuplicateHidden(
    db,
    primaryListingId,
    duplicateListingId === primaryListingId ? undefined : duplicateListingId,
  );
  return primaryListingId;
}

export async function inheritStableDuplicateFacts(db: QueryableDb, groupId: string) {
  await db.query(
    `
      with group_facts as (
        select
          case when count(distinct l.year_built) = 1 then min(l.year_built) end as year_built,
          case when count(distinct l.rooms) = 1 then min(l.rooms) end as rooms,
          case when count(distinct l.floor) = 1 then min(l.floor) end as floor,
          case when count(distinct l.total_floors) = 1 then min(l.total_floors) end as total_floors,
          case when count(distinct l.area_sqm) = 1 then min(l.area_sqm) end as area_sqm,
          (array_agg(nullif(trim(l.district), '') order by gm.is_primary desc, l.last_seen_at desc)
            filter (where nullif(trim(l.district), '') is not null))[1] as district,
          (array_agg(nullif(trim(l.neighborhood), '') order by gm.is_primary desc, l.last_seen_at desc)
            filter (where nullif(trim(l.neighborhood), '') is not null))[1] as neighborhood,
          (array_agg(nullif(trim(l.address_text), '') order by gm.is_primary desc, l.last_seen_at desc)
            filter (where nullif(trim(l.address_text), '') is not null))[1] as address_text,
          case when count(distinct (l.latitude,l.longitude)) filter (where l.latitude is not null and l.longitude is not null) = 1
            then min(l.latitude) filter (where l.longitude is not null) end as latitude,
          case when count(distinct (l.latitude,l.longitude)) filter (where l.latitude is not null and l.longitude is not null) = 1
            then min(l.longitude) filter (where l.latitude is not null) end as longitude
        from listing_duplicate_group_members gm
        join listings l on l.id = gm.listing_id
        where gm.group_id = $1
      )
      update listings l
      set
        year_built = coalesce(l.year_built, facts.year_built),
        rooms = coalesce(l.rooms, facts.rooms),
        floor = coalesce(l.floor, facts.floor),
        total_floors = coalesce(l.total_floors, facts.total_floors),
        area_sqm = coalesce(l.area_sqm, facts.area_sqm),
        price_per_sqm = case when l.area_sqm is null and facts.area_sqm > 0 then l.price_amount / facts.area_sqm else l.price_per_sqm end,
        district = coalesce(nullif(trim(l.district), ''), facts.district),
        neighborhood = coalesce(nullif(trim(l.neighborhood), ''), facts.neighborhood),
        address_text = coalesce(nullif(trim(l.address_text), ''), facts.address_text),
        latitude = case when l.latitude is null and l.longitude is null then facts.latitude else l.latitude end,
        longitude = case when l.latitude is null and l.longitude is null then facts.longitude else l.longitude end
      from listing_duplicate_group_members gm, group_facts facts
      where gm.group_id = $1
        and gm.listing_id = l.id
        and (
          (l.year_built is null and facts.year_built is not null) or
          (l.rooms is null and facts.rooms is not null) or
          (l.floor is null and facts.floor is not null) or
          (l.total_floors is null and facts.total_floors is not null) or
          (l.area_sqm is null and facts.area_sqm is not null) or
          (nullif(trim(l.district),'') is null and facts.district is not null) or
          (nullif(trim(l.neighborhood),'') is null and facts.neighborhood is not null) or
          (nullif(trim(l.address_text),'') is null and facts.address_text is not null) or
          (l.latitude is null and l.longitude is null and facts.latitude is not null and facts.longitude is not null)
        )
    `,
    [groupId],
  );
}

async function markDuplicateHidden(
  db: QueryableDb,
  primaryListingId: string,
  duplicateListingId?: string,
) {
  await db.query(
    `
      update listings
      set hidden_duplicate_of_id = null,
          hidden_at = null,
          updated_at = now()
      where id = $1
    `,
    [primaryListingId],
  );

  await db.query(
    `
      update listings
      set hidden_duplicate_of_id = $1,
          hidden_at = now(),
          updated_at = now()
      where id = $2
    `,
    [primaryListingId, duplicateListingId],
  );

  await db.query(
    `
      update listings
      set hidden_duplicate_of_id = $1,
          hidden_at = coalesce(hidden_at, now()),
          updated_at = now()
      where id in (
        select member.listing_id
        from listing_duplicate_group_members primary_member
        join listing_duplicate_group_members member on member.group_id = primary_member.group_id
        where primary_member.listing_id = $1
          and member.listing_id <> $1
      )
    `,
    [primaryListingId],
  );
}

function parseReviewStatus(value?: string | null): DuplicateReviewStatus {
  if (value === "same_listing" || value === "different_listing") {
    return value;
  }

  return "pending";
}

function buildDuplicatePairKey(leftId: string, rightId: string) {
  return `${leftId}:${rightId}`;
}

function normalizeNullableText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatCurrencyLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  return `${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(Number(value))} PLN`;
}

function formatAreaLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  const numeric = Number(value);
  return `${new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(numeric)} m2`;
}

function formatIntegerLabel(value: string) {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function trimNumeric(value: string) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function normalizedTextKeySql(expression: string) {
  return `regexp_replace(lower(translate(${expression}, 'ąćęłńóśźż', 'acelnoszz')), '[^a-z0-9 ]', '', 'g')`;
}

function normalizedAddressKeySql(expression: string) {
  return `regexp_replace(${normalizedTextKeySql(expression)}, '\\s+', '', 'g')`;
}

function normalizedStreetKeySql(expression: string) {
  return `regexp_replace(regexp_replace(${normalizedTextKeySql(`split_part(${expression}, ',', 1)`)}, '(ej|ego|emu|ie|a|y|u|ow|ów)$', '', 'g'), '\\s+', '', 'g')`;
}

function normalizedStreetKey(value: string) {
  return value
    .split(",", 1)[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/(ej|ego|emu|ie|a|y|u|ow|ow)$/g, "")
    .replace(/\s+/g, "");
}

function descriptionPrefixMatchSql(leftExpression: string, rightExpression: string) {
  const leftTokens = `regexp_split_to_array(trim(${normalizedTextKeySql(leftExpression)}), '\\s+')`;
  const rightTokens = `regexp_split_to_array(trim(${normalizedTextKeySql(rightExpression)}), '\\s+')`;
  return `(
    array_length(${leftTokens}, 1) >= ${exactDescriptionPrefixWordCount}
    and array_length(${rightTokens}, 1) >= ${exactDescriptionPrefixWordCount}
    and (${leftTokens})[1:${exactDescriptionPrefixWordCount}] = (${rightTokens})[1:${exactDescriptionPrefixWordCount}]
  )`;
}

function choosePrimaryListingId(left: AutoMergeListingRow, right: AutoMergeListingRow) {
  const leftPriority = sourcePriority.indexOf(left.source_key);
  const rightPriority = sourcePriority.indexOf(right.source_key);
  const normalizedLeftPriority = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
  const normalizedRightPriority = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;
  if (normalizedLeftPriority !== normalizedRightPriority) {
    return normalizedLeftPriority < normalizedRightPriority ? left.id : right.id;
  }

  if (left.existing_primary_id) {
    return left.existing_primary_id;
  }

  if (right.existing_primary_id) {
    return right.existing_primary_id;
  }

  return new Date(left.created_at).getTime() <= new Date(right.created_at).getTime()
    ? left.id
    : right.id;
}

export async function choosePreferredPrimaryListingId(
  db: QueryableDb,
  leftId: string,
  rightId: string,
  groupId?: string,
) {
  const options = await getDuplicatePrimaryOptions(db, [leftId, rightId], groupId);
  return options[0]?.id ?? leftId;
}

type PrimaryOption = {
  id: string;
  title: string;
  source_label: string;
  source_key: string;
  created_at: string;
  status: string;
  source_count?: string;
  group_id?: string;
};

function compareDuplicatePrimaryOptions(left: PrimaryOption, right: PrimaryOption) {
  return (
    Number(right.status === "active") - Number(left.status === "active") ||
    Number(right.source_key === "otodom") - Number(left.source_key === "otodom") ||
    Number(right.source_count ?? 0) - Number(left.source_count ?? 0) ||
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime() ||
    left.id.localeCompare(right.id)
  );
}

async function getDuplicatePrimaryOptions(
  db: QueryableDb,
  listingIds: string[],
  groupId?: string,
  includeOtherMembers = false,
) {
  if (!listingIds.length) return [];
  const result = await db.query<PrimaryOption>(
    `with source_counts as materialized (
      select source_id, count(*)::text as source_count from listings group by source_id
    )
     select l.id, l.title, s.key as source_key, s.name as source_label, l.created_at::text, l.status,
       counts.source_count, member.group_id
     from listings l join sources s on s.id = l.source_id
     join source_counts counts on counts.source_id = l.source_id
     left join listing_duplicate_group_members member on member.listing_id = l.id
     where l.id = any($1::uuid[]) or member.group_id = $2::uuid or member.group_id in (
       select group_id from listing_duplicate_group_members where $3::boolean and listing_id = any($1::uuid[])
     )`,
    [listingIds, groupId ?? null, includeOtherMembers],
  );
  return result.rows.sort(compareDuplicatePrimaryOptions);
}

function computeDescriptionSimilarity(leftTokens: string[], rightTokens: string[]) {
  if (leftTokens.length < 25 || rightTokens.length < 25) {
    return 0;
  }

  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  let overlap = 0;

  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(left.size, right.size);
}

function tokenizeDescription(value?: string | null) {
  if (!value) {
    return [];
  }

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

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function tokenizeDescriptionPrefix(value?: string | null) {
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

function countMatchingDescriptionPrefixWords(left: string[], right: string[]) {
  const limit = Math.min(left.length, right.length);
  let matching = 0;
  while (matching < limit && left[matching] === right[matching]) {
    matching += 1;
  }
  return matching;
}
