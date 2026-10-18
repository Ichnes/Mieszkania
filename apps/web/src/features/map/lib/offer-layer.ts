import type { ListingSummary } from "@mieszkania/shared";
import { mapOfferIconHtml } from "./leaflet";
import { buildMapListingPreview } from "./previews";

// World-pixel cells stay stable while panning. Only the padded viewport gets DOM markers.
export function groupMapOffers<T>(
  items: T[],
  project: (item: T) => { x: number; y: number },
  size = 52,
) {
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const point = project(item);
    const key = `${Math.floor(point.x / size)}:${Math.floor(point.y / size)}`;
    const cell = cells.get(key) ?? [];
    cell.push(item);
    cells.set(key, cell);
  }
  return cells;
}

export function attachOfferLayer(
  map: any,
  listings: ListingSummary[],
  onOpen: (id: string) => void,
  apiBaseUrl = "",
) {
  const L = window.L;
  const layer = L.layerGroup().addTo(map);
  let frame = 0;
  const render = () => {
    layer.clearLayers();
    const bounds = map.getBounds().pad(0.2);
    const visible = listings.filter((item) => bounds.contains([item.latitude, item.longitude]));
    const groups = groupMapOffers(visible, (item) =>
      map.project([item.latitude, item.longitude], map.getZoom()),
    );
    for (const members of groups.values()) {
      if (members.length > 1) {
        const center = L.latLngBounds(
          members.map((item) => [item.latitude, item.longitude]),
        ).getCenter();
        const marker = L.marker(center, {
          title: `Grupa: ${members.length} ofert — kliknij, aby przybliżyć`,
          icon: L.divIcon({
            className: "leaflet-offer-cluster",
            html: String(members.length),
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        });
        marker.on("click", () => {
          const memberBounds = L.latLngBounds(
            members.map((item) => [item.latitude, item.longitude]),
          );
          if (map.getZoom() < map.getMaxZoom()) {
            map.fitBounds(memberBounds, {
              padding: [45, 45],
              maxZoom: Math.min(map.getZoom() + 2, map.getMaxZoom()),
            });
          } else {
            // Several adverts can share one building. Keep each selectable at maximum zoom.
            const content = document.createElement("div");
            content.className = "map-cluster-offers";
            for (const item of members) {
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = `${item.priceLabel} · ${item.title}`;
              button.addEventListener("click", () => onOpen(item.id));
              content.append(button);
            }
            marker.bindPopup(content, { maxWidth: 320 }).openPopup();
          }
        });
        marker.addTo(layer);
        continue;
      }
      const item = members[0];
      const color =
        item.priceChangePercent < 0 ? "down" : item.priceChangePercent > 0 ? "up" : "default";
      const marker = L.marker([item.latitude, item.longitude], {
        title: item.title,
        icon: L.divIcon({
          className: `${color === "default" ? "leaflet-default-marker" : `leaflet-price-${color}-marker`}${item.isShortlisted ? " is-shortlisted" : ""}`,
          html: item.isShortlisted ? mapOfferIconHtml.shortlisted : mapOfferIconHtml.regular,
          iconSize: [30, 38],
          iconAnchor: [15, 38],
        }),
      });
      marker.on("click", () => onOpen(item.id));
      let closeTimer: ReturnType<typeof setTimeout>;
      const keepPreviewOpen = () => clearTimeout(closeTimer);
      const closePreview = () => {
        keepPreviewOpen();
        closeTimer = setTimeout(() => marker.closeTooltip(), 250);
      };
      marker.bindTooltip(
        (() => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-offer-preview-link";
          button.innerHTML = buildMapListingPreview(item, apiBaseUrl);
          L.DomEvent.disableClickPropagation(button);
          button.addEventListener("mouseenter", keepPreviewOpen);
          button.addEventListener("mouseleave", closePreview);
          button.addEventListener("focus", keepPreviewOpen);
          button.addEventListener("blur", closePreview);
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            onOpen(item.id);
          });
          return button;
        })(),
        {
          className: "listing-map-tooltip",
          direction: "top",
          offset: [0, -28],
          opacity: 1,
          interactive: true,
        },
      );
      // Allow the pointer to cross the gap between the pin and its preview.
      marker.off("mouseout", marker.closeTooltip);
      marker.on("mouseout", closePreview);
      marker.off("mouseover");
      marker.on("mouseover", () => {
        keepPreviewOpen();
        if (!marker.isTooltipOpen()) marker.openTooltip();
      });
      marker.on("remove", keepPreviewOpen);
      marker.addTo(layer);
      marker.getElement()?.addEventListener(
        "blur",
        (event: FocusEvent) => {
          if (marker.getTooltip().getElement()?.contains(event.relatedTarget)) {
            event.stopImmediatePropagation();
          }
        },
        true,
      );
    }
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  };
  map.on("moveend zoomend", schedule);
  render();
  return () => {
    cancelAnimationFrame(frame);
    map.off("moveend zoomend", schedule);
    map.removeLayer(layer);
  };
}
