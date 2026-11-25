import type { ListingDetail } from "@mieszkania/shared";
import { formatPriceEvent } from "../lib/contact";
import { formatViewingDate } from "../../../shared/lib/format";

type HistoryListing = Pick<
  ListingDetail,
  "publishedAt" | "firstSeenAt" | "sourceLabel" | "priceHistory" | "earlierPublications"
>;

export function ListingPriceHistory({
  listing,
  onOpen,
}: {
  listing: HistoryListing;
  onOpen: (id: string) => void | Promise<void>;
}) {
  const events = [...listing.priceHistory];
  if (listing.publishedAt)
    events.push({
      eventType: "published",
      changedAt: listing.publishedAt,
      sourceLabel: listing.sourceLabel,
    });
  if (listing.firstSeenAt && !events.some((event) => event.eventType === "created"))
    events.push({ eventType: "created", changedAt: listing.firstSeenAt });
  events.sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
  const [earliest, ...others] = listing.earlierPublications ?? [];
  const archiveEntry = (item: NonNullable<HistoryListing["earlierPublications"]>[number]) => (
    <p key={item.id} className="publication-history-entry">
      <span>
        {item.dateOrigin === "portal" ? "Publikacja na portalu" : "Pierwszy zapis w aplikacji"} ·{" "}
        {formatViewingDate(item.knownSince)} · {item.source}
      </span>
      <button type="button" className="detail-duplicate-title" onClick={() => void onOpen(item.id)}>
        Otwórz archiwalne ogłoszenie
      </button>
    </p>
  );
  return (
    <div className="result-box detail-sidebar-box">
      <strong>Historia ogłoszenia i ceny</strong>
      {earliest && (
        <div className="publication-history-archive">
          <strong>To mieszkanie było już wcześniej wystawione</strong>
          {archiveEntry(earliest)}
          {others.length > 0 && (
            <details>
              <summary>Pozostałe wcześniejsze ogłoszenia ({others.length})</summary>
              {others.map(archiveEntry)}
            </details>
          )}
        </div>
      )}
      {events.length > 0 ? (
        <ul className="result-list">
          {events.map((event, index) => (
            <li key={`${event.changedAt}-${index}`}>{formatPriceEvent(event)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Brak zapisanej historii tego ogłoszenia.</p>
      )}
    </div>
  );
}
