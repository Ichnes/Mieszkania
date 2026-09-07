import type { ListingSummary } from "@mieszkania/shared";
import { formatViewingDate } from "../../shared/lib/format";
import { ListingBadgeRow } from "../listings/components/ListingBadgeRow";
import { contactStatusDisplay, decisionStageDisplay } from "../listings/lib/contact";

export function CompareBoard(input: {
  listings: ListingSummary[];
  onOpen: (listingId: string) => void | Promise<void>;
  onRemove: (listingId: string) => void;
}) {
  if (input.listings.length === 0) {
    return <div className="result-box">Dodaj 2-5 ofert z kart przez przycisk `Porównaj`.</div>;
  }

  return (
    <div className="compare-board">
      {input.listings.map((listing) => (
        <article key={listing.id} className="compare-card">
          <div className="compare-card-header">
            <div className="compare-card-heading">
              <button
                type="button"
                className="map-card-title"
                onClick={() => void input.onOpen(listing.id)}
              >
                {listing.title}
              </button>
              <p className="muted">
                {listing.district}
                {listing.neighborhood ? ` / ${listing.neighborhood}` : ""}
              </p>
              <ListingBadgeRow badges={listing.badges.slice(0, 4)} />
            </div>
            <button
              type="button"
              className="action-button secondary-button"
              onClick={() => input.onRemove(listing.id)}
            >
              Usuń
            </button>
          </div>

          <div className="compare-card-body">
            {listing.thumbnailUrl ? (
              <img
                className="compare-card-image"
                src={listing.thumbnailUrl}
                alt={listing.title}
                loading="lazy"
              />
            ) : null}
            <div className="compare-card-grid">
              <CompareField label="Cena" value={listing.priceLabel} />
              <CompareField label="Metraz" value={listing.areaLabel} />
              <CompareField label="PLN/m2" value={listing.pricePerSqmLabel ?? "-"} />
              <CompareField label="Etap" value={decisionStageDisplay(listing.decisionStage)} />
              <CompareField label="Kontakt" value={contactStatusDisplay(listing.contactStatus)} />
              <CompareField
                label="Oglądanie"
                value={
                  listing.viewingScheduledAt ? formatViewingDate(listing.viewingScheduledAt) : "-"
                }
              />
              <CompareField
                label="Wymarzone mieszkanie"
                value={typeof listing.dreamScore === "number" ? `${listing.dreamScore}%` : "-"}
              />
              <CompareField label="RCN" value={listing.rcnDeltaLabel} />
              <CompareField label="Podsumowanie" value={listing.summary} wide />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CompareField(input: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={input.wide ? "compare-field compare-field-wide" : "compare-field"}>
      <span className="compare-field-label">{input.label}</span>
      <strong className="compare-field-value">{input.value}</strong>
    </div>
  );
}
