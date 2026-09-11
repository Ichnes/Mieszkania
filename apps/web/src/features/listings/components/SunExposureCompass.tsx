import { getSunExposure, type ExposureDirection } from "../lib/listing-language";

export function SunExposureCompass(input: {
  description?: string;
  compact?: boolean;
  directionsOverride?: ExposureDirection[];
}) {
  const exposure = getSunExposure(input.description, input.directionsOverride);
  if (exposure.directions.length === 0 && exposure.sideCount === undefined) return null;

  const positions: Record<ExposureDirection, { left: string; top: string; label: string }> = {
    N: { left: "50%", top: "11%", label: "Północ" },
    NE: { left: "76%", top: "24%", label: "Północny wschód" },
    E: { left: "89%", top: "50%", label: "Wschód" },
    SE: { left: "76%", top: "76%", label: "Południowy wschód" },
    S: { left: "50%", top: "89%", label: "Południe" },
    SW: { left: "24%", top: "76%", label: "Południowy zachód" },
    W: { left: "11%", top: "50%", label: "Zachód" },
    NW: { left: "24%", top: "24%", label: "Północny zachód" },
  };
  const sideCountLabel =
    exposure.sideCount === 2
      ? "mieszkanie dwustronne"
      : exposure.sideCount !== undefined
        ? `okna na ${exposure.sideCount} strony świata`
        : "";
  const label =
    exposure.directions.length > 0
      ? `Ekspozycja: ${exposure.directions.map((direction) => positions[direction].label.toLowerCase()).join(", ")}${sideCountLabel ? `; ${sideCountLabel}` : ""}`
      : `${sideCountLabel}; kierunki nie zostały podane`;

  return (
    <div
      className={input.compact ? "sun-compass sun-compass-compact" : "sun-compass"}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="sun-compass-label sun-compass-n">N</span>
      <span className="sun-compass-label sun-compass-e">E</span>
      <span className="sun-compass-label sun-compass-s">S</span>
      <span className="sun-compass-label sun-compass-w">W</span>
      {exposure.directions.map((direction) => (
        <span key={direction} className="sun-compass-marker" style={positions[direction]} />
      ))}
      {exposure.sideCount !== undefined ? (
        <span className="sun-compass-sides" aria-hidden="true">
          {exposure.sideCount === 2 ? "↔" : `${exposure.sideCount}×`}
        </span>
      ) : null}
    </div>
  );
}
