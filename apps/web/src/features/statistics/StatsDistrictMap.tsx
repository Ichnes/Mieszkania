import type { MarketStatsResponse, ParcelGeometry } from "@mieszkania/shared";
import { useEffect, useMemo, useState } from "react";
import { FullscreenFrame } from "../../shared/components/FullscreenFrame";
import {
  geometryBounds,
  geometryLabel,
  geometryPath,
  type MsiCollection,
} from "./lib/msi-geometry";

export function StatsDistrictMap({
  stats,
  selected,
  onSelect,
  onAreaSelect,
}: {
  stats: MarketStatsResponse;
  selected: string | null;
  onSelect: (district: string) => void;
  onAreaSelect: (area: string | null) => void;
}) {
  const [data, setData] = useState<MsiCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [areaId, setAreaId] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch("/data/warsaw-msi.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    setAreaId(null);
    onAreaSelect(null);
  }, [selected, onAreaSelect]);
  function selectArea(id: number, name: string) {
    setAreaId(id);
    onAreaSelect(name);
  }
  const areas = useMemo(
    () =>
      (data?.features ?? [])
        .filter((f) => f.properties.district === selected)
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name, "pl"))
        .map((feature) => ({
          ...feature,
          path: geometryPath(feature.geometry),
          label: geometryLabel(feature.geometry),
        })),
    [data, selected],
  );
  const districts = useMemo(
    () =>
      stats.districts
        .filter((d) => d.geometry)
        .map((d) => ({ ...d, path: geometryPath(d.geometry as ParcelGeometry) })),
    [stats],
  );
  const bounds = useMemo(
    () =>
      selected && areas.length
        ? geometryBounds(areas.map((a) => a.geometry))
        : geometryBounds(districts.map((d) => d.geometry as ParcelGeometry)),
    [selected, areas, districts],
  );
  const labelSize = Math.max(bounds.width, bounds.height) / 30;
  const active = areas.find((a) => a.id === areaId);
  return (
    <>
      <div className="stats-card-heading">
        <div>
          <p className="eyebrow">Rzeczywiste granice</p>
          <h3>{selected ?? "Mapa dzielnic"}</h3>
        </div>
        {selected ? (
          <button
            type="button"
            className="ghost-button msi-back-button"
            onClick={() => onSelect(selected)}
          >
            Cała Warszawa
          </button>
        ) : (
          <span>Wybierz dzielnicę</span>
        )}
      </div>
      <FullscreenFrame label="Mapa statystyk dzielnic" className="stats-map-fullscreen">
        <svg
          className="district-svg msi-map"
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          role="group"
          aria-label={selected ? `Granice obszarów MSI: ${selected}` : "Mapa dzielnic Warszawy"}
        >
          {!selected || !areas.length
            ? districts.map((d) => (
                <path
                  key={d.district}
                  d={d.path}
                  fillRule="evenodd"
                  className="district-polygon"
                  role="button"
                  tabIndex={0}
                  aria-label={`Wybierz dzielnicę ${d.district}`}
                  onClick={() => onSelect(d.district)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(d.district);
                    }
                  }}
                >
                  <title>{d.district}</title>
                </path>
              ))
            : areas.map((a, index) => (
                <g key={a.id}>
                  <path
                    d={a.path}
                    fillRule="evenodd"
                    className={`msi-area msi-color-${index % 6}${a.id === areaId ? " is-selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={a.id === areaId}
                    aria-label={a.properties.name}
                    onClick={() => selectArea(a.id, a.properties.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectArea(a.id, a.properties.name);
                      }
                    }}
                  >
                    <title>{a.properties.name} · obszar MSI</title>
                  </path>
                  {a.label ? (
                    <text
                      className="msi-area-number"
                      x={a.label[0]}
                      y={a.label[1]}
                      fontSize={labelSize}
                      textAnchor="middle"
                      dominantBaseline="central"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </text>
                  ) : null}
                </g>
              ))}
        </svg>
        {active ? (
          <div className="msi-map-caption" aria-hidden="true">
            {active.properties.name}
          </div>
        ) : null}
      </FullscreenFrame>
      {failed ? (
        <p role="status">
          Nie udało się wczytać granic MSI.{" "}
          <button type="button" onClick={() => setAttempt((a) => a + 1)}>
            Ponów
          </button>
        </p>
      ) : !data ? (
        <p role="status">Wczytywanie granic MSI…</p>
      ) : selected ? (
        <>
          <p className="stats-map-hint">
            {areas.length} obszarów MSI · wybierz obszar na mapie lub na liście. Numery wskazują
            nazwy poniżej.
          </p>
          <div className="msi-area-selection" aria-live="polite">
            {active ? (
              <strong>{active.properties.name}</strong>
            ) : (
              "Dotknij obszaru, aby zobaczyć jego nazwę."
            )}
          </div>
          <div className="msi-area-list" aria-label="Obszary MSI">
            {areas.map((a, index) => (
              <button
                key={a.id}
                type="button"
                className={a.id === areaId ? "is-selected" : ""}
                aria-pressed={a.id === areaId}
                onClick={() => selectArea(a.id, a.properties.name)}
              >
                <span className={`msi-key msi-color-${index % 6}`}>{index + 1}</span>
                {a.properties.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="stats-map-hint">
          Kliknij dzielnicę, aby przybliżyć jej rzeczywisty podział na obszary MSI.
        </p>
      )}
      <p className="msi-attribution">
        Granice:{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap contributors · ODbL
        </a>
        {data ? ` · stan ${data.updatedAt.slice(0, 10)}` : ""}. Obszary MSI mogą różnić się od nazw
        osiedli używanych w ogłoszeniach; nie dorabiamy granic dla tych nazw.
      </p>
    </>
  );
}
