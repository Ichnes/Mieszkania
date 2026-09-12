import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

type Progress = {
  source: string;
  status: "running" | "completed" | "error";
  scannedPages: number;
  pageLimit: number;
  queued: number;
};
const portals = [
  ["otodom", "Otodom"],
  ["gratka", "Gratka"],
  ["olx", "OLX"],
  ["nieruchomosci-online", "Nieruchomości-online"],
  ["domiporta", "Domiporta"],
  ["maxon", "Maxon"],
  ["adresowo", "Adresowo"],
  ["morizon", "Morizon"],
] as const;

export function DiscoveryProgress({ discovering }: { discovering: boolean }) {
  const [items, setItems] = useState<Progress[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      let running = discovering;
      try {
        const response = await apiFetch(`${apiBaseUrl}/api/collectors/discovery-progress`);
        if (!response.ok) throw new Error("status unavailable");
        const result = (await response.json()) as { items: Progress[] };
        running ||= result.items.some((item) => item.status === "running");
        if (active) {
          setItems(result.items);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) timer = setTimeout(refresh, running ? 2000 : 10000);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [discovering]);
  if (!items.length && !discovering && !error) return null;
  return (
    <section className="discovery-progress" aria-label="Postęp skanowania portali">
      <h3>Postęp skanowania portali</h3>
      <p className="muted">
        Sprawdzone strony / limit skanu. Skan może skończyć się wcześniej, gdy zabraknie wyników.
        Przy dzielnicach limit obejmuje wszystkie grupy lokalizacji.
      </p>
      {error && (
        <p role="alert">
          Nie udało się odświeżyć liczników. Ponawiam odczyt; widoczne dane mogą być nieaktualne.
        </p>
      )}
      <div className="discovery-progress-grid">
        {portals.map(([source, name]) => {
          const item = items.find((item) => item.source === source);
          if (!item && !discovering) return null;
          return (
            <div className="discovery-progress-item" key={source}>
              <strong>{name}</strong>
              <span>
                {!item
                  ? "Oczekuje na start"
                  : item.status === "running"
                    ? "Skanowanie…"
                    : item.status === "error"
                      ? "Przerwano — błąd"
                      : "Zakończono"}
              </span>
              {item && (
                <>
                  <span>
                    Strony: <b>{item.scannedPages}</b> / {item.pageLimit || "ustalanie limitu…"}
                  </span>
                  <span>Dodano do kolejki: {item.queued}</span>
                  <progress
                    aria-label={`${name}: sprawdzone strony`}
                    max={item.pageLimit || 1}
                    value={item.scannedPages}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
