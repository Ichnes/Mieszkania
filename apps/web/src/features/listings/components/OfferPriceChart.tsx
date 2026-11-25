import { useId, useState } from "react";

const bands = [
  { name: "Najtańsza piąta część", color: "#569684" },
  { name: "Poniżej środka", color: "#91b8a1" },
  { name: "Środek rozkładu", color: "#d9cda1" },
  { name: "Powyżej środka", color: "#dfad78" },
  { name: "Najdroższa piąta część", color: "#c97f64" },
];
const amount = (v: number) => Math.round(v).toLocaleString("pl-PL");
function point(fraction: number, radius: number) {
  const angle = Math.PI * (1 - fraction);
  return { x: 180 + radius * Math.cos(angle), y: 164 - radius * Math.sin(angle) };
}
function arc(from: number, to: number, radius: number) {
  const a = point(from, radius),
    b = point(to, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`;
}
function quantile(values: number[], fraction: number) {
  const n = (values.length - 1) * fraction,
    i = Math.floor(n);
  return values[i] + (values[Math.ceil(n)] - values[i]) * (n - i);
}
export function OfferPriceChart({
  prices,
  price,
  median,
}: {
  prices: number[];
  price: number;
  median: number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const title = useId();
  if (!prices.length || price <= 0) return <p>Brak cen pozwalających ustawić wskazówkę.</p>;
  const sorted = [...prices].sort((a, b) => a - b);
  const less = prices.filter((v) => v < price).length,
    equal = prices.filter((v) => v === price).length;
  const rank = (less + equal / 2) / prices.length;
  const tip = point(rank, 132),
    left = point(rank - 0.5, 4),
    right = point(rank + 0.5, 4);
  return (
    <figure className="offer-price-gauge">
      <figcaption>
        <span>Cena tej oferty</span>
        <strong>
          {amount(price)} <small>zł/m²</small>
        </strong>
      </figcaption>
      <svg viewBox="0 0 360 186" role="group" aria-labelledby={title}>
        <title id={title}>
          Pozycja ceny. Tańsze oferty: {less} z {prices.length}.
        </title>
        {bands.map((b, i) => (
          <g
            key={b.name}
            role="button"
            tabIndex={0}
            aria-label={b.name}
            aria-pressed={active === i}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActive(i);
              }
            }}
          >
            <path
              d={arc(i / 5 + 0.006, (i + 1) / 5 - 0.006, 139)}
              stroke={b.color}
              strokeWidth={active === i ? 24 : 20}
              fill="none"
            />
            <path
              d={arc(i / 5, (i + 1) / 5, 139)}
              stroke="transparent"
              strokeWidth="38"
              fill="none"
            />
          </g>
        ))}
        {Array.from({ length: 21 }, (_, i) => {
          const a = point(i / 20, 120),
            b = point(i / 20, i % 5 ? 117 : 112);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--ink-soft)"
              strokeOpacity={i % 5 ? 0.4 : 0.8}
            />
          );
        })}
        <path
          d={`M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y} Z`}
          fill="var(--ink)"
          pointerEvents="none"
        />
        <circle cx="180" cy="164" r="8" fill="var(--ink)" />
        <circle cx="180" cy="164" r="3" fill="#e6b376" />
        <text x="27" y="183">
          Taniej
        </text>
        <text x="333" y="183" textAnchor="end">
          Drożej
        </text>
      </svg>
      <div className="gauge-readout" aria-live="polite">
        {active === null ? (
          <>
            Tańsze <b>{less}</b>
            <i />
            Droższe <b>{prices.length - less - equal}</b>
            {equal > 0 && (
              <>
                {" "}
                <i /> W tej samej cenie <b>{equal}</b>
              </>
            )}
          </>
        ) : (
          <>
            {bands[active].name} · {amount(quantile(sorted, active / 5))}–
            {amount(quantile(sorted, (active + 1) / 5))} zł/m²
          </>
        )}
      </div>
      <p>
        {median === null
          ? `Mała próba · ${prices.length} porównań. Mediana od 5 ofert.`
          : `Mediana podobnych · ${amount(median)} zł/m²${prices.length < 10 ? " · mała próba" : ""}`}
      </p>
    </figure>
  );
}
