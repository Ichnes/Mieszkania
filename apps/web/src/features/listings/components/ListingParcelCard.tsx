import type {
  ListingDetail,
  ParcelContextResponse,
  ParcelGeometry,
  PlanningContextResponse,
} from "@mieszkania/shared";
import { CircleAlert, Map as MapIcon, MapPin, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiBaseUrl } from "../../../shared/lib/api";
import { formatPlanningDate } from "../../../shared/lib/format";
import { SurroundingsSummary } from "./AnalysisInsights";

export function ListingParcelCard({
  listing,
}: {
  listing: Pick<ListingDetail, "id" | "latitude" | "longitude">;
}) {
  const [context, setContext] = useState<ParcelContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parcelRefreshAttempt, setParcelRefreshAttempt] = useState(0);
  const [planning, setPlanning] = useState<PlanningContextResponse | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setContext(null);
    setError(null);
    setPlanning(null);
    setPlanningError(null);
    setLoading(true);
    fetch(
      `${apiBaseUrl}/api/listings/${listing.id}/parcel${parcelRefreshAttempt ? "?refresh=true" : ""}`,
      { signal: controller.signal },
    )
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("Nie udało się pobrać działki.")),
      )
      .then((value: ParcelContextResponse) => {
        setContext(value);
        if (value.status === "available") void loadPlanning(false, controller.signal);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Nie udało się pobrać działki.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [listing.id, parcelRefreshAttempt]);

  async function loadPlanning(refresh = false, signal?: AbortSignal) {
    setPlanningLoading(true);
    setPlanningError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/listings/${listing.id}/planning${refresh ? "?refresh=true" : ""}`,
        { signal },
      );
      if (!response.ok) throw new Error("Nie udało się pobrać analizy planistycznej.");
      setPlanning((await response.json()) as PlanningContextResponse);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setPlanningError(
        cause instanceof Error ? cause.message : "Nie udało się pobrać analizy planistycznej.",
      );
    } finally {
      if (!signal?.aborted) setPlanningLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="listing-parcel-card">
        <div className="parcel-card-heading">
          <MapIcon size={19} aria-hidden="true" />
          <div>
            <strong>Działka i planowanie</strong>
            <span>Sprawdzam ULDK GUGiK…</span>
          </div>
        </div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="listing-parcel-card is-muted">
        <div className="parcel-card-heading">
          <CircleAlert size={19} aria-hidden="true" />
          <div>
            <strong>Działka i planowanie</strong>
            <span>{error} To chwilowy błąd usługi ULDK, nie informacja o braku działki.</span>
          </div>
        </div>
        <button
          className="action-button secondary-button"
          type="button"
          onClick={() => setParcelRefreshAttempt((value) => value + 1)}
        >
          <RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie
        </button>
      </section>
    );
  }
  if (!context || context.status === "missing_location") {
    return (
      <section className="listing-parcel-card is-muted">
        <div className="parcel-card-heading">
          <MapPin size={19} aria-hidden="true" />
          <div>
            <strong>Działka i planowanie</strong>
            <span>Potrzebna jest dokładna lokalizacja oferty.</span>
          </div>
        </div>
      </section>
    );
  }
  if (context.status === "not_found" || !context.parcel) {
    return (
      <section className="listing-parcel-card is-muted">
        <div className="parcel-card-heading">
          <MapPin size={19} aria-hidden="true" />
          <div>
            <strong>Działka i planowanie</strong>
            <span>ULDK nie odnalazł działki dla tego punktu.</span>
          </div>
        </div>
      </section>
    );
  }

  const parcel = context.parcel;
  return (
    <section className="listing-parcel-card">
      <div className="parcel-card-heading">
        <MapIcon size={19} aria-hidden="true" />
        <div>
          <strong>Działka i planowanie</strong>
          <span>
            Dane ewidencyjne z ULDK GUGiK{context.isStale ? " · ostatni poprawny wynik" : ""}
          </span>
        </div>
      </div>
      <div className="parcel-card-grid">
        <ParcelShape
          geometry={parcel.geometry}
          latitude={listing.latitude}
          longitude={listing.longitude}
        />
        <div className="parcel-card-data">
          <dl>
            <div>
              <dt>Numer działki</dt>
              <dd>{parcel.number ?? "—"}</dd>
            </div>
            <div>
              <dt>Identyfikator</dt>
              <dd>
                <code>{parcel.id}</code>
              </dd>
            </div>
            <div>
              <dt>Obręb</dt>
              <dd>{parcel.region ?? "—"}</dd>
            </div>
            <div>
              <dt>Gmina</dt>
              <dd>{parcel.commune ?? "—"}</dd>
            </div>
          </dl>
          <div className="parcel-card-actions">
            <a
              className="action-button secondary-button"
              href={parcel.geoportalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Otwórz działkę w Geoportalu
            </a>
          </div>
        </div>
      </div>
      <div className="planning-analysis">
        <div className="planning-analysis-heading">
          <div>
            <strong>Najbliższe otoczenie działki</strong>
            <span>Infrastruktura i potencjalne uciążliwości w OpenStreetMap · promień 50 m</span>
          </div>
        </div>
        {planningLoading ? (
          <p className="muted">Sprawdzam obiekty, zabudowę i sposób użytkowania terenu…</p>
        ) : planning?.immediateSurroundings?.status === "available" &&
          planning.immediateSurroundings.findings.length ? (
          <div className="surroundings-findings">
            <SurroundingsSummary findings={planning.immediateSurroundings.findings} />
          </div>
        ) : planning?.immediateSurroundings?.status === "available" ? (
          <div className="surroundings-assessment is-clear">
            <span>
              W danych OSM nie znaleziono w promieniu 50 m oznaczonej fabryki, hali przemysłowej,
              składowiska, budowy, stacji paliw, torów ani drogi głównej.
            </span>
          </div>
        ) : !planningError ? (
          <div className="planning-feedback">
            <p className="muted">Nie udało się teraz sprawdzić bezpośredniego otoczenia.</p>
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => void loadPlanning(true)}
            >
              <RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie
            </button>
          </div>
        ) : null}
        <p className="parcel-card-note">
          Brak ostrzeżenia oznacza tylko brak odpowiedniego oznaczenia w OSM — warto potwierdzić
          sąsiednie działki na mapie i podczas oględzin.
        </p>
        <div className="urban-registry-analysis">
          <div className="planning-analysis-heading">
            <div>
              <strong>Formalne akty planistyczne</strong>
              <span>Rejestr Urbanistyczny · działka {parcel.number ?? parcel.id}</span>
            </div>
            {planning?.isStale ? (
              <span className="planning-status is-warning">ostatni poprawny wynik</span>
            ) : null}
          </div>
          {planningLoading ? (
            <p className="muted">Szukam planów przypisanych do tej działki…</p>
          ) : planningError || planning?.status === "unavailable" ? (
            <div className="planning-feedback">
              <p className="muted">{planningError ?? planning?.message}</p>
              <button
                className="action-button secondary-button"
                type="button"
                onClick={() => void loadPlanning(true)}
              >
                <RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie
              </button>
            </div>
          ) : planning?.status === "available" ? (
            <div className="planning-act-list">
              {planning.acts.map((act) => (
                <article className="planning-act" key={act.id}>
                  <div className="planning-act-top">
                    <span>{act.planTypeLabel}</span>
                    {act.status ? <span className="planning-status">{act.status}</span> : null}
                  </div>
                  <strong>{act.title}</strong>
                  <p>
                    {act.validFrom
                      ? `Obowiązuje od ${formatPlanningDate(act.validFrom)}`
                      : act.publishDate
                        ? `Opublikowano ${formatPlanningDate(act.publishDate)}`
                        : "Brak daty obowiązywania"}
                    {act.validTo ? ` do ${formatPlanningDate(act.validTo)}` : ""}
                  </p>
                  <a
                    className="text-link-button"
                    href={act.detailsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Otwórz konkretny akt w RU
                  </a>
                </article>
              ))}
            </div>
          ) : planning?.status === "not_found" ? (
            <div className="planning-feedback">
              <p>{planning.message}</p>
              <a
                className="text-link-button"
                href={planning.registryUrl}
                target="_blank"
                rel="noreferrer"
              >
                Sprawdź wyszukiwarkę RU
              </a>
            </div>
          ) : null}
          <p className="parcel-card-note">
            RU pokazuje opublikowane akty planowania przestrzennego przypisane do identyfikatora
            działki. Do 30 listopada 2026 r. rejestr jest nadal uzupełniany, dlatego brak wyniku nie
            przesądza o braku planu.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ParcelShape({
  geometry,
  latitude,
  longitude,
}: {
  geometry: ParcelGeometry;
  latitude?: number;
  longitude?: number;
}) {
  const rings =
    geometry.type === "Polygon"
      ? geometry.coordinates.map((ring) => ring)
      : geometry.coordinates.flatMap((polygon) => polygon.slice(0, 1));
  const points = rings.flat();
  if (!points.length) return <div className="parcel-shape-empty">Brak geometrii</div>;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.000001);
  const height = Math.max(maxY - minY, 0.000001);
  const project = (point: [number, number]) =>
    `${12 + ((point[0] - minX) / width) * 216},${128 - ((point[1] - minY) / height) * 116}`;
  const pointX = longitude == null ? null : 12 + ((longitude - minX) / width) * 216;
  const pointY = latitude == null ? null : 128 - ((latitude - minY) / height) * 116;
  return (
    <svg
      className="parcel-shape"
      viewBox="0 0 240 140"
      role="img"
      aria-label="Granica działki ewidencyjnej"
    >
      {rings.map((ring, index) => (
        <polygon key={index} points={ring.map(project).join(" ")} />
      ))}
      {pointX !== null &&
      pointY !== null &&
      pointX >= 0 &&
      pointX <= 240 &&
      pointY >= 0 &&
      pointY <= 140 ? (
        <circle cx={pointX} cy={pointY} r="4" />
      ) : null}
    </svg>
  );
}
