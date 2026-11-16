import { useEffect, useState } from "react";
import type { RelistedListingsResponse, RelistedListingsScanResponse } from "@mieszkania/shared";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";
import { RelistingMatches } from "./RelistingMatches";
import type { RelistingReviewEvent } from "./review";

export function RelistingsPanel({
  potential,
  onOpenListing,
  runScan,
  scanning,
  scanError,
  scanResult,
}: {
  potential: boolean;
  onOpenListing: (id: string) => unknown;
  runScan: () => Promise<void>;
  scanning: boolean;
  scanError: string | null;
  scanResult: RelistedListingsScanResponse | null;
}) {
  const [pages, setPages] = useState({ linked: 1, potential: 1 });
  const [offsets, setOffsets] = useState({ linked: [0], potential: [0] });
  const view = potential ? "potential" : "linked";
  const page = pages[view];
  const offset = offsets[view][page - 1] ?? 0;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RelistedListingsResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const reviewed = (event: Event) => {
      const { match, decision } = (event as CustomEvent<RelistingReviewEvent>).detail;
      setResult((current) => {
        if (!current) return current;
        const potentialItems = current.potentialItems.filter((item) =>
          decision === "confirmed"
            ? item.current.id !== match.current.id
            : item.current.id !== match.current.id || item.previous.id !== match.previous.id,
        );
        const removed = current.potentialItems.length - potentialItems.length;
        const isPair = (item: typeof match) =>
          item.current.id === match.current.id && item.previous.id === match.previous.id;
        const linked = current.items.some(isPair);
        const items =
          decision === "rejected"
            ? current.items.filter((item) => !isPair(item))
            : current.items.map((item) =>
                isPair(item) ? { ...item, manuallyConfirmed: true } : item,
              );
        if (!removed && !linked) return current;
        return {
          ...current,
          items,
          potentialItems,
          potentialCount: current.potentialCount - removed,
          matched:
            current.matched +
            (decision === "confirmed" && !linked && removed ? 1 : 0) -
            (decision === "rejected" && linked ? 1 : 0),
        };
      });
    };
    window.addEventListener("mieszkania:relisting-reviewed", reviewed);
    return () => window.removeEventListener("mieszkania:relisting-reviewed", reviewed);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void apiFetch(`${apiBaseUrl}/api/listings/relistings?limit=20&offset=${offset}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error("Nie udało się odczytać zapisanych powiązań. Spróbuj ponownie.");
        const next: RelistedListingsResponse = await response.json();
        if (controller.signal.aborted) return;
        setResult(next);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, offset, potential, view, revision, scanResult]);
  const total = (potential ? result?.potentialCount : result?.matched) ?? 0;
  const items = (potential ? result?.potentialItems : result?.items) ?? [];
  return (
    <section className="panel">
      <div className="section-topline">
        <div>
          <h2>{potential ? "Potencjalne ponowne wystawienia" : "Połączone ponowne wystawienia"}</h2>
          <p className="muted">
            {potential
              ? "Te pary nie są jeszcze powiązane. Porównaj zdjęcia i szczegóły, a potem potwierdź lub odrzuć propozycję. Połączenie zachowuje oba ogłoszenia i ich ceny."
              : "Te oferty są już powiązane z wcześniejszymi ogłoszeniami z archiwum — automatycznie lub po ręcznym potwierdzeniu. Oba ogłoszenia i ich ceny są zachowane."}
          </p>
        </div>
        <div className="panel-inline-actions">
          <button
            className="action-button secondary-button"
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading || scanning}
          >
            Odśwież listę
          </button>
          <button
            className="action-button"
            type="button"
            onClick={() => void runScan()}
            disabled={scanning}
          >
            {scanning ? "Sprawdzam…" : "Sprawdź oferty"}
          </button>
        </div>
      </div>
      <p className="muted">
        Lista pokazuje zapisane wyniki. „Sprawdź oferty” porównuje aktywne ogłoszenia z archiwum:
        mocne dopasowania łączy automatycznie, pozostałe zapisuje jako propozycje.
      </p>
      {scanResult && (
        <p className="muted">
          Ostatni skan: {scanResult.checkedActive} aktywnych i {scanResult.checkedArchived}{" "}
          archiwalnych ofert.
        </p>
      )}
      {scanError && (
        <p className="error-text" role="alert">
          {scanError}
        </p>
      )}
      {scanning && <p role="status">Porównywanie ofert z archiwum…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Wczytywanie zapisanych powiązań…</p>
      ) : (
        !error && (
          <div className="relisting-results">
            <p className="muted">
              {potential ? "Propozycje" : "Połączone pary"}: {total}
            </p>
            {items.length ? (
              <RelistingMatches
                key={`${view}:${page}:${revision}`}
                items={items}
                potential={potential}
                onOpenListing={onOpenListing}
                onReviewed={(_, decision) => {
                  setNotice(
                    decision === "confirmed"
                      ? potential
                        ? "Połączono oferty. Para jest dostępna w zakładce „Połączone oferty”."
                        : "Potwierdzono powiązanie."
                      : potential
                        ? "Odrzucono parę. Kolejne skany nie zaproponują jej ponownie."
                        : "Rozłączono oferty. Kolejne skany nie połączą tej pary ponownie.",
                  );
                }}
              />
            ) : (
              <p className="muted">
                {potential
                  ? "Brak propozycji do sprawdzenia."
                  : "Brak zapisanych ponownych wystawień."}
              </p>
            )}
            {(page > 1 || offset + items.length < total) && (
              <div className="pagination-row">
                <button
                  className="action-button secondary-button"
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPages((current) => ({ ...current, [view]: page - 1 }))}
                >
                  Poprzednia
                </button>
                <span>
                  Strona {page} z {Math.max(page, Math.ceil(total / 20))}
                </span>
                <button
                  className="action-button secondary-button"
                  type="button"
                  disabled={offset + items.length >= total}
                  onClick={() => {
                    setOffsets((current) => ({
                      ...current,
                      [view]: [...current[view].slice(0, page), offset + items.length],
                    }));
                    setPages((current) => ({ ...current, [view]: page + 1 }));
                  }}
                >
                  Następna
                </button>
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
