import { Sun } from "lucide-react";
import { exposureDirections, hasExposureFilter, type ExposureDirection } from "@mieszkania/shared";

const names: Record<ExposureDirection, string> = {
  N: "Północ",
  NE: "Północny wschód",
  E: "Wschód",
  SE: "Południowy wschód",
  S: "Południe",
  SW: "Południowy zachód",
  W: "Zachód",
  NW: "Północny zachód",
};
const point = (radius: number, degrees: number) => [
  120 + radius * Math.sin((degrees * Math.PI) / 180),
  120 - radius * Math.cos((degrees * Math.PI) / 180),
];
function sector(index: number) {
  const start = index * 45 - 21;
  const end = index * 45 + 21;
  return `M ${point(112, start)} A 112 112 0 0 1 ${point(112, end)} L ${point(54, end)} A 54 54 0 0 0 ${point(54, start)} Z`;
}
export function ExposureFilterCompass({
  selected,
  onChange,
}: {
  selected: ExposureDirection[];
  onChange: (value: ExposureDirection[]) => void;
}) {
  const active = hasExposureFilter(selected);
  return (
    <div className="stats-exposure-filter">
      <div className="stats-exposure-compass" role="group" aria-label="Kierunki ekspozycji">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          {exposureDirections.map((direction, index) => (
            <path
              key={direction}
              d={sector(index)}
              className={selected.includes(direction) ? "is-selected" : ""}
            />
          ))}
        </svg>
        {exposureDirections.map((direction, index) => {
          const [left, top] = point(83, index * 45);
          return (
            <button
              key={direction}
              type="button"
              aria-label={names[direction]}
              title={names[direction]}
              aria-pressed={selected.includes(direction)}
              style={{ left: `${left / 2.4}%`, top: `${top / 2.4}%` }}
              onClick={() =>
                onChange(
                  exposureDirections.filter((item) =>
                    item === direction ? !selected.includes(item) : selected.includes(item),
                  ),
                )
              }
            >
              {direction}
            </button>
          );
        })}
        <span className="stats-exposure-center" aria-hidden="true">
          <Sun size={24} />
          <small>{active ? `${selected.length} z 8` : "Cały rynek"}</small>
        </span>
      </div>
      <div className="stats-exposure-copy">
        <p className="eyebrow">Światło i ekspozycja</p>
        <h3>Które strony świata?</h3>
        <p>
          Wystarczy jeden z wybranych kierunków. Północ obejmuje też mieszkania z ekspozycją
          północ–południe.
        </p>
        <div className="stats-exposure-selection" aria-live="polite">
          {active
            ? selected.map((direction) => names[direction]).join(" · ")
            : "Wszystkie mieszkania"}
        </div>
        <small>
          {active
            ? "Oferty bez podanych kierunków są pomijane."
            : "Brak wyboru lub osiem kierunków obejmuje też oferty bez danych o ekspozycji."}
        </small>
        <div className="stats-exposure-shortcuts">
          <button type="button" onClick={() => onChange([...exposureDirections])}>
            Zaznacz wszystkie
          </button>
          <button type="button" onClick={() => onChange([])}>
            Odznacz kierunki
          </button>
        </div>
      </div>
    </div>
  );
}
