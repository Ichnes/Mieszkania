import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

export function RcnDataStatus({ importing }: { importing: boolean }) {
  const [status, setStatus] = useState<{
    count: number;
    updatedAt?: string;
    latestTransaction?: string;
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === "visible") setAttempt((value) => value + 1);
    };
    window.addEventListener("focus", refreshVisible);
    const timer = window.setInterval(refreshVisible, 30_000);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (importing) return;
    const controller = new AbortController();
    setError(false);
    void apiFetch(`${apiBaseUrl}/api/collectors/rcn/status`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setStatus(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [importing, attempt]);
  return (
    <div aria-live="polite">
      {status && (
        <p>
          {status.count
            ? `W bazie: ${status.count.toLocaleString("pl-PL")} transakcji.`
            : "Brak zapisanych transakcji RCN. Import jest opcjonalny."}
          {status.updatedAt
            ? ` Ostatni zapis: ${new Date(status.updatedAt).toLocaleDateString("pl-PL")}.`
            : ""}
          {status.latestTransaction &&
            ` Najnowsza transakcja: ${new Date(status.latestTransaction + "T12:00:00").toLocaleDateString("pl-PL")}.`}
        </p>
      )}
      {importing ? (
        <p>Trwa import transakcji…</p>
      ) : error ? (
        <p role="alert">
          Nie udało się sprawdzić zapisanych danych.{" "}
          <button
            className="action-button secondary-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Ponów odczyt
          </button>
        </p>
      ) : !status ? (
        <p>Sprawdzanie zapisanych transakcji…</p>
      ) : null}
    </div>
  );
}
