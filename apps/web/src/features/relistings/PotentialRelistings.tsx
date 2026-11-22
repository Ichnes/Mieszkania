import { useEffect, useState } from "react";
import type { ListingRelistingHistory, RelistedListingMatch } from "@mieszkania/shared";
import { apiBaseUrl } from "../../shared/lib/api";
import { apiFetch } from "../../shared/lib/http";
import { RelistingMatches } from "./RelistingMatches";

type ListingRelistings = {
  items: Array<RelistedListingMatch & Pick<ListingRelistingHistory, "archiveCopies">>;
  history: ListingRelistingHistory[];
};

export function PotentialRelistings({
  listingId,
  isActive,
  showHistory,
  onOpenListing,
}: {
  listingId: string;
  isActive: boolean;
  showHistory: boolean;
  onOpenListing: (id: string) => unknown;
}) {
  const [result, setResult] = useState<ListingRelistings>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void apiFetch(`${apiBaseUrl}/api/listings/${listingId}/relisting-candidates`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Nie udało się odczytać propozycji.");
        const data = (await response.json()) as ListingRelistings;
        if (!controller.signal.aborted) setResult(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [listingId, retry]);

  if (!showHistory && !isActive) return null;
  if (!showHistory && result?.items.length === 0 && !notice) return null;
  const samePair = (left: RelistedListingMatch, right: RelistedListingMatch) =>
    left.current.id === right.current.id && left.previous.id === right.previous.id;
  return (
    <section className="potential-relistings" aria-label="Wcześniejsze oferty">
      {notice && <p role="status">{notice}</p>}
      {error ? (
        <div role="alert">
          <p>Nie udało się odczytać wcześniejszych ogłoszeń.</p>
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : !result ? (
        <p role="status">Sprawdzanie wcześniejszych ogłoszeń…</p>
      ) : (
        <>
          {showHistory && (
            <>
              <h3>Powiązane wcześniejsze ogłoszenia ({result.history.length})</h3>
              {result.history.length ? (
                <RelistingMatches
                  items={result.history}
                  showCurrent={!isActive}
                  onOpenListing={onOpenListing}
                  onReviewed={(match, decision) => {
                    setResult(
                      (current) =>
                        current && {
                          ...current,
                          history:
                            decision === "rejected"
                              ? current.history.filter((item) => !samePair(item, match))
                              : current.history.map((item) =>
                                  samePair(item, match)
                                    ? { ...item, manuallyConfirmed: true }
                                    : item,
                                ),
                        },
                    );
                    setNotice(
                      decision === "confirmed" ? "Potwierdzono powiązanie." : "Rozłączono tę parę.",
                    );
                  }}
                />
              ) : (
                <p className="muted">Brak powiązanych wcześniejszych ogłoszeń.</p>
              )}
            </>
          )}
          {isActive && result.items.length > 0 && (
            <>
              <h3>Potencjalne wcześniejsze oferty ({result.items.length})</h3>
              <RelistingMatches
                items={result.items}
                potential
                showCurrent={false}
                onOpenListing={onOpenListing}
                onReviewed={(match, decision) => {
                  setResult(
                    (current) =>
                      current && {
                        items: current.items.filter((item) => !samePair(item, match)),
                        history:
                          decision === "confirmed"
                            ? [
                                {
                                  ...match,
                                  manuallyConfirmed: true,
                                  archiveCopies:
                                    current.items.find((item) => samePair(item, match))
                                      ?.archiveCopies ?? [],
                                  reviewable: true,
                                },
                                ...current.history,
                              ]
                            : current.history,
                      },
                  );
                  setNotice(
                    decision === "confirmed" ? "Powiązano to ogłoszenie." : "Odrzucono tę parę.",
                  );
                }}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
