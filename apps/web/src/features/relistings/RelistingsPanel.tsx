import { useEffect, useState } from "react";
import type {
  RelistedListingsResponse,
  RelistedListingsScanResponse,
  RelistingSort,
} from "@mieszkania/shared";
import { Select } from "../../components/Select";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";
import { RelistingMatches } from "./RelistingMatches";
import { RelistingTimeline } from "./RelistingTimeline";
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
  const [currentId, setCurrentId] = useState("");
  const [previousId, setPreviousId] = useState("");
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState({ linked: 1, potential: 1 });
  const [offsets, setOffsets] = useState({ linked: [0], potential: [0] });
  const [sorts, setSorts] = useState<Record<"linked" | "potential", RelistingSort>>({
    linked: "newest",
    potential: "confidence",
  });
  const view = potential ? "potential" : "linked";
  const sort = sorts[view];
  const page = pages[view];
  const offset = offsets[view][page - 1] ?? 0;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RelistedListingsResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const reviewed = (event: Event) => {
      setRevision((value) => value + 1);
      const { match, decision } = (event as CustomEvent<RelistingReviewEvent>).detail;
      setResult((current) => {
        if (!current) return current;
        const potentialItems = current.potentialItems.filter(
          (item) => item.current.id !== match.current.id || item.previous.id !== match.previous.id,
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
    void apiFetch(
      `${apiBaseUrl}/api/listings/relistings?limit=20&offset=${offset}&sort=${sort}&grouped=${!potential}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok)
          throw Error("Nie udało się odczytać zapisanych powiązań. Spróbuj ponownie.");
        const next: RelistedListingsResponse = await response.json();
        if (controller.signal.aborted) return;
        if (page > 1 && offset >= (potential ? next.potentialCount : (next.groupCount ?? 0))) {
          setPages((current) => ({ ...current, [view]: page - 1 }));
          return;
        }
        setResult(next);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, offset, view, sort, revision, scanResult]);
  const total = (potential ? result?.potentialCount : result?.groupCount) ?? 0;
  const items = (potential ? result?.potentialItems : result?.items) ?? [];
  const groups = result?.groups ?? [];
  const pageSize = potential ? items.length : groups.length;
  return (
    <section className="panel duplicate-queue-controls">
      <div className="section-topline">
        <div>
          <h2>{potential ? "Potencjalne ponowne wystawienia" : "Połączone ponowne wystawienia"}</h2>
          <p className="muted">
            {result &&
              `${potential ? "Propozycje" : "Grupy ogłoszeń"} · ${total.toLocaleString("pl-PL")}`}
          </p>
        </div>
        <button
          className="action-button secondary-button"
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading || scanning}
        >
          Odśwież listę
        </button>
      </div>
      <div className="duplicate-toolbar">
        <label>
          <span>Kolejność ponownych wystawień</span>
          <Select
            label="Kolejność ponownych wystawień"
            value={sort}
            onChange={(value) => {
              setSorts((current) => ({ ...current, [view]: value as RelistingSort }));
              setPages((current) => ({ ...current, [view]: 1 }));
              setOffsets((current) => ({ ...current, [view]: [0] }));
            }}
          >
            <option value="newest">Najnowsze wystawienia</option>
            <option value="oldest">Najstarsze wystawienia</option>
            <option value="confidence">Najwyższe podobieństwo</option>
            <option value="price_change">Największa zmiana ceny (%)</option>
            <option value="price_drop">Największa obniżka ceny (%)</option>
          </Select>
        </label>
      </div>
      <details className="duplicate-relisting-scan duplicate-filter-menu">
        <summary>Skan ponownych wystawień</summary>
        <p className="muted">
          Porównuje aktywne ogłoszenia z archiwum. Łączy mocne dopasowania, a pozostałe zapisuje
          jako propozycje.
        </p>
        <button
          className="action-button"
          type="button"
          onClick={() => void runScan()}
          disabled={scanning}
        >
          {scanning ? "Sprawdzam…" : "Sprawdź oferty"}
        </button>
      </details>
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
      <details className="panel">
        <summary>Połącz ręcznie po ID</summary>
        <form
          className="sync-step-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setNotice("");
            setError("");
            try {
              const response = await apiFetch(
                `${apiBaseUrl}/api/listings/${encodeURIComponent(currentId.trim())}/relisting-review`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    previousId: previousId.trim(),
                    decision: "confirmed",
                    manualRelisting: true,
                  }),
                },
              );
              if (!response.ok)
                throw new Error((await response.json()).message ?? "Nie udało się połączyć ofert.");
              setNotice("Połączono aktywne ogłoszenie z archiwalnym.");
              setCurrentId("");
              setPreviousId("");
              setRevision((v) => v + 1);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Nie udało się zapisać połączenia.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            ID aktywnej oferty
            <input
              className="text-input"
              required
              value={currentId}
              onChange={(e) => setCurrentId(e.target.value)}
            />
          </label>
          <label>
            ID archiwalnej oferty
            <input
              className="text-input"
              required
              value={previousId}
              onChange={(e) => setPreviousId(e.target.value)}
            />
          </label>
          <button className="action-button" disabled={saving}>
            {saving ? "Zapisywanie…" : "Połącz jako ponowne wystawienie"}
          </button>
        </form>
      </details>
      {loading ? (
        <p role="status">Wczytywanie zapisanych powiązań…</p>
      ) : (
        !error && (
          <div className="relisting-results">
            {!potential && groups.length ? (
              groups.map((group) => (
                <RelistingTimeline
                  key={group[0].current.id}
                  group={group}
                  onOpenListing={onOpenListing}
                />
              ))
            ) : items.length ? (
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
            {(page > 1 || offset + pageSize < total) && (
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
                  disabled={offset + pageSize >= total}
                  onClick={() => {
                    setOffsets((current) => ({
                      ...current,
                      [view]: [...current[view].slice(0, page), offset + pageSize],
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
