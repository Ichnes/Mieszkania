import type { ListingSummary } from "@mieszkania/shared";
import { ArrowUpRight, ImageOff, X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPln } from "../../shared/lib/format";

const yesNo = (value?: boolean) => (value === undefined ? "Brak danych" : value ? "Tak" : "Nie");
const fields: { label: string; value: (listing: ListingSummary) => string }[] = [
  { label: "Cena ofertowa", value: (l) => l.priceLabel },
  {
    label: "Cena z dodatkami",
    value: (l) => (l.totalAcquisitionPrice ? formatPln(l.totalAcquisitionPrice) : "Brak danych"),
  },
  { label: "Cena za m²", value: (l) => l.pricePerSqmLabel ?? "Brak danych" },
  { label: "Powierzchnia", value: (l) => l.areaLabel },
  { label: "Pokoje", value: (l) => l.roomsCount?.toString() ?? "Brak danych" },
  {
    label: "Piętro",
    value: (l) =>
      l.floor === undefined
        ? "Brak danych"
        : `${l.floor === 0 ? "Parter" : l.floor}${l.totalFloors !== undefined ? ` / ${l.totalFloors}` : ""}`,
  },
  { label: "Rok budowy", value: (l) => l.yearBuilt?.toString() ?? "Brak danych" },
  {
    label: "Miejsce postojowe",
    value: (l) =>
      [l.hasGarage && "Garaż", l.hasOutdoorParking && "Naziemne"].filter(Boolean).join(" · ") ||
      "Brak miejsca postojowego w opisie",
  },
  { label: "Winda", value: (l) => yesNo(l.hasLift) },
  { label: "Balkon", value: (l) => yesNo(l.hasBalcony) },
  { label: "Komórka lokatorska", value: (l) => yesNo(l.hasStorage) },
  {
    label: "Dopasowanie do preferencji",
    value: (l) => (typeof l.dreamScore === "number" ? `${l.dreamScore}%` : "Brak danych"),
  },
];

export function CompareBoard({
  listings,
  onOpen,
  onRemove,
}: {
  listings: ListingSummary[];
  onOpen: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
}) {
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
            {fields.map((field) => (
              <tr key={field.label}>
                <th scope="row">{field.label}</th>
                {listings.map((l) => (
                  <td key={l.id}>{field.value(l)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
