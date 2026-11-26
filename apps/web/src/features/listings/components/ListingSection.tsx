import { requestFloorPlan } from "../lib/gallery-position";
import { cashPurchaseEvidence } from "../lib/purchase-evidence";
import { useState } from "react";
import {
  computeDreamEvaluation,
  type FamilySettings,
  type ListingSummary,
} from "@mieszkania/shared";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { formatOptionalPln, formatViewingDate } from "../../../shared/lib/format";
import { cardImageBadges, filterNonCommercialBadges } from "../lib/badges";
import { listingHref } from "../lib/links";
import { buildListingPrimaryLocation } from "../lib/location";
import { ListingBadgeRow } from "./ListingBadgeRow";
import { ListingImageSlide } from "./ListingImageSlide";
import { SunExposureCompass } from "./SunExposureCompass";

export function ListingSection(input: {
  sortControl: React.ReactNode;
  resultRange: string;
  mobileCount: string;
  settings: FamilySettings;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  downPayment: number;
  title: string;
  listings: ListingSummary[];
  onOpen: (listingId: string) => void | Promise<void>;
  isLoading: boolean;
}) {
  const [scoreId, setScoreId] = useState<string>();
  return (
    <section className="panel offer-list-panel">
      <div className="panel-header listing-results-header">
        <strong className="mobile-results-count">
          {input.isLoading ? "Wczytuję oferty…" : input.mobileCount}
        </strong>
        <div>
          <p className="eyebrow">Oferty</p>
          <h2>{input.title}</h2>
        </div>
        <div className="mobile-result-sort">{input.sortControl}</div>
        <div className="pill">
          {input.isLoading ? (
            <>
              <LoaderCircle size={14} className="icon-spin" aria-hidden="true" /> Odświeżam oferty
            </>
          ) : (
            input.resultRange
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
          const imageBadges = cardImageBadges(listing);
          const nonCommercialBadges = filterNonCommercialBadges(listing.badges).filter(
            (badge) => !imageBadges.includes(badge),
          );

          const scoreButton =
            typeof listing.dreamScore === "number" ? (
              <button
                type="button"
                aria-expanded={scoreId === listing.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setScoreId(scoreId === listing.id ? undefined : listing.id);
                }}
                className="listing-dream-chip"
                aria-label={`Dopasowanie: ${listing.dreamScore}%`}
              >
                <strong>{listing.dreamScore}%</strong>
                <span className="score-caption">Dopasowanie do Waszych preferencji</span>
              </button>
            ) : null;
          return (
            <article
              key={listing.id}
              className={`listing-card clickable-card${listing.isShortlisted ? " is-shortlisted" : ""}`}
              onClick={() => void input.onOpen(listing.id)}
            >
              {scoreId === listing.id &&
                (() => {
                  const { rows, coverage } = computeDreamEvaluation(
                    listing,
                    input.settings.dreamProfile,
                    input.settings.workplaces,
                    undefined,
                    input.settings.financing,
                  );
                  const known = rows
                    .filter((row) => row.dataStatus === "known")
                    .sort((a, b) => b.points - a.points);
                  const labels = (items: typeof rows) =>
                    items
                      .slice(0, 2)
                      .map((row) => row.label)
                      .join(", ") || "Brak potwierdzonych";
                  return (
                    <div role="status">
                      <div>Plusy: {labels(known.filter((row) => row.points > 0))}</div>
                      <div>Minusy: {labels(known.filter((row) => row.points < 0).reverse())}</div>
                      Niewiadome: {coverage.total - coverage.known} z {coverage.total}
                    </div>
                  );
                })()}
              {listing.thumbnailUrl ? (
                <div className="listing-thumb-wrap">
                  <div className="listing-chip-stack">
                    {imageBadges.length > 0 ? (
                      <div className="listing-image-badges">
                        {imageBadges.map((badge) =>
                          badge === "Tylko gotówka" ? (
                            <a
                              key={badge}
                              className="listing-image-badge"
                              href={listingHref(listing.id).split("#")[0] + "#zakup-za-gotowke"}
                              onClick={(event) => event.stopPropagation()}
                              aria-label="Według ogłoszenia: zakup za gotówkę. Przejdź do opisu"
                            >
                              {badge}
                            </a>
                          ) : (
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
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                  {typeof listing.dreamScore === "number" || listing.aiAssessment ? (
                    <div className="listing-bottom-left-stack">
                      {scoreButton}
                      {listing.aiAssessment && (
                        <span
                          className="listing-ai-chip"
                          aria-label={`Ocena AI: ${listing.aiAssessment.score ?? "brak danych"} na 100`}
                          title={`Ocena AI · Pokrycie ${listing.aiAssessment.coverage}% · ${new Date(listing.aiAssessment.evaluatedAt).toLocaleDateString("pl-PL")}`}
                        >
                          <small>AI</small>
                          <strong>{listing.aiAssessment.score ?? "—"}</strong>
                        </span>
                      )}
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
                    {listing.isActive === false && (
                      <span
                        className="listing-status-chip is-inactive"
                        aria-label="Oferta nieaktywna"
                      >
                        ✕
                      </span>
                    )}
                  </div>
                  <ListingImageSlide listing={listing} downPayment={input.downPayment} />
                  {listing.sourceLabel ? (
                    <span className="listing-source-chip listing-source-chip-footer">
                      {listing.sourceLabel}
                    </span>
                  ) : null}
                  <SunExposureCompass
                    description={listing.description}
                    directionsOverride={listing.exposureDirectionsOverride}
                    compact
                  />
                </div>
              ) : (
                <div className="listing-thumb-wrap listing-photo-empty">
                  Brak zdjęć {scoreButton}
                </div>
              )}
              <div className="listing-card-content">
                <div className="listing-card-heading">
                  {!listing.thumbnailUrl && listing.aiAssessment && (
                    <span className="listing-ai-inline">
                      Ocena AI: {listing.aiAssessment.score ?? "brak danych"}/100
                    </span>
                  )}
                  <div className="listing-topline">
                    <span>{listing.city}</span>
                    <span
                      className={
                        listing.priceChangePercent > 0
                          ? "badge-rise"
                          : listing.priceChangePercent < 0
                            ? "badge-drop"
                            : "badge-flat"
                      }
                    >
                      {listing.priceChangePercent > 0 ? "+" : ""}
                      {listing.priceChangePercent}%
                    </span>
                  </div>
                  <h3>
                    {listing.isActive === false && (
                      <span className="archived-listing-label">Archiwalna</span>
                    )}
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
                  <p className="listing-location-line">
                    <span className="desktop-location">{buildListingPrimaryLocation(listing)}</span>
                    <span className="mobile-location">
                      {[listing.district, listing.neighborhood, listing.street]
                        .filter(Boolean)
                        .join(" · ") || listing.city}
                    </span>
                  </p>
                  {listing.viewingScheduledAt ? (
                    <p className="viewing-line">
                      Oglądanie: {formatViewingDate(listing.viewingScheduledAt)}
                    </p>
                  ) : null}
                  {!listing.thumbnailUrl && cashPurchaseEvidence(listing.description) && (
                    <a
                      className="listing-image-badge"
                      href={listingHref(listing.id).split("#")[0] + "#zakup-za-gotowke"}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Tylko gotówka
                    </a>
                  )}
                </div>
                <dl>
                  <div className="listing-metric metric-price">
                    <dt>
                      {listing.priceSource === "negotiated" ? "Cena po negocjacjach" : "Cena"}
                    </dt>
                    <dd>{listing.priceLabel}</dd>
                  </div>
                  <div className="listing-metric metric-area metric-split metric-area-year">
                    <div>
                      <dt>Metraż</dt>
                      <dd>{listing.areaLabel.replace(/m2$/, "m²")}</dd>
                    </div>
                    <div>
                      <dt>Rok budowy</dt>
                      <dd>{listing.yearBuilt ?? "—"}</dd>
                    </div>
                  </div>
                  <div className="listing-metric metric-pps">
                    <dt>Cena za m²</dt>
                    <dd>{listing.pricePerSqmLabel ?? "-"}</dd>
                  </div>
                  <div className="listing-metric metric-rooms metric-split metric-rooms-floor">
                    <div>
                      <dt>Pokoje</dt>
                      <dd>{listing.roomsCount ? String(listing.roomsCount) : "-"}</dd>
                    </div>
                    <div>
                      <dt>Piętro</dt>
                      <dd>
                        {listing.floor ?? "—"}
                        {listing.floor != null && listing.totalFloors != null
                          ? ` / ${listing.totalFloors}`
                          : ""}
                      </dd>
                    </div>
                  </div>
                </dl>
                <div className="listing-card-footer">
                  <div className="mobile-card-meta">
                    {!listing.badges.includes("Brak windy") && (
                      <span>
                        {listing.amenityEvidence?.lift === true || listing.hasLift
                          ? "Winda"
                          : "Winda do potwierdzenia"}
                      </span>
                    )}
                    {listing.sourceLabel && <span>{listing.sourceLabel}</span>}
                  </div>
                  {listing.floorPlanImageUrls?.length ? (
                    <a
                      href={listingHref(listing.id).split("#")[0] + "#rzut"}
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        requestFloorPlan(listing.id);
                        void input.onOpen(listing.id);
                      }}
                    >
                      Zobacz rzut
                    </a>
                  ) : null}
                  {listing.priceSource === "negotiated" ? (
                    <p className="price-origin-note">
                      W ogłoszeniu: {listing.advertisedPriceLabel ?? "brak ceny"}
                    </p>
                  ) : null}
                  <ListingBadgeRow badges={nonCommercialBadges} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
