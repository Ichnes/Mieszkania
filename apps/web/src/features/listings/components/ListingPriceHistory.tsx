import type { ListingDetail } from "@mieszkania/shared";
import { ArrowRight, History } from "lucide-react";
import { useState } from "react";
import { formatPln } from "../../../shared/lib/format";

type HistoryListing = Pick<
  ListingDetail,
  | "id"
  | "publishedAt"
  | "firstSeenAt"
  | "sourceLabel"
  | "removedAt"
  | "priceHistory"
  | "earlierPublications"
>;
type TimelineEvent = ListingDetail["priceHistory"][number] & {
  archive?: NonNullable<ListingDetail["earlierPublications"]>[number];
  openArchive?: boolean;
};
const dayFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});
const timeFormat = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

function eventTitle(event: TimelineEvent) {
  switch (event.eventType) {
    case "published":
      return event.archive ? "Publikacja wcześniejszego ogłoszenia" : "Publikacja ogłoszenia";
    case "created":
      return event.archive
        ? "Pierwszy zapis wcześniejszego ogłoszenia"
        : "Pierwszy zapis w aplikacji";
    case "first_price":
      return "Pierwszy zapis ceny w archiwalnym ogłoszeniu";
    case "removed":
      return "Odnotowano zdjęcie z portalu";
    case "price_drop":
      return "Obniżka ceny";
    case "price_increase":
      return "Podwyżka ceny";
    case "relisted":
      return "Ogłoszenie ponownie dostępne";
    default:
      return event.eventType;
  }
}

function timeline(listing: HistoryListing, expanded: boolean) {
  const events: TimelineEvent[] = [...listing.priceHistory];
  if (listing.publishedAt)
    events.push({
      eventType: "published",
      changedAt: listing.publishedAt,
      sourceLabel: listing.sourceLabel,
    });
  if (listing.firstSeenAt && !events.some((e) => e.eventType === "created"))
    events.push({ eventType: "created", changedAt: listing.firstSeenAt });
  if (listing.removedAt) {
    const lastStatus = events
      .filter((e) => e.eventType === "removed" || e.eventType === "relisted")
      .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt))[0];
    if (lastStatus?.eventType !== "removed")
      events.push({ eventType: "removed", changedAt: listing.removedAt });
  }
  const archives = listing.earlierPublications ?? [];
  for (const archive of expanded ? archives : archives.slice(0, 1)) {
    const start: TimelineEvent = {
      archive,
      eventType: archive.dateOrigin === "portal" ? "published" : "created",
      changedAt: archive.knownSince,
      openArchive: !archive.removedAt,
    };
    events.push(start);
    if (
      archive.firstRecordedAt &&
      (archive.dateOrigin === "portal" || archive.firstRecordedAt !== archive.knownSince)
    ) {
      events.push({
        archive,
        eventType: archive.dateOrigin === "portal" ? "created" : "first_price",
        changedAt: archive.firstRecordedAt,
        newPriceAmount: archive.firstRecordedPrice,
      });
    } else if (start.eventType === "created") start.newPriceAmount = archive.firstRecordedPrice;
    if (archive.removedAt)
      events.push({
        archive,
        eventType: "removed",
        changedAt: archive.removedAt,
        openArchive: true,
      });
  }
  const days = new Map<string, TimelineEvent[]>();
  for (const event of events.sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt))) {
    const day = dayFormat.format(new Date(event.changedAt));
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(event);
  }
  return days;
}

export function ListingPriceHistory({
  listing,
  onOpen,
}: {
  listing: HistoryListing;
  onOpen: (id: string) => void | Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string>();
  const expanded = expandedId === listing.id;
  const days = timeline(listing, expanded);
  const archiveCount = listing.earlierPublications?.length ?? 0;
  return (
    <section
      className="result-box detail-sidebar-box publication-history"
      aria-label="Historia ogłoszenia i ceny"
    >
      <h3>
        <History size={18} aria-hidden="true" />
        Historia ogłoszenia i ceny
      </h3>
      {Array.from(days, ([day, events]) => (
        <div className="history-day" key={day}>
          <h4>{day}</h4>
          <ol>
            {events.map((event, index) => {
              const changedPrice =
                event.eventType === "price_drop" || event.eventType === "price_increase";
              const source = event.sourceLabel ?? event.archive?.source;
              return (
                <li
                  key={`${event.archive?.id ?? listing.id}-${event.changedAt}-${index}`}
                  className={event.eventType === "removed" ? "history-removed" : undefined}
                >
                  <time dateTime={event.changedAt}>
                    {timeFormat.format(new Date(event.changedAt))}
                  </time>
                  <div className="history-event">
                    <span className="history-event-title">{eventTitle(event)}</span>
                    {event.newPriceAmount != null && event.eventType !== "removed" && (
                      <span className="history-price">
                        {changedPrice && event.previousPriceAmount != null && (
                          <>
                            <span>{formatPln(event.previousPriceAmount)}</span> →{" "}
                          </>
                        )}
                        {formatPln(event.newPriceAmount)}
                      </span>
                    )}
                    {source && !event.openArchive && <small>{source}</small>}
                    {event.openArchive && event.archive && (
                      <>
                        {!event.archive.removedAt && <small>Data zdjęcia z portalu nieznana</small>}
                        <button
                          type="button"
                          className="history-archive-link"
                          onClick={() => void onOpen(event.archive!.id)}
                        >
                          Archiwum · {event.archive.source}
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {!days.size && <p className="muted">Brak zapisanej historii tego ogłoszenia.</p>}
      {archiveCount > 1 && (
        <button
          type="button"
          className="history-archive-link"
          aria-expanded={expanded}
          onClick={() => setExpandedId(expanded ? undefined : listing.id)}
        >
          {expanded
            ? "Zwiń dodatkowe ogłoszenia"
            : `Pokaż pozostałe wcześniejsze ogłoszenia (${archiveCount - 1})`}
        </button>
      )}
    </section>
  );
}
