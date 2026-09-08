import type { ListingSummary } from "@mieszkania/shared";
import { escapeHtml } from "../../../shared/lib/text";

export function buildMapListingPreview(listing: ListingSummary) {
  const location =
    [listing.district, listing.neighborhood].filter(Boolean).join(" · ") || listing.city;
  const details = [listing.areaLabel, listing.roomsCount ? `${listing.roomsCount} pok.` : undefined]
    .filter(Boolean)
    .join(" · ");
  const image = listing.thumbnailUrl
    ? `<img class="map-offer-preview-image" src="${escapeHtml(listing.thumbnailUrl)}" alt="" loading="lazy" />`
    : `<div class="map-offer-preview-image map-offer-preview-empty">Brak zdjęcia</div>`;
  const accuracy =
    listing.coordinateAccuracy === "approximate"
      ? `<span class="map-offer-preview-accuracy">Punkt orientacyjny</span>`
      : "";
  const source = listing.sourceLabel
    ? `<span class="map-offer-preview-source">${escapeHtml(listing.sourceLabel)}</span>`
    : "";
  return `<article class="map-offer-preview">
    <div class="map-offer-preview-media">${image}${source}</div>
    <div class="map-offer-preview-body">
      <strong class="map-offer-preview-title">${escapeHtml(listing.title)}</strong>
      <span class="map-offer-preview-location">${escapeHtml(location)}</span>
      <div class="map-offer-preview-metrics"><strong>${escapeHtml(listing.priceLabel)}</strong>${details ? `<span>${escapeHtml(details)}</span>` : ""}</div>
      ${listing.priceSource === "negotiated" ? '<span class="price-origin-note">Cena po negocjacjach · w ogłoszeniu: ' + escapeHtml(listing.advertisedPriceLabel ?? "brak ceny") + "</span>" : ""}
      ${accuracy}<span class="map-offer-preview-hint">Kliknij, żeby otworzyć ofertę</span>
    </div>
  </article>`;
}

export function listingPriceAmount(priceLabel: string) {
  const digits = priceLabel.replace(/[^\d]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}
