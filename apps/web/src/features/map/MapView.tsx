import { Select } from "../../components/Select";
import { apiFetch } from "../../shared/lib/http";
import type { FamilySettings, ListingSummary } from "@mieszkania/shared";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FullscreenFrame, useMapResize } from "../../shared/components/FullscreenFrame";
import { apiBaseUrl } from "../../shared/lib/api";
import { escapeHtml } from "../../shared/lib/text";
import { ListingBadgeRow } from "../listings/components/ListingBadgeRow";
import {
  metroLineColors,
  warsawDistrictCoordinates,
  warsawMetroLines,
  warsawRailLines,
} from "./data/transit";
import { isValidMapPoint } from "./lib/geometry";
import { ensureLeafletLoaded, mapOfferIconHtml } from "./lib/leaflet";
import { buildMapListingPreview, listingPriceAmount } from "./lib/previews";
import { MapCoordinate, MetroMapLine } from "./types";

export function MapView(input: {
  listings: ListingSummary[];
  selectedListingId?: string;
  onOpen: (listingId: string) => void | Promise<void>;
  workplaces?: FamilySettings["workplaces"];
  isLoading: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const onOpenRef = useRef(input.onOpen);
  const hasFittedInitialBoundsRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  useMapResize(mapContainerRef, mapRef, mapReady);
  const [maximumPrice, setMaximumPrice] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [rooms, setRooms] = useState<number[]>([]);
  const [maximumAgeDays, setMaximumAgeDays] = useState("");
  const [minimumArea, setMinimumArea] = useState("");
  const [maximumArea, setMaximumArea] = useState("");
  const [offerSearch, setOfferSearch] = useState("");
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const [railwayMap, setRailwayMap] = useState<{
    stations: Array<MapCoordinate & { kind?: string }>;
    lines: Array<Array<[number, number]>>;
  } | null>(null);
  const [tramwayMap, setTramwayMap] = useState<{
    stops: Array<MapCoordinate & { routes: string[] }>;
    routes: Array<{
      id: string;
      ref: string;
      name: string;
      colour?: string;
      lines: Array<Array<[number, number]>>;
    }>;
  } | null>(null);
  const [transitLayerVisibility, setTransitLayerVisibility] = useState({
    metro: true,
    railway: true,
    tramway: true,
  });
  const [selectedTramRoute, setSelectedTramRoute] = useState<string | null>(null);
  onOpenRef.current = input.onOpen;
  const hasListingFilters = Boolean(
    minimumPrice ||
    maximumPrice ||
    rooms.length ||
    maximumAgeDays ||
    minimumArea ||
    maximumArea ||
    offerSearch.trim(),
  );
  const geoListings = useMemo(
    () =>
      !hasListingFilters
        ? []
        : input.listings
            .filter((listing) => isValidMapPoint(listing.latitude, listing.longitude))
            .filter((listing) => {
              const price = listingPriceAmount(listing.priceLabel);
              const area = Number.parseFloat((listing.areaLabel ?? "").replace(",", "."));
              const publishedAt = listing.publishedAt ?? listing.firstSeenAt;
              const ageDays = publishedAt
                ? (Date.now() - new Date(publishedAt).getTime()) / 86_400_000
                : undefined;
              const searchable =
                `${listing.title} ${listing.addressText ?? ""} ${listing.district} ${listing.city}`.toLocaleLowerCase(
                  "pl-PL",
                );
              return (
                (!minimumPrice || (price !== null && price >= Number(minimumPrice))) &&
                (!maximumPrice || (price !== null && price <= Number(maximumPrice))) &&
                (!rooms.length ||
                  (listing.roomsCount !== undefined && rooms.includes(listing.roomsCount))) &&
                (!maximumAgeDays || (ageDays !== undefined && ageDays <= Number(maximumAgeDays))) &&
                (!minimumArea ||
                  (Number.isFinite(area) && area >= Number(minimumArea.replace(",", ".")))) &&
                (!maximumArea ||
                  (Number.isFinite(area) && area <= Number(maximumArea.replace(",", ".")))) &&
                (!offerSearch.trim() ||
                  searchable.includes(offerSearch.trim().toLocaleLowerCase("pl-PL")))
              );
            }),
    [
      input.listings,
      hasListingFilters,
      minimumPrice,
      maximumPrice,
      rooms,
      maximumAgeDays,
      minimumArea,
      maximumArea,
      offerSearch,
    ],
  );
  const geoWorkplaces = useMemo(
    () =>
      (input.workplaces ?? []).filter((workplace) =>
        isValidMapPoint(workplace.latitude, workplace.longitude),
      ),
    [input.workplaces],
  );
  const activeFilters = [
    minimumPrice ? `od ${Number(minimumPrice).toLocaleString("pl-PL")} PLN` : "",
    maximumPrice ? `do ${Number(maximumPrice).toLocaleString("pl-PL")} PLN` : "",
    rooms.length ? `${rooms.join(", ")} pokoje` : "",
    maximumAgeDays ? `do ${maximumAgeDays} dni` : "",
  ].filter(Boolean);

  useEffect(() => {
    let cancelled = false;
    setMapError(null);
    void ensureLeafletLoaded()
      .then(() => {
        if (cancelled || !mapContainerRef.current || !window.L || mapRef.current) return;
        mapRef.current = window.L.map(mapContainerRef.current, {
          preferCanvas: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([52.2297, 21.0122], 11);
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);
        layerRef.current = window.L.layerGroup().addTo(mapRef.current);
        setMapReady(true);
        window.setTimeout(() => mapRef.current?.invalidateSize(), 120);
      })
      .catch(() => {
        if (!cancelled)
          setMapError("Nie udało się załadować mapy. Sprawdź połączenie i spróbuj ponownie.");
      });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapAttempt]);

  useEffect(() => {
    void apiFetch(`${apiBaseUrl}/api/map/railway`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setRailwayMap(data);
      })
      .catch(() => undefined);
    void apiFetch(`${apiBaseUrl}/api/map/tramway`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setTramwayMap(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mapReady || !window.L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const bounds: Array<[number, number]> = [];
    for (const district of warsawDistrictCoordinates) {
      const marker = window.L.marker([district.latitude, district.longitude], {
        interactive: false,
        icon: window.L.divIcon({
          className: "leaflet-district-label",
          html: `<span>${escapeHtml(district.name)}</span>`,
          iconSize: [88, 20],
          iconAnchor: [44, 10],
        }),
      });
      marker.addTo(layerRef.current);
    }
    if (transitLayerVisibility.railway) {
      const railMarkers = new Map<string, MapCoordinate>();
      const railLines =
        railwayMap?.lines ??
        warsawRailLines.map((line) =>
          line.stations.map((station) => [station.latitude, station.longitude] as [number, number]),
        );
      const railStations = railwayMap?.stations ?? warsawRailLines.flatMap((line) => line.stations);
      for (const line of railLines)
        window.L.polyline(line, {
          className: "rail-line",
          color: "#34404d",
          weight: 3,
          opacity: 0.85,
        }).addTo(layerRef.current);
      for (const station of railStations) {
        railMarkers.set(`${station.latitude.toFixed(5)}:${station.longitude.toFixed(5)}`, station);
      }
      for (const station of railMarkers.values()) {
        const marker = window.L.marker([station.latitude, station.longitude], {
          zIndexOffset: 350,
          icon: window.L.divIcon({
            className: "leaflet-rail-marker",
            html: "<span>●</span>",
            iconSize: [13, 13],
            iconAnchor: [6, 6],
            popupAnchor: [0, -9],
          }),
        });
        marker.bindPopup(`<strong>${escapeHtml(station.name)}</strong><br/>PKP / SKM / KM / WKD`);
        marker.bindTooltip(escapeHtml(station.name), { direction: "top", offset: [0, -7] });
        marker.addTo(layerRef.current);
      }
    }

    if (transitLayerVisibility.tramway) {
      const tramStops = new Map<string, MapCoordinate & { routes: string[] }>();
      const visibleTramRoutes = selectedTramRoute
        ? (tramwayMap?.routes ?? []).filter((route) => route.ref === selectedTramRoute)
        : (tramwayMap?.routes ?? []);
      for (const route of visibleTramRoutes) {
        for (const line of route.lines)
          window.L.polyline(line, {
            className: selectedTramRoute ? "tram-line is-selected" : "tram-line",
            color: selectedTramRoute ? "#c8248d" : "#279bc7",
            weight: selectedTramRoute ? 5 : 3,
            opacity: selectedTramRoute ? 0.96 : 0.76,
          }).addTo(layerRef.current);
      }
      for (const stop of tramwayMap?.stops ?? [])
        tramStops.set(`${stop.latitude.toFixed(5)}:${stop.longitude.toFixed(5)}`, stop);
      for (const stop of tramStops.values()) {
        const marker = window.L.circleMarker([stop.latitude, stop.longitude], {
          radius: 6,
          className: "leaflet-tram-stop-dot",
          color: "#fff",
          weight: 2,
          fillColor: "#55b8ea",
          fillOpacity: 0.95,
        });
        const routeButtons = stop.routes
          .map(
            (route) =>
              `<button type="button" class="tram-route-button" data-tram-route="${escapeHtml(route)}">${escapeHtml(route)}</button>`,
          )
          .join("");
        marker.bindPopup(
          `<strong>${escapeHtml(stop.name)}</strong><br/><small>Tramwaje: ${routeButtons || "brak danych o linii"}</small>`,
        );
        marker.on("popupopen", () => {
          const popupElement = marker.getPopup()?.getElement() as HTMLElement | undefined;
          for (const element of Array.from(
            popupElement?.querySelectorAll("[data-tram-route]") ?? [],
          )) {
            const button = element as HTMLButtonElement;
            button.addEventListener("click", () =>
              setSelectedTramRoute(button.dataset.tramRoute ?? null),
            );
          }
        });
        marker.bindTooltip(escapeHtml(stop.name), { direction: "top", offset: [0, -9] });
        marker.addTo(layerRef.current);
      }
    }

    if (transitLayerVisibility.metro) {
      const metroMarkers = new Map<
        string,
        {
          latitude: number;
          longitude: number;
          stations: Array<{ code: MetroMapLine["code"]; name: string; planned: boolean }>;
        }
      >();
      for (const line of warsawMetroLines) {
        const points = line.stations.map((station) => [station.latitude, station.longitude]);
        window.L.polyline(points, {
          color: metroLineColors[line.code],
          className: `metro-line metro-line-${line.code.toLowerCase()}${line.planned ? " metro-line-planned" : ""}`,
          weight: line.planned ? 3 : 4,
          opacity: line.planned ? 0.8 : 0.95,
          dashArray: line.planned ? "7 6" : undefined,
        }).addTo(layerRef.current);
        for (const station of line.stations) {
          const key = `${station.latitude.toFixed(6)}:${station.longitude.toFixed(6)}`;
          const marker = metroMarkers.get(key) ?? {
            latitude: station.latitude,
            longitude: station.longitude,
            stations: [],
          };
          marker.stations.push({
            code: line.code,
            name: station.name,
            planned: Boolean(line.planned),
          });
          metroMarkers.set(key, marker);
        }
      }
      for (const stationGroup of metroMarkers.values()) {
        const codes = [...new Set(stationGroup.stations.map((station) => station.code))];
        const isPlanned = stationGroup.stations.every((station) => station.planned);
        const marker = window.L.marker([stationGroup.latitude, stationGroup.longitude], {
          zIndexOffset: isPlanned ? 400 : 500,
          icon: window.L.divIcon({
            className: `leaflet-metro-marker leaflet-metro-${codes[0].toLowerCase()}${isPlanned ? " is-planned" : ""}${codes.length > 1 ? " is-interchange" : ""}`,
            html: `<span>${codes.join("/")}</span>`,
            iconSize: [codes.length > 1 ? 43 : 27, 27],
            iconAnchor: [codes.length > 1 ? 21 : 13, 13],
            popupAnchor: [0, -15],
          }),
        });
        marker.bindPopup(
          stationGroup.stations
            .map(
              (station) =>
                `<strong>${station.code}${station.planned ? " (planowana)" : ""}</strong><br/>${escapeHtml(station.name)}`,
            )
            .join("<hr/>"),
        );
        marker.addTo(layerRef.current);
      }
    }
    for (const listing of geoListings) {
      const markerClass =
        listing.priceChangePercent < 0
          ? "leaflet-price-down-marker"
          : listing.priceChangePercent > 0
            ? "leaflet-price-up-marker"
            : "leaflet-default-marker";
      const marker = window.L.marker([listing.latitude, listing.longitude], {
        icon: window.L.divIcon({
          className: `${markerClass}${listing.isShortlisted ? " is-shortlisted" : ""}`,
          html: listing.isShortlisted ? mapOfferIconHtml.shortlisted : mapOfferIconHtml.regular,
          iconSize: [30, 38],
          iconAnchor: [15, 38],
          popupAnchor: [0, -24],
        }),
      });
      marker.on("click", () => {
        void onOpenRef.current(listing.id);
      });
      const preview = buildMapListingPreview(listing);
      marker.bindPopup(preview, {
        className: "listing-map-popup",
        minWidth: 350,
        maxWidth: 390,
        keepInView: true,
      });
      marker.bindTooltip(preview, {
        className: "listing-map-tooltip",
        direction: "top",
        offset: [0, -28],
        opacity: 1,
        sticky: true,
      });
      marker.addTo(layerRef.current);
      bounds.push([listing.latitude!, listing.longitude!]);
    }

    for (const workplace of geoWorkplaces) {
      const label =
        workplace.key === "user-office"
          ? "L"
          : workplace.key === "spouse-office"
            ? "K"
            : workplace.label.charAt(0).toUpperCase();
      const marker = window.L.marker([workplace.latitude, workplace.longitude], {
        zIndexOffset: 1000,
        icon: window.L.divIcon({
          className: "leaflet-work-marker",
          html: `<span>${label}</span>`,
          iconSize: [20, 30],
          iconAnchor: [10, 30],
          popupAnchor: [0, -24],
        }),
      });

      marker.bindPopup(
        `<strong>${escapeHtml(workplace.label)}</strong><br/>${escapeHtml(workplace.address)}`,
      );
      marker.addTo(layerRef.current);
      bounds.push([workplace.latitude!, workplace.longitude!]);
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 60);
    if (bounds.length > 0 && !hasFittedInitialBoundsRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [36, 36] });
      hasFittedInitialBoundsRef.current = true;
    } else if (bounds.length === 0 && !hasFittedInitialBoundsRef.current) {
      mapRef.current.setView([52.2297, 21.0122], 11);
    }
  }, [
    geoListings,
    geoWorkplaces,
    mapReady,
    railwayMap,
    tramwayMap,
    transitLayerVisibility,
    selectedTramRoute,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => mapRef.current?.invalidateSize(), 180);
    return () => window.clearTimeout(timeout);
  }, [geoListings.length, geoWorkplaces.length, input.selectedListingId]);

  return (
    <>
      <section className="map-filter-shell">
        <div className="map-filter-heading">
          <div>
            <p className="eyebrow">Widok mapy</p>
            <h3>Znajdź oferty na mapie</h3>
            <p>Ustaw przynajmniej jeden filtr, żeby pokazać dopasowane punkty.</p>
          </div>
          <div>
            <span className="map-result-count">{geoListings.length} ofert</span>
            <button
              className="action-button secondary-button map-filter-toggle"
              type="button"
              onClick={() => setMapFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />{" "}
              {mapFiltersOpen ? "Ukryj filtry" : "Pokaż filtry"}
            </button>
          </div>
        </div>
        <div
          className={mapFiltersOpen ? "map-filter-panel is-open" : "map-filter-panel"}
          aria-label="Filtry ofert na mapie"
        >
          <label className="map-search-field">
            <span>Szukaj w ofertach</span>
            <input
              className="text-input"
              value={offerSearch}
              placeholder="tytuł, ulica, dzielnica"
              onChange={(event) => setOfferSearch(event.target.value)}
            />
          </label>
          <label>
            <span>Cena od</span>
            <input
              className="text-input"
              inputMode="numeric"
              value={minimumPrice}
              placeholder="np. 700 000"
              onChange={(event) => setMinimumPrice(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label>
            <span>Cena do</span>
            <input
              className="text-input"
              inputMode="numeric"
              value={maximumPrice}
              placeholder="np. 1 500 000"
              onChange={(event) => setMaximumPrice(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <fieldset className="map-room-filters">
            <legend>Pokoje</legend>
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <label key={count}>
                <input
                  type="checkbox"
                  checked={rooms.includes(count)}
                  onChange={() =>
                    setRooms((current) =>
                      current.includes(count)
                        ? current.filter((value) => value !== count)
                        : [...current, count],
                    )
                  }
                />{" "}
                {count}
              </label>
            ))}
          </fieldset>
          <label>
            <span>Nowe dane</span>
            <Select
              label="Nowe dane"
              value={maximumAgeDays}
              onChange={(value) => setMaximumAgeDays(value)}
            >
              <option value="">Dowolnie</option>
              <option value="1">do 1 dnia</option>
              <option value="5">do 5 dni</option>
              <option value="14">do 14 dni</option>
              <option value="30">do 30 dni</option>
            </Select>
          </label>
          <label>
            <span>Metraż od</span>
            <input
              className="text-input"
              inputMode="decimal"
              value={minimumArea}
              placeholder="np. 50"
              onChange={(event) => setMinimumArea(event.target.value.replace(/[^\d,.]/g, ""))}
            />
          </label>
          <label>
            <span>Metraż do</span>
            <input
              className="text-input"
              inputMode="decimal"
              value={maximumArea}
              placeholder="np. 90"
              onChange={(event) => setMaximumArea(event.target.value.replace(/[^\d,.]/g, ""))}
            />
          </label>
          <fieldset className="map-transit-filters">
            <legend>Transport</legend>
            <label>
              <input
                type="checkbox"
                checked={transitLayerVisibility.metro}
                onChange={(event) =>
                  setTransitLayerVisibility((current) => ({
                    ...current,
                    metro: event.target.checked,
                  }))
                }
              />{" "}
              Metro
            </label>
            <label>
              <input
                type="checkbox"
                checked={transitLayerVisibility.railway}
                onChange={(event) =>
                  setTransitLayerVisibility((current) => ({
                    ...current,
                    railway: event.target.checked,
                  }))
                }
              />{" "}
              Pociągi
            </label>
            <label>
              <input
                type="checkbox"
                checked={transitLayerVisibility.tramway}
                onChange={(event) =>
                  setTransitLayerVisibility((current) => ({
                    ...current,
                    tramway: event.target.checked,
                  }))
                }
              />{" "}
              Tramwaje
            </label>
          </fieldset>
          {selectedTramRoute ? (
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => setSelectedTramRoute(null)}
            >
              Pokaż wszystkie tramwaje
            </button>
          ) : null}
          {hasListingFilters ? (
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => {
                setOfferSearch("");
                setMinimumPrice("");
                setMaximumPrice("");
                setRooms([]);
                setMaximumAgeDays("");
                setMinimumArea("");
                setMaximumArea("");
              }}
            >
              Wyczyść
            </button>
          ) : null}
        </div>
      </section>
      <div className="map-layout">
        <FullscreenFrame label="Mapa ofert" className="map-canvas-wrap">
          {mapError ? (
            <div className="map-load-error" role="alert">
              <p>{mapError}</p>
              <button
                className="action-button secondary-button"
                onClick={() => setMapAttempt((attempt) => attempt + 1)}
              >
                Ponów ładowanie mapy
              </button>
            </div>
          ) : null}
          <div ref={mapContainerRef} className="map-canvas" />
          <details className="map-legend" aria-label="Legenda mapy" open={window.innerWidth > 700}>
            <summary>Legenda · oferty i transport</summary>
            <div className="map-legend-items">
              <span>
                <i className="map-legend-dot map-flat" /> Bez zmiany
              </span>
              <span>
                <i className="map-legend-dot map-down" /> Cena spadła
              </span>
              <span>
                <i className="map-legend-dot map-up" /> Cena wzrosła
              </span>
              <span>
                <i className="map-legend-star">&#9733;</i> Ulubione
              </span>
              {(["M1", "M2", "M3", "M4", "M5"] as const).map((code) => (
                <span key={code}>
                  <i className={`metro-legend-badge metro-legend-${code.toLowerCase()}`}>{code}</i>
                  {code === "M1"
                    ? "Istniejąca"
                    : code === "M2"
                      ? "Istniejąca + rozbudowa"
                      : "Planowana"}
                </span>
              ))}
              <span>
                <i className="map-legend-planned-line" /> Linia przerywana: plan / budowa
              </span>
              <span>
                <i className="rail-legend-line" /> PKP / SKM / KM / WKD
              </span>
              <span>
                <i className="tram-legend-line" /> Tramwaje
              </span>
            </div>
          </details>
          <p className="map-caption">
            {input.isLoading
              ? "Ładowanie wszystkich ofert na mapę..."
              : `${geoListings.length} ofert z geokodem${geoWorkplaces.length ? ` · ${geoWorkplaces.length} punktów pracy` : ""}`}
          </p>
        </FullscreenFrame>
        <div className="map-list">
          <div className="result-box">
            <strong>Widoczne punkty</strong>
            <p>Oferty z geokodem: {geoListings.length}</p>
            <p>Punkty pracy z geokodem: {geoWorkplaces.length}</p>
            {activeFilters.length > 0 ? (
              <div className="active-filters">
                {activeFilters.map((filter) => (
                  <span key={filter} className="active-filter-chip">
                    {filter}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {geoWorkplaces.map((workplace) => {
            const label =
              workplace.key === "user-office"
                ? "L"
                : workplace.key === "spouse-office"
                  ? "K"
                  : workplace.label.charAt(0).toUpperCase();
            return (
              <article key={workplace.key} className="map-card">
                <div className="map-card-row">
                  <strong>{label}</strong>
                  <span>{workplace.label}</span>
                </div>
                <p className="muted">{workplace.address}</p>
              </article>
            );
          })}
          {geoListings.map((listing) => (
            <article
              key={listing.id}
              className={listing.id === input.selectedListingId ? "map-card active" : "map-card"}
            >
              <div className="map-card-row">
                <button className="map-card-title" onClick={() => void input.onOpen(listing.id)}>
                  {listing.title}
                </button>
                <span>{listing.isShortlisted ? "S" : "O"}</span>
              </div>
              <p className="muted">
                {listing.district}
                {listing.neighborhood ? ` / ${listing.neighborhood}` : ""}
              </p>
              <p className="muted">
                {listing.priceLabel}
                {listing.priceSource === "negotiated" ? " · Cena po negocjacjach" : ""}
              </p>
              <ListingBadgeRow badges={(listing.badges ?? []).slice(0, 3)} />
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
