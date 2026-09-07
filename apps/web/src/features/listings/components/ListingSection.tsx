import type { ListingSummary } from "@mieszkania/shared";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { formatOptionalPln, formatViewingDate } from "../../../shared/lib/format";
import {
  filterCommercialBadges,
  filterImageBadges,
  filterNonCommercialBadges,
  getRcnIndicator,
} from "../lib/badges";
import { listingHref } from "../lib/links";
import { buildListingPrimaryLocation } from "../lib/location";
import { ListingBadgeRow } from "./ListingBadgeRow";
import { ListingImageSlide } from "./ListingImageSlide";
import { SunExposureCompass } from "./SunExposureCompass";

export function ListingSection(input: {
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  title: string;
  listings: ListingSummary[];
  onOpen: (listingId: string) => void | Promise<void>;
  onToggleShortlist: (listingId: string, shortlisted: boolean) => void | Promise<void>;
  updatingShortlistId: string | null;
  isLoading: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Oferty</p>
          <h2>{input.title}</h2>
        </div>
        <div className="pill">
          {input.isLoading ? (
            <>
              <LoaderCircle size={14} className="icon-spin" aria-hidden="true" /> Odświeżam oferty
            </>
          ) : (
            `${input.listings.length} rekordow`
          )}
        </div>
      </div>
      <div
        className={input.isLoading ? "listing-grid is-loading" : "listing-grid"}
        aria-busy={input.isLoading}
      >
        {input.isLoading ? (
          <div className="listing-loading-overlay">
            <LoaderCircle size={28} className="icon-spin" aria-hidden="true" />
            <span>Ładowanie wyników…</span>
          </div>
        ) : null}
        {input.listings.map((listing) => {
          const commercialBadges = filterCommercialBadges(listing.badges);
          const imageBadges = filterImageBadges(listing.badges);
          const nonCommercialBadges = filterNonCommercialBadges(listing.badges);
          const rcnIndicator = getRcnIndicator(listing.rcnDeltaLabel);

          return (
            <article
              key={listing.id}
              className="listing-card clickable-card"
              onClick={() => void input.onOpen(listing.id)}
            >
              <button
                className={listing.isShortlisted ? "favorite-star active" : "favorite-star"}
                aria-label={listing.isShortlisted ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                onClick={(event) => {
                  event.stopPropagation();
                  void input.onToggleShortlist(listing.id, !listing.isShortlisted);
                }}
                disabled={input.updatingShortlistId === listing.id}
              >
                {listing.isShortlisted ? "★" : "☆"}
              </button>
              {listing.thumbnailUrl ? (
                <div className="listing-thumb-wrap">
                  <div className="listing-chip-stack">
                    {imageBadges.length > 0 ? (
                      <div className="listing-image-badges">
                        {imageBadges.map((badge) => (
                          <span
                            key={`${listing.id}-${badge}`}
                            className="listing-image-badge"
                            title={
                              badge === "Brak miejsca postojowego"
                                ? "Oferta nie potwierdza miejsca postojowego dostępnego dla mieszkania."
                                : undefined
                            }
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {typeof listing.dreamScore === "number" ? (
                    <div className="listing-bottom-left-stack">
                      {typeof listing.dreamScore === "number" ? (
                        <span
                          className="listing-dream-chip"
                          aria-label={`Dopasowanie: ${listing.dreamScore}%`}
                        >
                          <strong>{listing.dreamScore}%</strong>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="listing-status-group">
                    {listing.relisting ? (
                      <span
                        className={`listing-relisting-chip is-${listing.relisting.priceChange}`}
                        title={`Oferta wystawiona ponownie: ${formatOptionalPln(listing.relisting.previousPriceAmount)} → ${formatOptionalPln(listing.relisting.relistedPriceAmount)}`}
                        aria-label={`Oferta wystawiona ponownie; cena ${listing.relisting.priceChange === "higher" ? "wyższa" : listing.relisting.priceChange === "lower" ? "niższa" : "bez zmian"}`}
                      >
                        <RefreshCw size={17} aria-hidden="true" />
                      </span>
                    ) : null}
                    {rcnIndicator ? (
                      <span
                        className={`listing-rcn-chip ${rcnIndicator}`}
                        title={listing.rcnDeltaLabel}
                      >
                        RCN
                      </span>
                    ) : null}
                    {Math.abs(listing.priceChangePercent) > 0 ? (
                      <span
                        className={
                          listing.priceChangePercent < 0
                            ? "listing-price-update-chip price-down"
                            : "listing-price-update-chip price-up"
                        }
                      >
                        Nowa cena
                      </span>
                    ) : null}
                    <span
                      className={
                        listing.isActive === false
                          ? "listing-status-chip is-inactive"
                          : "listing-status-chip is-active"
                      }
                      aria-label={
                        listing.isActive === false ? "Oferta nieaktywna" : "Oferta aktywna"
                      }
                    >
                      {listing.isActive === false ? "✕" : "✓"}
                    </span>
                  </div>
                  <ListingImageSlide listing={listing} />
                  {listing.sourceLabel ? (
                    <span className="listing-source-chip listing-source-chip-footer">
                      {listing.sourceLabel}
                    </span>
                  ) : null}
                  <SunExposureCompass description={listing.description} compact />
                </div>
              ) : null}
              <div className="listing-card-content">
                <div className="listing-topline">
                  <span>{listing.city}</span>
                  <span className={listing.priceChangePercent < 0 ? "badge-drop" : "badge-flat"}>
                    {listing.priceChangePercent}%
                  </span>
                </div>
                <h3>
                  <a
                    className="listing-detail-link"
                    href={listingHref(listing.id)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void input.onOpen(listing.id);
                    }}
                  >
                    {listing.title}
                  </a>
                </h3>
                <p className="listing-location-line">{buildListingPrimaryLocation(listing)}</p>
                {listing.viewingScheduledAt ? (
                  <p className="viewing-line">
                    Oglądanie: {formatViewingDate(listing.viewingScheduledAt)}
                  </p>
                ) : null}
                <dl>
                  <div className="listing-metric metric-price">
                    <dt>Cena</dt>
                    <dd>{listing.priceLabel}</dd>
                  </div>
                  <div className="listing-metric metric-area">
                    <dt>Metraż</dt>
                    <dd>{listing.areaLabel}</dd>
                  </div>
                  <div className="listing-metric metric-pps">
                    <dt>PLN/m²</dt>
                    <dd>{listing.pricePerSqmLabel ?? "-"}</dd>
                  </div>
                  <div className="listing-metric metric-rooms">
                    <dt>Pokoje</dt>
                    <dd>{listing.roomsCount ? String(listing.roomsCount) : "-"}</dd>
                  </div>
                </dl>
                <ListingBadgeRow badges={nonCommercialBadges} />
                <button
                  type="button"
                  className="listing-compare-action"
                  aria-pressed={input.compareIds.includes(listing.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    input.onToggleCompare(listing.id);
                  }}
                >
                  {input.compareIds.includes(listing.id) ? "W porównaniu · usuń" : "Porównaj"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
