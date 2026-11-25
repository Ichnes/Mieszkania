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
  selectedArea,
  metricLabel,
  metricValue,
}: {
  stats: MarketStatsResponse;
  selectedArea: string | null;
  metricLabel: string;
  metricValue: (row: MarketStatsResponse["districts"][number]) => number | null;
  selected: string | null;
  onSelect: (district: string) => void;
  onAreaSelect: (area: string | null) => void;
}) {
  const [data, setData] = useState<MsiCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
  const active = areas.find((a) => a.properties.name === selectedArea);
  const areaId = active?.id;
  const localDistrict = stats.districts.find((row) => row.district === selected);
  const local = localDistrict?.neighborhoods.find((row) => row.neighborhood === selectedArea);
  const values = districts.flatMap((row) => metricValue(row) ?? []);
  const min = Math.min(...values),
    max = Math.max(...values);
  const fmt = (n: number) => Math.round(n).toLocaleString("pl-PL");
  return (
    <>
      <div className="stats-card-heading">
        <div>
          <p className="eyebrow">Rzeczywiste granice</p>
          <h3>{selected ? selected + " · obszary MSI" : "Mapa dzielnic"}</h3>
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
      {selected && (
        <p className="district-local-summary">
          {localDistrict?.active ?? 0} aktywnych mieszkań · {stats.periodDays} dni historii
        </p>
      )}
      {!selected && (
        <p className="district-map-legend">
          {metricLabel}{" "}
          {values.length > 0 && (
            <>
              <b>{fmt(min)}</b>
              <i aria-hidden="true" />
              <b>{fmt(max)}</b>
            </>
          )}
          <small>Szary · brak danych</small>
        </p>
      )}
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
                  style={{
                    fill:
                      metricValue(d) == null
                        ? "var(--line)"
                        : `color-mix(in srgb, #cf8b55 ${22 + (72 * (metricValue(d)! - min)) / (max - min || 1)}%, var(--surface))`,
                  }}
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
                  <title>
                    {d.district} · {metricLabel} ·{" "}
                    {metricValue(d) == null ? "Brak danych" : fmt(metricValue(d)!)}
                  </title>
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
                    onClick={() => onAreaSelect(a.properties.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAreaSelect(a.properties.name);
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
            {selectedArea ? (
              <>
                <strong>{selectedArea}</strong>
                <span>
                  {local
                    ? `${local.active} aktywnych · ${local.averagePricePerSqm > 0 ? "średnio " + fmt(local.averagePricePerSqm) + " zł/m²" : "brak cen"}`
                    : "Brak aktywnych ofert przypisanych do tej nazwy"}
                  {local && !active && " · nazwa z ogłoszenia bez granicy MSI"}
                </span>
              </>
            ) : (
              "Wybierz obszar, aby zobaczyć ceny i liczebność."
            )}
          </div>
          <div className="msi-area-list" aria-label="Obszary MSI">
            {areas.map((a, index) => (
              <button
                key={a.id}
                type="button"
                className={a.id === areaId ? "is-selected" : ""}
                aria-pressed={a.id === areaId}
                onClick={() => onAreaSelect(a.properties.name)}
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
