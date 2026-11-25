import type { RelistedListingMatch } from "@mieszkania/shared";
import { DuplicatePreview } from "../duplicates/DuplicatePreview";
import { formatOptionalPln } from "../../shared/lib/format";
import { RelistingMatches } from "./RelistingMatches";

export function RelistingTimeline({
  group,
  onOpenListing,
}: {
  group: RelistedListingMatch[];
  onOpenListing: (id: string) => unknown;
}) {
  if (group.length === 1 && group[0].reviewable)
    return <RelistingMatches items={group} onOpenListing={onOpenListing} />;
  const offers = [
    ...new Map(
      group.flatMap((match) => [match.previous, match.current]).map((offer) => [offer.id, offer]),
    ).values(),
  ].sort(
    (a, b) =>
      Date.parse(a.firstSeenAt ?? a.eventAt) - Date.parse(b.firstSeenAt ?? b.eventAt) ||
      a.id.localeCompare(b.id),
  );
  return (
    <article className="relisting-result-card relisting-history">
      <h3>Historia ogłoszenia · liczba publikacji: {offers.length}</h3>
      <div className="relisting-timeline">
        {offers.map((offer) => (
          <div className="relisting-offer-row" key={offer.id}>
            <strong>
              {new Date(offer.firstSeenAt ?? offer.eventAt).toLocaleDateString("pl-PL")} ·{" "}
              {offer.isActive ? "Aktywna" : "Archiwalna"}
            </strong>
            <span>
              {offer.sourceLabel} · {formatOptionalPln(offer.priceAmount)}
            </span>
            <DuplicatePreview
              id={offer.id}
              title={offer.title}
              urls={offer.thumbnailUrls}
              sharedFromIndex={offer.thumbnailSharedFromIndex}
              onOpen={onOpenListing}
            />
            <button
              type="button"
              className="text-link-button"
              onClick={() => onOpenListing(offer.id)}
            >
              {offer.title}
            </button>
          </div>
        ))}
      </div>
      <details>
        <summary>Powiązania między publikacjami ({group.length})</summary>
        <RelistingMatches items={group} onOpenListing={onOpenListing} />
      </details>
    </article>
  );
}
