import { Building2, LoaderCircle, RefreshCw, WifiOff } from "lucide-react";

export function Shell({
  title,
  subtitle,
  error,
  onRetry,
}: {
  title: string;
  subtitle: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <main className="startup-shell">
      <section className={`startup-card ${error ? "is-error" : ""}`} aria-busy={!error}>
        <div className="startup-brand">
          <Building2 size={22} aria-hidden="true" /> Mieszkania
        </div>
        <div className="startup-symbol">
          {error ? (
            <WifiOff size={32} aria-hidden="true" />
          ) : (
            <LoaderCircle size={32} className="icon-spin" aria-hidden="true" />
          )}
        </div>
        <p className="eyebrow">{error ? "Połączenie przerwane" : "Twój przegląd rynku"}</p>
        <h1>{error ? "Jeszcze chwila — wrócimy do mieszkań" : "Przygotowujemy Twoje oferty"}</h1>
        <p className="startup-copy" role={error ? "alert" : "status"}>
          {error
            ? "Nie możemy teraz pobrać danych. Spróbuj połączyć się ponownie."
            : "Wczytujemy oferty, zapisane kryteria i ustawienia."}
        </p>
        {onRetry ? (
          <button className="action-button" onClick={onRetry}>
            <RefreshCw size={18} aria-hidden="true" /> Spróbuj ponownie
          </button>
        ) : (
          <div className="startup-progress" aria-hidden="true">
            <i />
          </div>
        )}
        {error ? (
          <details className="startup-details">
            <summary>Szczegóły połączenia</summary>
            <p>{subtitle}</p>
          </details>
        ) : null}
      </section>
    </main>
  );
}
