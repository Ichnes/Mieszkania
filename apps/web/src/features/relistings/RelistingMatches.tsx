import type { RelistedListingMatch } from "@mieszkania/shared";
import { formatOptionalPln, formatPln } from "../../shared/lib/format";

export function RelistingMatches({
  items,
  potential = false,
  onOpenListing,
}: {
  items: RelistedListingMatch[];
  potential?: boolean;
  onOpenListing: (id: string) => unknown;
}) {
  return (
    <div className="relisting-result-grid">
      {items.map((match) => {
        const difference = match.priceDifferenceAmount;
        const differenceClass = !difference
          ? "is-neutral"
          : difference < 0
            ? "is-lower"
            : "is-higher";
        return (
          <article
            className="relisting-result-card"
            key={`${match.previous.id}:${match.current.id}`}
          >
            {potential && (
              <strong className="relisting-candidate-label">
                Potencjalna wcześniejsza oferta · do sprawdzenia
              </strong>
            )}
            {[match.previous, match.current].map((offer, index) => (
              <div
                className={`relisting-offer-row ${index ? "is-current" : "is-archived"}`}
                key={offer.id}
              >
                <span>
                  {index ? "Aktualna" : "Archiwalna"} · {offer.sourceLabel}
                </span>
                <button
                  className="text-link-button"
                  type="button"
                  onClick={() => void onOpenListing(offer.id)}
                >
                  {offer.title}
                </button>
                <strong>{formatOptionalPln(offer.priceAmount)}</strong>
                {offer.addressText && <small>{offer.addressText}</small>}
                <small>
                  {[
                    offer.areaSqm !== undefined ? `${offer.areaSqm} m²` : null,
                    offer.rooms !== undefined ? `${offer.rooms} pok.` : null,
                    offer.floor !== undefined ? `piętro ${offer.floor}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <small>
                  {index ? "Dodano" : "Archiwizacja"}:{" "}
                  {new Date(offer.eventAt).toLocaleDateString("pl-PL")}
                </small>
              </div>
            ))}
            <div className={`relisting-price-difference ${differenceClass}`}>
              <span>{potential ? "Różnica cen ofert" : "Różnica ceny"}</span>
              <strong>
                {difference === undefined
                  ? "brak danych"
                  : `${difference > 0 ? "+" : ""}${formatPln(difference)}`}
              </strong>
              {match.priceDifferencePercent !== undefined && (
                <small>
                  {match.priceDifferencePercent > 0 ? "+" : ""}
                  {match.priceDifferencePercent.toFixed(1)}%
                </small>
              )}
            </div>
            <small className="relisting-reasons">
              {potential ? "Podobieństwo" : "Pewność"} {match.confidenceScore}% ·{" "}
              {match.reasons.join(", ")}
            </small>
          </article>
        );
      })}
    </div>
  );
}
