import { useEffect, useState } from "react";
import type { RelistedListingMatch } from "@mieszkania/shared";
import { apiBaseUrl } from "../../shared/lib/api";
import { apiFetch } from "../../shared/lib/http";
import { RelistingMatches } from "./RelistingMatches";

export function PotentialRelistings({
  listingId,
  count,
  onOpenListing,
}: {
  listingId: string;
  count: number;
  onOpenListing: (id: string) => unknown;
}) {
  const [result, setResult] = useState<{ id: string; items: RelistedListingMatch[] } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(false);
    if (count > 0)
      void apiFetch(`${apiBaseUrl}/api/listings/${listingId}/relisting-candidates`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Nie udało się odczytać propozycji.");
          const data = await response.json();
          if (!controller.signal.aborted) setResult({ id: listingId, items: data.items });
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    return () => controller.abort();
  }, [listingId, count, retry]);
  if (!count) return null;
  const items = result?.id === listingId ? result.items : null;
  return (
    <section className="potential-relistings" aria-label="Potencjalne wcześniejsze oferty">
      <h3>Potencjalne wcześniejsze oferty ({count})</h3>
      <p className="muted">
        Ta oferta mogła już być w naszej bazie. Poniżej podobne ogłoszenia z archiwum — powiązanie
        wymaga sprawdzenia.
      </p>
      {error ? (
        <div role="alert">
          <p>Nie udało się odczytać propozycji z archiwum.</p>
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : !items ? (
        <p role="status">Wczytywanie propozycji…</p>
      ) : items.length ? (
        <RelistingMatches items={items} potential onOpenListing={onOpenListing} />
      ) : (
        <p className="muted">Brak aktualnych propozycji z archiwum.</p>
      )}
    </section>
  );
}
