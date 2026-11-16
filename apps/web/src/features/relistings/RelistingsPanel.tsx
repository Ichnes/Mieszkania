import { useEffect, useState } from "react";
import type { RelistedListingsResponse, RelistedListingsScanResponse } from "@mieszkania/shared";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";
import { RelistingMatches } from "./RelistingMatches";

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
  const view = potential ? "potential" : "linked";
  const page = pages[view];
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RelistedListingsResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("mieszkania:relisting-reviewed", refresh);
    return () => window.removeEventListener("mieszkania:relisting-reviewed", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void apiFetch(`${apiBaseUrl}/api/listings/relistings?limit=20&offset=${(page - 1) * 20}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error("Nie udało się odczytać zapisanych powiązań. Spróbuj ponownie.");
        const next: RelistedListingsResponse = await response.json();
        if (controller.signal.aborted) return;
        const total = potential ? next.potentialCount : next.matched;
        const lastPage = Math.max(1, Math.ceil(total / 20));
        if (page > lastPage) setPages((current) => ({ ...current, [view]: lastPage }));
        setResult(next);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, potential, view, revision, scanResult]);
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
                      ? "Połączono oferty. Para jest dostępna w zakładce „Połączone oferty”."
                      : "Odrzucono parę. Kolejne skany nie zaproponują jej ponownie.",
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
            {total > 20 && (
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
                  Strona {page} z {Math.ceil(total / 20)}
                </span>
                <button
                  className="action-button secondary-button"
                  type="button"
                  disabled={page * 20 >= total}
                  onClick={() => setPages((current) => ({ ...current, [view]: page + 1 }))}
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
