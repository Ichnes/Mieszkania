export const tramColor = "#55b8ea";
export const selectedTramColor = "#ff1493";

export function tramStopStyle(routes: string[], selectedRoute?: string | null) {
  return {
    radius: 4,
    className: "leaflet-tram-stop-dot",
    color: "#fff",
    weight: 1.5,
    fillColor: selectedRoute && routes.includes(selectedRoute) ? selectedTramColor : tramColor,
    fillOpacity: 0.95,
  };
}
