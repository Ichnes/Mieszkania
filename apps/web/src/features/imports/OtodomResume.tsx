import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

type Status = {
  key: string;
  checkpoint: { nextPage: number; endPage: number; updatedAt: string } | null;
  running: boolean;
};

export function OtodomResume({
  city,
  discovering,
  onComplete,
}: {
  city: string;
  discovering: boolean;
  onComplete: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  async function load() {
    const response = await apiFetch(
      `${apiBaseUrl}/api/collectors/otodom/discovery-checkpoint?city=${encodeURIComponent(city)}`,
    );
    if (!response.ok) throw new Error("Nie udało się odczytać miejsca przerwania skanu.");
    return (await response.json()) as Status;
  }
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void load()
        .then((value) => {
          if (active) {
            setStatus(value);
            setLoadError(false);
          }
        })
        .catch(() => {
          if (active) setLoadError(true);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [city, discovering]);

  async function resume() {
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/collectors/otodom/discover-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, resume: true, resumeKey: status?.key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Nie udało się wznowić skanu.");
      setMessage(
        result.stoppedBecause === "error"
          ? result.error
          : `Skan Otodomu zakończony. Sprawdzono ${result.scannedPages} stron; dodano do kolejki ${result.queued} ofert.`,
      );
      setStatus(await load());
      await onComplete();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wznowić skanu.");
    } finally {
      setBusy(false);
    }
  }
  if (!status?.checkpoint && !message && !loadError) return null;
  return (
    <section className="otodom-resume" aria-label="Wznawianie skanu Otodomu">
      <div>
        {status?.checkpoint && (
          <>
            <strong>
              Otodom: zapisano stronę {status.checkpoint.nextPage} z {status.checkpoint.endPage}
            </strong>
            <p>
              Ostatni zapis: {new Date(status.checkpoint.updatedAt).toLocaleString("pl-PL")}. Możesz
              wrócić tutaj później. Wznowienie dotyczy obecnych filtrów i tylko Otodomu.
            </p>
            <p>
              Jeśli CAPTCHA nadal występuje, skan ponownie się zatrzyma. Kolejność ofert może się
              zmienić — okresowo sprawdzaj też od początku.
            </p>
          </>
        )}
        {loadError && (
          <p role="alert">
            Nie udało się odczytać miejsca przerwania skanu. Ponawiam odczyt statusu.
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      {status?.checkpoint && (
        <button
          className="action-button"
          type="button"
          disabled={busy || discovering || status.running || loadError}
          onClick={() => void resume()}
        >
          {busy || status.running
            ? "Skan Otodomu trwa…"
            : `Wznów Otodom od strony ${status.checkpoint.nextPage}`}
        </button>
      )}
    </section>
  );
}
