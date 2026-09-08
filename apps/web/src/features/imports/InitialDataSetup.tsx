import { apiFetch } from "../../shared/lib/http";
import { CheckCircle2, Download, MapPinned } from "lucide-react";
import { useEffect, useState } from "react";
import { apiBaseUrl } from "../../shared/lib/api";

export function InitialDataSetup() {
  const [status, setStatus] = useState<{ count: number; updatedAt: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  async function refreshStatus(signal?: AbortSignal) {
    const response = await apiFetch(`${apiBaseUrl}/api/streets/warsaw/status`, { signal });
    if (!response.ok) throw new Error("Nie udało się sprawdzić katalogu ulic.");
    setStatus(await response.json());
  }
  useEffect(() => {
    const controller = new AbortController();
    void refreshStatus(controller.signal).catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, []);
  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/streets/warsaw/import`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Nie udało się pobrać ulic. Spróbuj ponownie za chwilę.");
      const data = (await response.json()) as { imported: number };
      setResult(
        data.imported
          ? `Gotowe. Zapisano ${data.imported} odcinków ulic.`
          : "Źródło nie zwróciło ulic. Spróbuj ponownie później.",
      );
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import nie powiódł się.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="setup-card" aria-labelledby="initial-data-title">
      <div className="setup-card-icon">
        <MapPinned size={26} />
      </div>
      <div>
        <p className="eyebrow">Pierwsze uruchomienie</p>
        <h2 id="initial-data-title">Przygotuj lokalne dane</h2>
        <p>
          Pobierz katalog ulic Warszawy. Pomaga rozpoznawać adresy i umieszczać oferty na mapie.
          Wystarczy zrobić to raz; później możesz odświeżyć katalog.
        </p>
        <p className="setup-status">
          {status ? (
            status.count > 0 ? (
              <>
                <CheckCircle2 size={17} />
                Katalog gotowy · {status.count.toLocaleString("pl-PL")} nazw ulic
              </>
            ) : (
              "Katalog ulic jest pusty — zacznij od pobrania."
            )
          ) : error ? (
            "Status katalogu niedostępny."
          ) : (
            "Sprawdzanie lokalnego katalogu…"
          )}
        </p>
        <button className="action-button" onClick={() => void run()} disabled={busy}>
          <Download size={18} />
          {busy
            ? "Pobieranie ulic…"
            : status?.count
              ? "Odśwież katalog ulic"
              : "Pobierz ulice Warszawy"}
        </button>
        {busy && (
          <p role="status">Pobieranie może potrwać kilka minut. Pozostaw ten widok otwarty.</p>
        )}
        {result && <p role="status">{result}</p>}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
