export const NEWLY_DISCOVERED_PUBLICATION_GAP_DAYS = 30;

type ListingDates = {
  publishedAt?: string | Date | null;
  firstSeenAt?: string | Date | null;
};

export function buildEffectiveListingDateSql(tableAlias = "l") {
  return `case
    when ${tableAlias}.first_seen_at is not null
      and (
        ${tableAlias}.published_at is null
        or ${tableAlias}.published_at < ${tableAlias}.first_seen_at - interval '${NEWLY_DISCOVERED_PUBLICATION_GAP_DAYS} days'
      )
      then ${tableAlias}.first_seen_at
    else ${tableAlias}.published_at
  end`;
}

export function getEffectiveListingDate({ publishedAt, firstSeenAt }: ListingDates) {
  const published = toDate(publishedAt);
  const firstSeen = toDate(firstSeenAt);

  if (!firstSeen) return published;
  if (!published) return firstSeen;

  const publicationGapMs = firstSeen.getTime() - published.getTime();
  const thresholdMs = NEWLY_DISCOVERED_PUBLICATION_GAP_DAYS * 24 * 60 * 60 * 1000;
  return publicationGapMs > thresholdMs ? firstSeen : published;
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
