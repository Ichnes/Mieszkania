import type {
  DuplicateCandidate,
  DuplicateCandidatesResponse,
  DuplicateListingPreview,
  DuplicateReviewStatus,
  RelatedListingSummary,
} from "@mieszkania/shared";
import type { Pool, PoolClient } from "pg";
import { withDb } from "../../db";
import { getMediaResponsePath } from "../media/image-repository";
import { syncDuplicateGroupPrice, restoreSourcePrice } from "./group-prices";

type QueryableDb = Pick<Pool | PoolClient, "query">;

type DuplicateCandidateRow = {
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
  confidence_score: string;
  reason_summary: string;
  review_status: string | null;
};

type RelatedListingRow = {
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
): Promise<DuplicateCandidatesResponse> {
  const leftAddressKey = normalizedAddressKeySql("coalesce(l1.address_text, '')");
  const rightAddressKey = normalizedAddressKeySql("coalesce(l2.address_text, '')");
  const leftDistrictKey = normalizedTextKeySql("coalesce(l1.district, '')");
  const rightDistrictKey = normalizedTextKeySql("coalesce(l2.district, '')");
  const leftStreetKey = normalizedStreetKeySql("coalesce(l1.address_text, '')");
  const rightStreetKey = normalizedStreetKeySql("coalesce(l2.address_text, '')");
  const descriptionOverlap = descriptionTokenOverlapSql(
    "coalesce(l1.description, '')",
    "coalesce(l2.description, '')",
  );

  return withDb(async (db) => {
    const result = await db.query<DuplicateCandidateRow>(
      `
        with pair_base as (
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
            coalesce(g2.group_size::text, '0') as right_group_size,
            ${descriptionOverlap} as description_overlap,
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
          from listings l1
          join listings l2 on l1.id < l2.id
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
          where l1.status = 'active'
            and l2.status = 'active'
            and l1.hidden_duplicate_of_id is null
            and l2.hidden_duplicate_of_id is null
            and l1.city = l2.city
            and l1.source_id <> l2.source_id
            and ($1::uuid is null or l1.id = $1::uuid or l2.id = $1::uuid)
            and (
              l1.rooms is not null and l2.rooms is not null and l1.rooms = l2.rooms
            )
            and (
              l1.area_sqm is not null and l2.area_sqm is not null and abs(l1.area_sqm - l2.area_sqm) <= 3.0
            )
            and (
              l1.price_amount is not null and l2.price_amount is not null
              and (
                abs(l1.price_amount - l2.price_amount) <= 60000
                or (
                  greatest(l1.price_amount, l2.price_amount) > 0
                  and abs(l1.price_amount - l2.price_amount) / greatest(l1.price_amount, l2.price_amount) <= 0.05
                )
              )
            )
            and (
              nullif(${leftStreetKey}, '') is not null and ${leftStreetKey} = ${rightStreetKey}
              or ${descriptionOverlap} >= 12
              or (
                l1.latitude is not null and l1.longitude is not null and l2.latitude is not null and l2.longitude is not null
                and abs(l1.latitude - l2.latitude) <= 0.0009
                and abs(l1.longitude - l2.longitude) <= 0.0009
              )
            )
        )
        select *
        from pair_base
        where confidence_score >= 60
          and ($1::uuid is null or left_id = $1::uuid or right_id = $1::uuid)
          and coalesce(review_status, 'pending') <> 'different_listing'
        order by
          case when coalesce(review_status, 'pending') = 'pending' then 0 else 1 end,
          confidence_score desc,
          left_title asc
        limit $2
      `,
      [listingId ?? null, Math.max(10, Math.min(limit, 500))],
    );

    const items = result.rows.map(mapDuplicateCandidateRow);
    return {
      total: items.length,
      items,
    };
  });
}

