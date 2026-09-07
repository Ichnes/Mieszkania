import { MapPin, Star } from "lucide-react";

declare global {
  interface Window {
    L?: any;
  }
}

export let leafletLoading: Promise<void> | null = null;

export let mapLocationIconHtml = "";

export const mapOfferIconHtml = { regular: "", shortlisted: "" };

export async function ensureLeafletLoaded() {
  if (window.L && mapLocationIconHtml) return;
  if (leafletLoading) return leafletLoading;
  leafletLoading = Promise.all([
    import("leaflet"),
    import("leaflet/dist/leaflet.css"),
    import("react-dom/server"),
  ])
    .then(([leaflet, , { renderToStaticMarkup }]) => {
      window.L = leaflet.default ?? leaflet;
      mapLocationIconHtml = renderToStaticMarkup(
        <MapPin size={32} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />,
      );
      for (const key of ["regular", "shortlisted"] as const) {
        mapOfferIconHtml[key] = renderToStaticMarkup(
          <span className="map-marker-icon">
            <MapPin size={30} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
            {key === "shortlisted" ? (
              <Star className="map-marker-star" size={12} fill="currentColor" aria-hidden="true" />
            ) : null}
          </span>,
        );
      }
    })
    .catch((error) => {
      leafletLoading = null;
      throw error;
    });
  return leafletLoading;
}
