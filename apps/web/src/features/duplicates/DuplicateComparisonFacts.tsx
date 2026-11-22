type OfferFacts = {
  id: string;
  sourceLabel?: string;
  addressText?: string;
  areaLabel: string;
  roomsLabel?: string;
  floor?: number;
  sourcePriceLabel?: string;
  listingStatus?: string;
  isPrimary?: boolean;
};

const statusLabels: Record<string, string> = {
  active: "Aktywna",
  removed: "Archiwalna",
  sold: "Sprzedana",
  reserved: "Zarezerwowana",
  unknown: "Nieznany",
};

export function DuplicateComparisonFacts({ offers }: { offers: OfferFacts[] }) {
  const rows = [
    { label: "Status", values: offers.map((offer) => statusLabels[offer.listingStatus ?? ""]) },
    { label: "Adres", values: offers.map((offer) => offer.addressText) },
    { label: "Metraż", values: offers.map((offer) => offer.areaLabel) },
    { label: "Piętro", values: offers.map((offer) => offer.floor) },
    { label: "Pokoje", values: offers.map((offer) => offer.roomsLabel) },
    { label: "Cena źródłowa", values: offers.map((offer) => offer.sourcePriceLabel) },
  ];
  return (
    <div
      className="duplicate-facts-scroll"
      tabIndex={0}
      role="region"
      aria-label="Porównanie danych ogłoszeń"
    >
      <table className="duplicate-facts-table">
        <thead>
          <tr>
            <th scope="col">Cecha</th>
            {offers.map((offer) => (
              <th scope="col" key={offer.id}>
                {offer.sourceLabel ?? "Portal"}
                {offer.isPrimary && <small>Oferta główna</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, values }) => {
            const differs =
              new Set(values.filter((value) => value != null && value !== "-")).size > 1;
            return (
              <tr key={label} className={differs ? "has-difference" : undefined}>
                <th scope="row">{label}</th>
                {offers.map((offer, index) => (
                  <td key={offer.id}>{values[index] ?? "—"}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
