import { SlidersHorizontal } from "lucide-react";
import { MarketStatsFilters } from "./types";
import { hasExposureFilter } from "@mieszkania/shared";
import { ExposureFilterCompass } from "./ExposureFilterCompass";

export function StatsControls(input: {
  period: 30 | 90 | 180;
  draft: MarketStatsFilters;
  pending: boolean;
  onPeriodChange: (period: 30 | 90 | 180) => void;
  onDraftChange: (filters: MarketStatsFilters) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const activeFilterCount = [
    input.draft.minYear,
    input.draft.minArea,
    input.draft.maxArea,
    input.draft.elevator,
    input.draft.garage,
    input.draft.storage,
    hasExposureFilter(input.draft.directions),
  ].filter(Boolean).length;

  return (
    <section className="stats-controls panel">
      <div className="stats-controls-heading">
        <span className="stats-controls-icon">
          <SlidersHorizontal size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Zakres danych</p>
          <h2>Ustaw analizowany rynek</h2>
          <small>Okres wyznacza zakres historii ogłoszeń i indeksu presji.</small>
        </div>
        <div className="stats-period-bar" aria-label="Zakres analizy">
          {([30, 90, 180] as const).map((days) => (
            <button
              type="button"
              key={days}
              aria-pressed={input.period === days}
              className={input.period === days ? "is-active" : ""}
              onClick={() => input.onPeriodChange(days)}
            >
              {days} dni
            </button>
          ))}
        </div>
      </div>
      <div className="stats-filter-grid">
        <label className="stats-filter-field">
          <span>Rok budowy od</span>
          <input
            type="number"
            min="1800"
            max="2100"
            placeholder="np. 2000"
            value={input.draft.minYear}
            onChange={(event) =>
              input.onDraftChange({ ...input.draft, minYear: event.target.value })
            }
          />
        </label>
        <label className="stats-filter-field">
          <span>Metraż od</span>
          <div>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="np. 60"
              value={input.draft.minArea}
              onChange={(event) =>
                input.onDraftChange({ ...input.draft, minArea: event.target.value })
              }
            />
            <small>m²</small>
          </div>
        </label>
        <label className="stats-filter-field">
          <span>Metraż do</span>
          <div>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="np. 100"
              value={input.draft.maxArea}
              onChange={(event) =>
                input.onDraftChange({ ...input.draft, maxArea: event.target.value })
              }
            />
            <small>m²</small>
          </div>
        </label>
        <div className="stats-filter-toggles" role="group" aria-label="Udogodnienia">
          <small className="stats-filter-caption">Udogodnienia</small>
          <label className={input.draft.elevator ? "is-active" : ""}>
            <input
              type="checkbox"
              checked={input.draft.elevator}
              onChange={(event) =>
                input.onDraftChange({ ...input.draft, elevator: event.target.checked })
              }
            />
            <span>Winda</span>
          </label>
          <label className={input.draft.garage ? "is-active" : ""}>
            <input
              type="checkbox"
              checked={input.draft.garage}
              onChange={(event) =>
                input.onDraftChange({ ...input.draft, garage: event.target.checked })
              }
            />
            <span>Garaż / miejsce</span>
          </label>
          <label className={input.draft.storage ? "is-active" : ""}>
            <input
              type="checkbox"
              checked={input.draft.storage}
              onChange={(event) =>
                input.onDraftChange({ ...input.draft, storage: event.target.checked })
              }
            />
            <span>Komórka / piwnica</span>
          </label>
        </div>
        <ExposureFilterCompass
          selected={input.draft.directions}
          onChange={(directions) => input.onDraftChange({ ...input.draft, directions })}
        />
        <div className="stats-filter-actions">
          {input.pending && <small role="status">Niezastosowane zmiany</small>}
          <button
            type="button"
            className="stats-filter-clear"
            onClick={input.onClear}
            disabled={
              !input.pending && activeFilterCount === 0 && input.draft.directions.length === 0
            }
          >
            Wyczyść
          </button>
          <button type="button" className="stats-filter-submit" onClick={input.onApply}>
            Pokaż wyniki{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </button>
        </div>
      </div>
    </section>
  );
}
