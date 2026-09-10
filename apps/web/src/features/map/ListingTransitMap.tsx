import { warsawRailwayMap, warsawTramwayMap } from "@mieszkania/shared/transport";
import type { ListingDetail } from "@mieszkania/shared";
import { useEffect, useRef, useState } from "react";
import { FullscreenFrame, useMapResize } from "../../shared/components/FullscreenFrame";
import { escapeHtml } from "../../shared/lib/text";
import { metroLineColors, warsawMetroLines } from "./data/transit";
import { ensureLeafletLoaded, mapLocationIconHtml } from "./lib/leaflet";
import { metroStationPopup } from "./lib/metro-popup";
import { mapRailStations } from "./lib/rail-stations";
import { MapCoordinate } from "./types";

export function ListingTransitMap(input: {
  listing: Pick<ListingDetail, "id" | "title" | "latitude" | "longitude">;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const focusedListingIdRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const tramStops = warsawTramwayMap.stops;
  const railwayMap = warsawRailwayMap;
  const latitude = input.listing.latitude!;
  const longitude = input.listing.longitude!;

  useEffect(() => {
    let cancelled = false;
    setMapError(null);
    void ensureLeafletLoaded()
      .then(() => {
        if (cancelled || !mapContainerRef.current || !window.L || mapRef.current) return;
        mapRef.current = window.L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
          touchZoom: true,
          preferCanvas: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([latitude, longitude], 14);
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
    if (!mapReady || !window.L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    if (focusedListingIdRef.current !== input.listing.id) {
      mapRef.current.setView([latitude, longitude], 14);
      focusedListingIdRef.current = input.listing.id;
    }

    const listingMarker = window.L.marker([latitude, longitude], {
      zIndexOffset: 1000,
      icon: window.L.divIcon({
        className: "leaflet-detail-listing-marker",
        html: mapLocationIconHtml,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -26],
      }),
    });
    listingMarker
      .bindPopup(`<strong>${escapeHtml(input.listing.title)}</strong>`)
      .addTo(layerRef.current);

    const railwayStations = new Map<string, MapCoordinate>();
    const railStations = mapRailStations(railwayMap.stations);
    window.L.polyline(railwayMap.lines, {
      interactive: false,
      color: "#17202a",
      weight: 2.5,
      opacity: 0.76,
    }).addTo(layerRef.current);
    for (const station of railStations)
      railwayStations.set(
        `${station.latitude.toFixed(5)}:${station.longitude.toFixed(5)}`,
        station,
      );
    for (const station of railwayStations.values()) {
      const marker = window.L.circleMarker([station.latitude, station.longitude], {
        radius: 5,
        color: "#fff",
        weight: 1.5,
        fillColor: "#17202a",
        fillOpacity: 0.95,
      });
      marker
        .bindPopup(`<strong>${escapeHtml(station.name)}</strong><br/>PKP / SKM / KM / WKD`)
        .addTo(layerRef.current);
    }

    const metroStations = new Map<
      string,
      {
        latitude: number;
        longitude: number;
        codes: string[];
        names: string[];
        popups: string[];
        planned: boolean;
      }
    >();
    for (const line of warsawMetroLines) {
      window.L.polyline(
        line.stations.map((station) => [station.latitude, station.longitude]),
        {
          color: metroLineColors[line.code],
          weight: line.planned ? 3 : 4,
          opacity: 0.8,
          dashArray: line.planned ? "7 6" : undefined,
          interactive: false,
        },
      ).addTo(layerRef.current);
      for (const station of line.stations) {
        if (station.connectionOnly) continue;
        const key = `${station.latitude.toFixed(6)}:${station.longitude.toFixed(6)}`;
        const group = metroStations.get(key) ?? {
          latitude: station.latitude,
          longitude: station.longitude,
          codes: [],
          names: [],
          popups: [],
          planned: true,
        };
        group.codes.push(line.code);
        group.names.push(station.name);
        group.popups.push(metroStationPopup(line, station));
        group.planned = group.planned && Boolean(line.planned);
        metroStations.set(key, group);
      }
    }
    for (const station of metroStations.values()) {
      const codes = [...new Set(station.codes)];
      const marker = window.L.marker([station.latitude, station.longitude], {
        zIndexOffset: 500,
        icon: window.L.divIcon({
          className: `leaflet-metro-marker leaflet-metro-${codes[0].toLowerCase()}${codes.length > 1 ? " is-interchange" : ""}${station.planned ? " is-planned" : ""}`,
          html: `<span>${codes.join("/")}</span>`,
          iconSize: [codes.length > 1 ? 43 : 27, 27],
          iconAnchor: [codes.length > 1 ? 21 : 13, 13],
          popupAnchor: [0, -15],
        }),
      });
      marker.bindPopup(station.popups.join("<hr/>")).addTo(layerRef.current);
    }

    for (const stop of tramStops) {
      const marker = window.L.circleMarker([stop.latitude, stop.longitude], {
        radius: 5,
        color: "#fff",
        weight: 1.5,
        fillColor: "#55b8ea",
        fillOpacity: 0.95,
      });
      marker
        .bindPopup(
          `<strong>${escapeHtml(stop.name)}</strong><br/><small>Tramwaje: ${escapeHtml(stop.routes.join(", ") || "brak danych o linii")}</small>`,
        )
        .addTo(layerRef.current);
    }
    window.setTimeout(() => mapRef.current?.invalidateSize(), 60);
  }, [input.listing.id, input.listing.title, latitude, longitude, mapReady, railwayMap, tramStops]);

  useMapResize(mapContainerRef, mapRef, mapReady);
  return (
    <FullscreenFrame label="Mapa otoczenia oferty" className="listing-map-shell">
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
      <div
        ref={mapContainerRef}
        className="listing-map listing-transit-map"
        aria-label="Mapa oferty z metrem i przystankami tramwajowymi"
      />
    </FullscreenFrame>
  );
}