export async function reviewDuplicateCandidate(input: {
  leftId: string;
  rightId: string;
  primaryListingId?: string;
  status: Exclude<DuplicateReviewStatus, "pending">;
  notes?: string;
}) {
  return withDb(async (pool) => {
    const db = await pool.connect();
    const leftId = input.leftId < input.rightId ? input.leftId : input.rightId;
    const rightId = input.leftId < input.rightId ? input.rightId : input.leftId;
    const pairKey = buildDuplicatePairKey(leftId, rightId);

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
        if (!(await duplicateGroupsCompatible(db, input.leftId, input.rightId, false))) {
          throw Object.assign(
            new Error("Nie można połączyć ofert: różnica metrażu przekracza 2%."),
            { statusCode: 409 },
          );
        }
        const primaryListingId = await choosePreferredPrimaryListingId(
          db,
          input.leftId,
          input.rightId,
        );
        const duplicateListingId = primaryListingId === input.leftId ? input.rightId : input.leftId;
        await mergeDuplicateGroup(db, primaryListingId, duplicateListingId);
        await markDuplicateHidden(db, primaryListingId, duplicateListingId);
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
      return { pairKey, status: input.status };
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

  await mergeDuplicateGroup(db, primaryListingId, duplicateListingId);
  await markDuplicateHidden(db, primaryListingId, duplicateListingId);

  return {
    pairKey,
    primaryListingId,
    duplicateListingId,
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
              await markDuplicateHidden(db, primary.id, duplicate.id);
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

export type DuplicateGroupOverview = {
  groupId: string;
  primaryListingId: string;
  primaryTitle: string;
  members: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    canonicalUrl?: string;
    thumbnailUrl?: string;
    priceLabel: string;
    areaLabel: string;
    isPrimary: boolean;
  }>;
};

export async function getDuplicateGroupOverviews(
  limit?: number,
  summary?: false,
): Promise<DuplicateGroupOverview[]>;
export async function getDuplicateGroupOverviews(
  limit: number,
  summary: true,
): Promise<{
  items: DuplicateGroupOverview[];
  total: number;
  totalMembers: number;
  totalCopies: number;
}>;
export async function getDuplicateGroupOverviews(limit = 200, summary = false) {
  return withDb(async (db) => {
    const result = await db.query<{
      group_id: string;
      listing_id: string;
      is_primary: boolean;
      title: string;
      source_label: string | null;
      canonical_url: string;
      price_amount: string | null;
      area_sqm: string | null;
      thumbnail_storage_key: string | null;
      thumbnail_source_url: string | null;
    }>(`
      select gm.group_id::text, gm.listing_id::text, gm.is_primary, l.title, s.name as source_label, l.canonical_url, l.price_amount::text, l.area_sqm::text, preview.storage_key as thumbnail_storage_key, preview.source_url as thumbnail_source_url
      from listing_duplicate_group_members gm
      join listings l on l.id = gm.listing_id
      join sources s on s.id = l.source_id
      left join lateral (
        select asset.storage_key, image.source_url
        from listing_duplicate_group_members image_member
        join listing_images image on image.listing_id = image_member.listing_id
        left join listing_media_assets asset on asset.id = image.asset_id
        where image_member.listing_id = l.id
        order by (image_member.listing_id = l.id) desc, image.is_primary desc, image.position asc
        limit 1
      ) preview on true
      join listing_duplicate_groups dg on dg.id = gm.group_id
      where dg.manually_confirmed = false
        and exists (select 1 from listing_duplicate_group_members x where x.group_id = gm.group_id having count(*) > 1)
      order by gm.group_id, gm.is_primary desc, l.last_seen_at desc nulls last
    `);
    const grouped = new Map<string, DuplicateGroupOverview>();
    for (const row of result.rows) {
      const existing = grouped.get(row.group_id);
      const member = {
        id: row.listing_id,
        title: row.title,
        sourceLabel: row.source_label ?? "Portal",
        canonicalUrl: row.canonical_url ?? undefined,
        thumbnailUrl: row.thumbnail_storage_key
          ? getMediaResponsePath(row.thumbnail_storage_key)
          : (row.thumbnail_source_url ?? undefined),
        priceLabel: formatCurrencyLabel(row.price_amount),
        areaLabel: formatAreaLabel(row.area_sqm),
        isPrimary: row.is_primary,
      };
      if (existing) {
        existing.members.push(member);
        if (row.is_primary) {
          existing.primaryListingId = row.listing_id;
          existing.primaryTitle = row.title;
        }
        continue;
      }
      grouped.set(row.group_id, {
        groupId: row.group_id,
        primaryListingId: row.is_primary ? row.listing_id : "",
        primaryTitle: row.is_primary ? row.title : "Oferta powiązana",
        members: [member],
      });
    }
    const groups = [...grouped.values()].filter(
      (group) => group.primaryListingId && group.members.length > 1,
    );
    const safeLimit = Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 200);
    const items = groups.slice(0, summary ? safeLimit : Math.min(safeLimit, 500));
    const totalMembers = new Set(
      groups.flatMap((group) => group.members.map((member) => member.id)),
    ).size;
    const totalCopies = new Set(
      groups.flatMap((group) =>
        group.members.filter((member) => !member.isPrimary).map((member) => member.id),
      ),
    ).size;
    return summary ? { items, total: groups.length, totalMembers, totalCopies } : items;
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

export async function getPotentialDuplicateCounts(listingIds: string[]) {
  if (listingIds.length === 0) {
    return new Map<string, number>();
  }

  const leftDistrictKey = normalizedTextKeySql("coalesce(l1.district, '')");
  const rightDistrictKey = normalizedTextKeySql("coalesce(l2.district, '')");
  const leftAddressKey = normalizedAddressKeySql("coalesce(l1.address_text, '')");
  const rightAddressKey = normalizedAddressKeySql("coalesce(l2.address_text, '')");
  const leftStreetKey = normalizedStreetKeySql("coalesce(l1.address_text, '')");
  const rightStreetKey = normalizedStreetKeySql("coalesce(l2.address_text, '')");
  const descriptionOverlap = descriptionTokenOverlapSql(
    "coalesce(l1.description, '')",
    "coalesce(l2.description, '')",
  );

  return withDb(async (db) => {
    const result = await db.query<{ listing_id: string; candidate_count: string }>(
      `
        with pairs as (
          select
            l1.id as left_id,
            l2.id as right_id,
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
            ) as confidence_score
          from listings l1
          join listings l2 on l1.id < l2.id
          where l1.status = 'active'
            and l2.status = 'active'
            and l1.hidden_duplicate_of_id is null
            and l2.hidden_duplicate_of_id is null
            and l1.city = l2.city
            and l1.source_id <> l2.source_id
            and (
              l1.rooms is not null and l2.rooms is not null and l1.rooms = l2.rooms
            )
            and (
              l1.area_sqm is not null and l2.area_sqm is not null and abs(l1.area_sqm - l2.area_sqm) <= 3.0
            )
            and (
              l1.price_amount is not null and l2.price_amount is not null
              and (
                abs(l1.price_amount - l2.price_amount) <= 60000
                or (
                  greatest(l1.price_amount, l2.price_amount) > 0
                  and abs(l1.price_amount - l2.price_amount) / greatest(l1.price_amount, l2.price_amount) <= 0.05
                )
              )
            )
            and (
              nullif(${leftStreetKey}, '') is not null and ${leftStreetKey} = ${rightStreetKey}
              or ${descriptionOverlap} >= 12
              or (
                l1.latitude is not null and l1.longitude is not null and l2.latitude is not null and l2.longitude is not null
                and abs(l1.latitude - l2.latitude) <= 0.0009
                and abs(l1.longitude - l2.longitude) <= 0.0009
              )
            )
            and not exists (
              select 1
              from listing_duplicate_reviews r
              where r.pair_key = concat(least(l1.id::text, l2.id::text), ':', greatest(l1.id::text, l2.id::text))
                and r.status = 'different_listing'
            )
        ),
        exploded as (
          select left_id as listing_id, right_id as other_id from pairs
          where confidence_score >= 60
          union all
          select right_id as listing_id, left_id as other_id from pairs
          where confidence_score >= 60
        )
        select listing_id, count(*)::text as candidate_count
        from exploded
        where listing_id = any($1::uuid[])
        group by listing_id
      `,
      [listingIds],
    );

    return new Map(result.rows.map((row) => [row.listing_id, Number(row.candidate_count)]));
  });
}

function mapDuplicateCandidateRow(row: DuplicateCandidateRow): DuplicateCandidate {
  return {
    pairKey: buildDuplicatePairKey(row.left_id, row.right_id),
    confidenceScore: Number(row.confidence_score),
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
        other.canonical_url,
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
    canonicalUrl: row.canonical_url,
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
  const result = await db.query<{ compatible: boolean }>(
    `
    with members as (
      select l.id, l.area_sqm from listings l
      where l.id in ($1::uuid, $2::uuid) or l.id in (
        select m.listing_id from listing_duplicate_group_members m
        where m.group_id in (select group_id from listing_duplicate_group_members where listing_id in ($1::uuid, $2::uuid))
      )
    )
    select coalesce(max(area_sqm) - min(area_sqm) <= min(area_sqm) * 0.02, not $3::boolean)
      and (not $3::boolean or count(*) filter (where area_sqm > 0) = count(*))
      and (not $3::boolean or not exists (
        select 1 from listing_duplicate_reviews r
        where r.status = 'different_listing'
          and r.listing_id_left in (select id from members)
          and r.listing_id_right in (select id from members)
      )) as compatible from members
  `,
    [leftId, rightId, automatic],
  );
  return result.rows[0]?.compatible === true;
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
  duplicateListingId: string,
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

function descriptionTokenOverlapSql(leftExpression: string, rightExpression: string) {
  return `
    (
      select count(*)::int
      from (
        select left_token.token
        from unnest(regexp_split_to_array(substring(${normalizedTextKeySql(leftExpression)} from 1 for 300), '\\s+')) as left_token(token)
        where length(left_token.token) >= 4
          and left_token.token not in ('mieszkanie', 'sprzedaz', 'oferta', 'nieruchomosci', 'warszawa', 'lokalizacja', 'pokojowe', 'pokojowy')
        intersect
        select right_token.token
        from unnest(regexp_split_to_array(substring(${normalizedTextKeySql(rightExpression)} from 1 for 300), '\\s+')) as right_token(token)
        where length(right_token.token) >= 4
          and right_token.token not in ('mieszkanie', 'sprzedaz', 'oferta', 'nieruchomosci', 'warszawa', 'lokalizacja', 'pokojowe', 'pokojowy')
      ) overlap_tokens
    )
  `;
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

async function choosePreferredPrimaryListingId(db: QueryableDb, leftId: string, rightId: string) {
  const result = await db.query<{ id: string; source_key: string; created_at: string }>(
    `select l.id, s.key as source_key, l.created_at::text from listings l join sources s on s.id = l.source_id where l.id in ($1, $2)`,
    [leftId, rightId],
  );
  const [left, right] = result.rows;
  if (!left || !right) return leftId;
  return choosePrimaryListingId(
    {
      ...left,
      city: "",
      description: null,
      rooms: null,
      area_sqm: null,
      price_amount: null,
      address_text: null,
      existing_primary_id: null,
    },
    {
      ...right,
      city: "",
      description: null,
      rooms: null,
      area_sqm: null,
      price_amount: null,
      address_text: null,
      existing_primary_id: null,
    },
  );
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
