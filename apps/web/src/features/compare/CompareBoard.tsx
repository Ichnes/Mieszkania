import { useState } from "react";
import type { FamilySettings } from "@mieszkania/shared";
import { ArrowUpRight, ImageOff, X } from "lucide-react";
import { Link } from "react-router-dom";
import { buildComparisonRows, visibleComparisonRows } from "./lib/rows";
import type { ComparisonListing } from "./lib/types";
import { useComparisonCommutes } from "./useComparisonCommutes";

export function CompareBoard({
  listings,
  workplaces,
  onSettings,
  onOpen,
  onRemove,
}: {
  listings: ComparisonListing[];
  workplaces: FamilySettings["workplaces"];
  onSettings: () => void;
  onOpen: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const commutes = useComparisonCommutes(listings, workplaces);
  const rows = buildComparisonRows(listings, workplaces, commutes.values);
  const visibleRows = visibleComparisonRows(rows, onlyDifferences, listings.length);
  const hasCommutes = Object.keys(commutes.values).length > 0;
  const hasCommuteErrors = listings.some(({ id }) => {
    const value = commutes.values[id];
    return (
      !Array.isArray(value) ||
      workplaces.some(
        ({ key }) => value.find((item) => item.key === key)?.durationMinutes === undefined,
      )
    );
  });
  if (!listings.length)
    return (
      <div className="comparison-empty">
        <span className="eyebrow">Twój wybór</span>
        <h2>Które mieszkanie wybrać?</h2>
        <p>
          Dodaj od 2 do 5 ofert przyciskiem „Porównaj” na karcie mieszkania. Zobaczysz ich ceny i
          cechy obok siebie.
        </p>
        <Link className="action-button" to="/oferty">
          Wybierz oferty <ArrowUpRight size={18} />
        </Link>
      </div>
    );
  return (
    <>
      {listings.length === 1 && (
        <p className="comparison-hint">
          Masz pierwszą ofertę. Dodaj kolejną, żeby porównać różnice.
        </p>
      )}
      <div className="comparison-toolbar">
        <label className="comparison-toggle">
          <input
            type="checkbox"
            checked={onlyDifferences && listings.length > 1}
            disabled={listings.length < 2}
            onChange={(event) => setOnlyDifferences(event.target.checked)}
          />
          Tylko różnice
        </label>
        <span role="status">
          Widoczne cechy: {visibleRows.length} z {rows.length}
        </span>
        {workplaces.length > 0 && (
          <button
            type="button"
            className="action-button secondary-button"
            disabled={commutes.loading}
            onClick={() => void commutes.load()}
          >
            {commutes.loading
              ? "Obliczam dojazdy…"
              : hasCommutes
                ? "Oblicz dojazdy ponownie"
                : "Oblicz dojazdy"}
          </button>
        )}
      </div>
      <p className="comparison-hint" role="status">
        {workplaces.length === 0 ? (
          <>
            Aby porównać dojazdy, dodaj cele w ustawieniach.{" "}
            <button type="button" className="action-button secondary-button" onClick={onSettings}>
              Otwórz ustawienia
            </button>
          </>
        ) : commutes.loading ? (
          "Pobieram trasy do zapisanych celów…"
        ) : hasCommutes ? (
          hasCommuteErrors ? (
            "Obliczanie zakończone. Część tras jest niedostępna; możesz ponowić obliczenie."
          ) : (
            "Obliczanie dojazdów zakończone."
          )
        ) : (
          "Dojazdy czekają na obliczenie."
        )}
        {workplaces.length > 0 &&
          " Szacunek samochodem bez korków, według OpenStreetMap. Przybliżona lokalizacja oferty wpływa na wynik."}
      </p>
      {visibleRows.length === 0 && (
        <div className="comparison-hint" role="status">
          <p>
            Brak różnic w porównywanych cechach. Wspólny brak danych nie oznacza identycznych
            mieszkań.
          </p>
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => setOnlyDifferences(false)}
          >
            Pokaż wszystkie cechy
          </button>
        </div>
      )}
      <p className="comparison-scroll-hint">Przesuń tabelę w bok, aby zobaczyć pozostałe oferty.</p>
      <div
        className="comparison-scroll"
        tabIndex={0}
        role="region"
        aria-label="Tabela porównania ofert"
      >
        <table className="comparison-table">
          <caption className="comparison-caption">Ceny i cechy wybranych mieszkań</caption>
          <thead>
            <tr>
              <th scope="col" className="comparison-label">
                <span>Co porównujemy</span>
                <small>{listings.length} z 5 ofert</small>
              </th>
              {listings.map((l) => (
                <th scope="col" key={l.id}>
                  <div className="comparison-property">
                    <div className="comparison-photo">
                      {l.thumbnailUrl ? (
                        <img src={l.thumbnailUrl} alt="" loading="lazy" />
                      ) : (
                        <ImageOff size={36} />
                      )}
                      <button
                        className="comparison-remove"
                        onClick={() => onRemove(l.id)}
                        aria-label={`Usuń z porównania: ${l.title}`}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="comparison-property-text">
                      <span className="eyebrow">{l.district || l.city}</span>
                      <button className="comparison-title" onClick={() => void onOpen(l.id)}>
                        {l.title}
                        <ArrowUpRight size={16} />
                      </button>
                      <p>{[l.neighborhood, l.street].filter(Boolean).join(" · ") || l.city}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className={row.id === "price" ? "comparison-price-row" : undefined}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td
                    key={listings[index].id}
                    className={row.id === "notes" ? "comparison-notes" : undefined}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
