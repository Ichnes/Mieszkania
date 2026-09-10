import type { FamilySettings } from "@mieszkania/shared";
import { useEffect, useRef, useState } from "react";
import { ensureLeafletLoaded } from "../map/lib/leaflet";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

type Workplace = FamilySettings["workplaces"][number];
type Candidate = { latitude: number; longitude: number; label: string };

export function WorkplaceEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Workplace;
  onChange: (value: Workplace) => void;
  onRemove: () => void;
}) {
  const [results, setResults] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const revision = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const hasPoint = Number.isFinite(value.latitude) && Number.isFinite(value.longitude);
  useEffect(() => {
    let cancelled = false;
    void ensureLeafletLoaded()
      .then(() => {
        if (cancelled || !container.current) return;
        const L = window.L;
        const current = latest.current.value;
        map.current = L.map(container.current, { scrollWheelZoom: false }).setView(
          [current.latitude ?? 52.23, current.longitude ?? 21.01],
          current.latitude !== undefined ? 16 : 10,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map.current);
        marker.current = L.circleMarker([current.latitude ?? 52.23, current.longitude ?? 21.01], {
          radius: 8,
          color: "#a52920",
          fillOpacity: 0.9,
        });
        if (current.latitude !== undefined && current.longitude !== undefined)
          marker.current.addTo(map.current);
        map.current.on("click", (event: any) => {
          latest.current.onChange({
            ...latest.current.value,
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });
        const observer = new ResizeObserver(() => map.current?.invalidateSize());
        observer.observe(container.current);
        map.current._workplaceObserver = observer;
      })
      .catch(() => {
        if (!cancelled)
          setMessage("Nie udało się załadować mapy. Możesz wpisać współrzędne poniżej.");
      });
    return () => {
      cancelled = true;
      revision.current++;
      map.current?._workplaceObserver?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !marker.current) return;
    if (hasPoint) {
      marker.current.setLatLng([value.latitude, value.longitude]).addTo(map.current);
      map.current.setView([value.latitude, value.longitude], 16);
    } else marker.current.remove();
  }, [value.latitude, value.longitude, hasPoint]);

  async function search() {
    const request = ++revision.current;
    setBusy(true);
    setMessage("");
    setResults([]);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/settings/workplace-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: value.address }),
      });
      const data = await response.json();
      if (request !== revision.current) return;
      if (!response.ok) throw new Error(data.message);
      setResults(data);
      setMessage(
        data.length
          ? "Wybierz pasujący adres i sprawdź punkt na mapie."
          : "Nie znaleziono adresu. Dopisz miejscowość lub wskaż punkt na mapie.",
      );
    } catch (error) {
      if (request === revision.current)
        setMessage(error instanceof Error ? error.message : "Nie udało się wyszukać adresu.");
    } finally {
      if (request === revision.current) setBusy(false);
    }
  }
  return (
    <div className="settings-workplace-card">
      <label className="field-label">
        <span>Nazwa miejsca</span>
        <input
          className="text-input"
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="Np. Moja praca"
        />
      </label>
      <label className="field-label">
        <span>Ulica, numer budynku i miejscowość</span>
        <input
          className="text-input"
          value={value.address}
          placeholder="Np. Marszałkowska 1, Warszawa"
          onChange={(e) => {
            revision.current++;
            setBusy(false);
            setResults([]);
            setMessage("");
            onChange({
              ...value,
              address: e.target.value,
              latitude: undefined,
              longitude: undefined,
            });
          }}
        />
      </label>
      <button
        type="button"
        className="action-button secondary-button"
        disabled={busy || value.address.trim().length < 5}
        onClick={() => void search()}
      >
        {busy ? "Szukam adresu…" : "Znajdź adres na mapie"}
      </button>
      {message && <p role="status">{message}</p>}
      {results.map((result, index) => (
        <button
          type="button"
          className="workplace-candidate"
          key={index}
          onClick={() => {
            onChange({ ...value, latitude: result.latitude, longitude: result.longitude });
            setResults([]);
            setMessage("Sprawdź zaznaczony punkt; kliknij mapę, aby wskazać np. wejście do biura.");
          }}
        >
          {result.label}
        </button>
      ))}
      <div className="workplace-map" ref={container} aria-label={`Mapa: ${value.label}`} />
      <small>
        Kliknij mapę, aby wskazać lub poprawić miejsce pracy. Punkt zostanie zapisany po kliknięciu
        „Zapisz ustawienia”.
      </small>
      <div className="workplace-coordinates">
        {(["latitude", "longitude"] as const).map((key) => (
          <label className="field-label" key={key}>
            <span>{key === "latitude" ? "Szerokość geogr." : "Długość geogr."}</span>
            <input
              className="text-input"
              type="number"
              step="any"
              min={key === "latitude" ? -90 : -180}
              max={key === "latitude" ? 90 : 180}
              value={value[key] ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <small role="status">
        {hasPoint
          ? "Punkt wybrany — sprawdź jego położenie na mapie."
          : "Wybierz adres z wyników albo wskaż punkt na mapie."}
      </small>
      <button type="button" className="action-button secondary-button" onClick={onRemove}>
        Usuń miejsce pracy
      </button>
    </div>
  );
}
