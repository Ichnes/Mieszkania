import type { RelistedListingMatch } from "@mieszkania/shared";
import { useState } from "react";
import { saveRelistingReview } from "./review";
import { formatOptionalPln, formatPln } from "../../shared/lib/format";

export function RelistingMatches({
  items,
  potential = false,
  onOpenListing,
  onReviewed,
}: {
  items: RelistedListingMatch[];
  potential?: boolean;
  onOpenListing: (id: string) => unknown;
  onReviewed?: (match: RelistedListingMatch, decision: "confirmed" | "rejected") => void;
}) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<{ key: string; message: string }>();
  const [decisions, setDecisions] = useState<Record<string, "confirmed" | "rejected">>({});
  const [notice, setNotice] = useState("");
  async function review(match: RelistedListingMatch, decision: "confirmed" | "rejected") {
    const key = `${match.previous.id}:${match.current.id}`;
    setBusy(key);
    setError(undefined);
    try {
      await saveRelistingReview(match, decision);
      setDecisions((current) => ({ ...current, [key]: decision }));
      setNotice(
        decision === "confirmed"
          ? "Połączono oferty jako ponowne wystawienie. Historia i ceny obu ogłoszeń zostały zachowane."
          : "Odrzucono parę. Kolejne skany nie zaproponują jej ponownie.",
      );
      onReviewed?.(match, decision);
    } catch (e) {
      setError({ key, message: e instanceof Error ? e.message : "Nie udało się zapisać decyzji." });
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <div className="relisting-result-grid">
      {notice && (
        <p className="relisting-review-notice" role="status">
          {notice}
        </p>
      )}
      {items.map((match) => {
        const key = `${match.previous.id}:${match.current.id}`;
        if (
          decisions[key] ||
          Object.entries(decisions).some(
            ([pair, decision]) => decision === "confirmed" && pair.endsWith(`:${match.current.id}`),
          )
        )
          return null;
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
            {!potential && (
              <strong className="relisting-candidate-label">
                {match.manuallyConfirmed ? "Połączone ręcznie" : "Połączone automatycznie"}
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
            {potential && (
              <div className="relisting-review-actions">
                <button
                  type="button"
                  className="action-button"
                  disabled={Boolean(busy)}
                  onClick={() => void review(match, "confirmed")}
                >
                  {busy === key ? "Zapisywanie…" : "Połącz jako ponowne wystawienie"}
                </button>
                <button
                  type="button"
                  className="action-button secondary-button"
                  disabled={Boolean(busy)}
                  onClick={() => void review(match, "rejected")}
                >
                  To inne mieszkania
                </button>
              </div>
            )}
            {error?.key === key && (
              <p className="error-text" role="alert">
                {error.message}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
