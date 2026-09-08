import { useState } from "react";
import { Building2, Home, MapPin, Sparkles, Wallet } from "lucide-react";
import type { computeDreamEvaluation } from "@mieszkania/shared";

type ScoreRow = ReturnType<typeof computeDreamEvaluation>["rows"][number];
const categories = [
  {
    key: "costs",
    label: "Koszty",
    hint: "Cena, rata i opłaty",
    icon: Wallet,
    labels: [
      "Cena zakupu",
      "Cena za m²",
      "Szacowana rata",
      "Informacja o czynszu",
      "Sprzedający / prowizja",
      "Obniżka ceny",
      "Wiek oferty",
      "Wynajem miejsc parkingowych",
    ],
  },
  {
    key: "location",
    label: "Lokalizacja",
    hint: "Okolica i dojazdy",
    icon: MapPin,
    labels: ["Lokalizacja", "Metro", "Dojazd do pracy"],
  },
  {
    key: "layout",
    label: "Układ",
    hint: "Przestrzeń i wygoda",
    icon: Home,
    labels: [
      "Metraż",
      "Liczba pokoi",
      "Ekspozycja",
      "Układ mieszkania",
      "Balkon",
      "Garderoba",
      "Dwie łazienki",
      "Gabinet",
      "Prysznic",
    ],
  },
  {
    key: "building",
    label: "Budynek",
    hint: "Piętro, winda, parking",
    icon: Building2,
    labels: [
      "Garaż",
      "Parking zewnętrzny",
      "Komórka",
      "Winda",
      "Garaż i winda razem",
      "Rok budowy",
      "Piętro",
      "Co najmniej 2 miejsca parkingowe",
      "Zamknięte osiedle",
      "Monitoring",
    ],
  },
  { key: "finish", label: "Wykończenie", hint: "Stan i materiały", icon: Sparkles, labels: [] },
];

export function ListingScoreRules({ rows }: { rows: ScoreRow[] }) {
  const [active, setActive] = useState("costs");
  const groups = categories.map((category) => ({
    ...category,
    rows: rows.filter((row) =>
      category.key === "finish"
        ? !categories.some((item) => item.labels.includes(row.label))
        : category.labels.includes(row.label),
    ),
  }));
  const selected = groups.find((group) => group.key === active)!;
  return (
    <section id="dream-score-rules" className="score-guide" aria-label="Zasady punktacji">
      <header className="score-guide-header">
        <span className="score-guide-eyebrow">JAK POWSTAJE WYNIK</span>
        <h4>Co ma dla nas znaczenie?</h4>
        <p>Wybierz kategorię. Przy każdej zasadzie zobaczysz punkty tej oferty.</p>
      </header>
      <div className="score-guide-categories" aria-label="Kategorie punktacji">
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            aria-pressed={active === group.key}
            onClick={() => setActive(group.key)}
            className="score-guide-category"
            aria-controls="score-guide-content"
          >
            <group.icon size={20} aria-hidden="true" />
            <strong>{group.label}</strong>
            <span>{group.hint}</span>
          </button>
        ))}
      </div>
      <div id="score-guide-content" className="score-guide-content">
        <div className="score-guide-section-heading">
          <h5>{selected.label}</h5>
          <span>{selected.rows.length} kryteriów</span>
        </div>
        <div className="score-guide-cards">
          {selected.rows.map((row) => (
            <article className="score-guide-card" key={row.label}>
              <div className="score-guide-card-heading">
                <h6>{row.label}</h6>
                <span
                  className={
                    "score-guide-points " +
                    (row.points < 0 ? "is-negative" : row.points > 0 ? "is-positive" : "")
                  }
                >
                  {row.points > 0 ? "+" : ""}
                  {row.points} pkt
                </span>
              </div>
              <ul>
                {row.rule.split(/;\s*/).map((condition, index) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
      <footer className="score-guide-footer">
        <strong>Punkty → procent dopasowania</strong>
        <p>
          Sumujemy punkty i dzielimy przez możliwą sumę. Wyłączone preferencje nie są liczone,
          powtórzenia tej samej cechy nie mnożą premii. Wynik mieści się w 0–100%.
        </p>
      </footer>
    </section>
  );
}
