import type { ListingRelistingHistory, RelistedListingMatch } from "@mieszkania/shared";
import { useState } from "react";
import { saveRelistingReview } from "./review";
import { formatOptionalPln, formatPln } from "../../shared/lib/format";
import { DuplicatePreview } from "../duplicates/DuplicatePreview";

export function RelistingMatches({
  items,
  potential = false,
  showCurrent = true,
  onOpenListing,
  onReviewed,
}: {
  items: Array<
    RelistedListingMatch & Partial<Pick<ListingRelistingHistory, "archiveCopies" | "reviewable">>
  >;
  potential?: boolean;
  showCurrent?: boolean;
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
          ? potential
            ? "Połączono oferty jako ponowne wystawienie. Historia i ceny obu ogłoszeń zostały zachowane."
            : "Potwierdzono powiązanie jako ponowne wystawienie."
          : potential
            ? "Odrzucono parę. Kolejne skany nie zaproponują jej ponownie."
            : "Rozłączono oferty. Kolejne skany nie połączą tej pary ponownie.",
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
      {notice && !onReviewed && (
        <p className="relisting-review-notice" role="status">
          {notice}
        </p>
      )}
      {items.map((match) => {
        const key = `${match.previous.id}:${match.current.id}`;
        if (decisions[key] === "rejected" || (potential && decisions[key])) return null;
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
                {match.manuallyConfirmed || decisions[key] === "confirmed"
                  ? "Połączone ręcznie"
                  : "Połączone automatycznie"}
              </strong>
            )}
            {(showCurrent ? [match.previous, match.current] : [match.previous]).map(
              (offer, index) => (
                <div
                  className={`relisting-offer-row ${index ? "is-current" : "is-archived"}`}
                  key={offer.id}
                >
                  <span>
                    {index ? "Aktualna" : "Archiwalna"} · {offer.sourceLabel}
                  </span>
                  <div className="relisting-photo">
                    <DuplicatePreview
                      id={offer.id}
                      title={offer.title}
                      urls={offer.thumbnailUrls}
                      sharedFromIndex={offer.thumbnailSharedFromIndex}
                      onOpen={(id) => void onOpenListing(id)}
                    />
                  </div>
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
                  {offer.canonicalUrl && !showCurrent && (
                    <a
                      className="text-link-button"
                      href={offer.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Otwórz ogłoszenie w portalu
                    </a>
                  )}
                </div>
              ),
            )}
            {!!match.archiveCopies?.length && (
              <details className="relisting-archive-copies">
                <summary>
                  Ogłoszenia połączone z wcześniejszą ofertą ({match.archiveCopies.length})
                </summary>
                <ul>
                  {match.archiveCopies.map((copy) => (
                    <li key={copy.id}>
                      <button
                        type="button"
                        className="text-link-button"
                        onClick={() => void onOpenListing(copy.id)}
                      >
                        {copy.sourceLabel ?? "Portal"} · {copy.title}
                      </button>
                      <small>{copy.isActive ? "Aktywna" : "Archiwalna"}</small>
                      {copy.canonicalUrl && (
                        <a href={copy.canonicalUrl} target="_blank" rel="noreferrer">
                          Otwórz w portalu
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
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
            {match.reviewable !== false && (
              <div className="relisting-review-actions">
                <button
                  type="button"
                  className="action-button"
                  disabled={
                    Boolean(busy) ||
                    (!potential && (match.manuallyConfirmed || decisions[key] === "confirmed"))
                  }
                  onClick={() => void review(match, "confirmed")}
                >
                  {busy === key
                    ? "Zapisywanie…"
                    : potential
                      ? showCurrent
                        ? "Połącz jako ponowne wystawienie"
                        : "Powiąż tę ofertę"
                      : match.manuallyConfirmed || decisions[key] === "confirmed"
                        ? "Powiązanie potwierdzone"
                        : "Potwierdź powiązanie"}
                </button>
                <button
                  type="button"
                  className="action-button secondary-button"
                  disabled={Boolean(busy)}
                  onClick={() => void review(match, "rejected")}
                >
                  {potential ? "To inne mieszkania" : "Rozłącz oferty"}
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
