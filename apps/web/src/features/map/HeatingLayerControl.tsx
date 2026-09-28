import { useEffect, useState, type RefObject } from "react";

export const heatingWmsUrl =
  "https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu";

export function HeatingLayerControl({ mapRef, ready }: { mapRef: RefObject<any>; ready: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [ready, mapRef]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !enabled || zoom < 21 || !map || !window.L) return;
    let failed = false;
    setStatus("loading");
    const layer = window.L.tileLayer.wms(heatingWmsUrl, {
      layers: "przewod_cieplowniczy",
      format: "image/png",
      transparent: true,
      version: "1.1.1",
      minZoom: 21,
      maxZoom: 22,
      zIndex: 250,
      className: "heating-network-tile",
      attribution:
        'GESUT / <a href="https://www.geoportal.gov.pl/pl/dane/uzbrojenie-terenu-gesut/">GUGiK i powiaty</a>',
    });
    let timer: ReturnType<typeof setTimeout>;
    const loading = () => {
      failed = false;
      setStatus("loading");
      clearTimeout(timer);
      timer = setTimeout(() => {
        failed = true;
        setStatus("error");
      }, 20000);
    };
    layer.on("loading", loading);
    layer.on("tileerror", () => {
      failed = true;
      setStatus("error");
    });
    layer.on("load", () => {
      clearTimeout(timer);
      if (!failed) setStatus("loaded");
    });
    layer.addTo(map);
    return () => {
      clearTimeout(timer);
      layer.off();
      map.removeLayer(layer);
    };
  }, [ready, enabled, zoom >= 21, attempt, mapRef]);
  return (
    <div className="heating-layer-control">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Sieć ciepłownicza (GESUT)
      </label>
      {enabled && (
        <>
          {zoom < 21 ? (
            <p>
              Warstwa wymaga dużego zbliżenia. Ustaw środek mapy na budynku.{" "}
              <button
                type="button"
                className="action-button secondary-button"
                onClick={() => mapRef.current?.setZoom(21)}
              >
                Przybliż do sieci
              </button>
            </p>
          ) : (
            <p role="status">
              {status === "loading"
                ? "Ładowanie sieci…"
                : status === "error"
                  ? "Nie udało się załadować całej warstwy."
                  : "Warstwa pobrana; w tym miejscu może nie zawierać danych."}
              {status === "error" && (
                <button
                  type="button"
                  className="action-button secondary-button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Ponów warstwę
                </button>
              )}
            </p>
          )}
          <p className="muted">
            Sieci istniejące i projektowane. Przebieg przy budynku nie potwierdza jego przyłączenia.
            Brak linii nie wyklucza sieci; zakres danych zależy od powiatu.{" "}
            <a
              href="https://www.geoportal.gov.pl/pl/dane/uzbrojenie-terenu-gesut/"
              target="_blank"
              rel="noreferrer"
            >
              O danych GESUT
            </a>
          </p>
        </>
      )}
    </div>
  );
}
