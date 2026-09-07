import { ZoomablePhoto } from "./ZoomablePhoto";
import { copyText } from "../../../shared/lib/clipboard";
import type {
  CollectorRunResponse,
  DuplicateCandidate,
  ListingContactEventType,
  ListingDetail,
} from "@mieszkania/shared";
import {
  Archive,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GitCompareArrows,
  LayoutDashboard,
  NotebookPen,
  Phone,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FullscreenFrame } from "../../../shared/components/FullscreenFrame";
import {
  formatDistance,
  formatListingDateLabel,
  formatPln,
  formatViewingDate,
  toDatetimeInputValue,
} from "../../../shared/lib/format";
import { stringValue, toOptionalNumber } from "../../../shared/lib/input";
import { tabClass } from "../../../shared/lib/ui";
import { isValidMapPoint } from "../../map/lib/geometry";
import { buildOsmSearchHref } from "../../map/lib/links";
import { ListingTransitMap } from "../../map/ListingTransitMap";
import { MortgageQuickPreview } from "../../mortgage/MortgageQuickPreview";
import {
  createEmptyContactEventDraft,
  formatContactEvent,
  formatPriceEvent,
  toContactStatus,
  toDecisionStage,
} from "../lib/contact";
import { DescriptionReview } from "./AnalysisInsights";
import { ListingBadgeRow } from "./ListingBadgeRow";
import { ListingDescription } from "./ListingDescription";
import { ListingParcelCard } from "./ListingParcelCard";
import { SunExposureCompass } from "./SunExposureCompass";

export function ListingDetailPanel(input: {
  downPayment: number;
  listing: ListingDetail;
  duplicateCandidates: DuplicateCandidate[];
  onClose: () => void;
  onOpenRelatedListing: (listingId: string) => void | Promise<void>;
  onReviewDuplicate: (
    pair: DuplicateCandidate,
    status: "same_listing" | "different_listing",
  ) => void | Promise<void>;
  onToggleShortlist: (listingId: string, shortlisted: boolean) => void | Promise<void>;
  onDismiss: (listingId: string) => void | Promise<void>;
  onArchive: (listingId: string) => void | Promise<void>;
  isCompared: boolean;
  onToggleCompare: (listingId: string) => void;
  isUpdatingShortlist: boolean;
  isDismissing: boolean;
  isArchiving: boolean;
  isLoadingDuplicateCandidates: boolean;
  isReviewingDuplicatePair: string | null;
  onSaveManual: (manual: ListingDetail["manual"]) => void | Promise<void>;
  onAddContactEvent: (event: {
    eventType: ListingContactEventType;
    occurredAt: string;
    title?: string;
    notes?: string;
    contactName?: string;
    amount?: number;
  }) => void | Promise<void>;
  onScheduleViewing: (input: {
    listingId: string;
    scheduledAt: string;
    notes?: string;
  }) => void | Promise<void>;
  onDeleteViewing: (listingId: string) => void | Promise<void>;
  onBackfillMedia: (listingId: string) => void | Promise<void>;
  onRefreshFromSource: (
    listing: Pick<ListingDetail, "id" | "canonicalUrl" | "sourceLabel">,
  ) => void | Promise<void>;
  refreshConfirmation: {
    listingId: string;
    refreshedAt: Date;
    action: CollectorRunResponse["action"];
  } | null;
  isBackfillingMedia: boolean;
  isRefreshingFromSource: boolean;
  isSavingManual: boolean;
  isSavingContactEvent: boolean;
  isLoadingInsights: boolean;
  onRefreshInsights: () => void | Promise<void>;
  onAddToMortgage: (listing: ListingDetail) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeInputValue(input.listing.viewing?.scheduledAt),
  );
  const [viewingNotes, setViewingNotes] = useState(input.listing.viewing?.notes ?? "");
  const [manual, setManual] = useState<ListingDetail["manual"]>(input.listing.manual);
  const [contactEvent, setContactEvent] = useState(
    createEmptyContactEventDraft(input.listing.manual.contactName),
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(null);
  const [photoRotation, setPhotoRotation] = useState(0);
  useEffect(() => setPhotoRotation(0), [lightboxImageIndex]);
  const [isDismissConfirmOpen, setIsDismissConfirmOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<
    "overview" | "manual" | "contact" | "features"
  >("overview");
  const [linkCopyStatus, setLinkCopyStatus] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const detailPanelRef = useRef<HTMLElement | null>(null);
  const imageSwipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const didSwipeImageRef = useRef(false);
  useEffect(() => {
    setScheduledAt(toDatetimeInputValue(input.listing.viewing?.scheduledAt));
    setViewingNotes(input.listing.viewing?.notes ?? "");
    setManual(input.listing.manual);
  }, [input.listing.viewing, input.listing.manual]);
  useEffect(() => {
    setContactEvent(createEmptyContactEventDraft(input.listing.manual.contactName));
    setActiveImageIndex(0);
    setLightboxImageIndex(null);
    setIsDismissConfirmOpen(false);
    setActiveDetailTab("overview");
  }, [input.listing.id]);
  useEffect(() => {
    detailPanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [input.listing.id]);
  useEffect(() => {
    if (lightboxImageIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxImageIndex(null);
      }

      if (event.key === "ArrowLeft") {
        showPreviousLightboxImage();
      }

      if (event.key === "ArrowRight") {
        showNextLightboxImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImageIndex, input.listing.imageUrls.length]);
  const mapQuery = [input.listing.street, input.listing.district, input.listing.city, "Polska"]
    .filter(Boolean)
    .join(", ");
  const mapHref =
    input.listing.latitude && input.listing.longitude
      ? `https://www.openstreetmap.org/?mlat=${input.listing.latitude}&mlon=${input.listing.longitude}#map=16/${input.listing.latitude}/${input.listing.longitude}`
      : buildOsmSearchHref(input.listing, mapQuery);
  const activeImageUrl = input.listing.imageUrls[activeImageIndex] ?? input.listing.imageUrls[0];
  const duplicateCandidates = input.duplicateCandidates.filter(
    (candidate) =>
      candidate.left.id === input.listing.id || candidate.right.id === input.listing.id,
  );
  const maintenanceFee = input.listing.features.find((feature) => feature.key === "fees")?.value;
  const changeDetailImage = (direction: -1 | 1) => {
    setActiveImageIndex(
      (current) =>
        (current + direction + input.listing.imageUrls.length) % input.listing.imageUrls.length,
    );
  };

  function handleImagePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" || input.listing.imageUrls.length < 2) {
      return;
    }

    didSwipeImageRef.current = false;
    imageSwipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleImagePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = imageSwipeStartRef.current;
    imageSwipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    // A deliberate horizontal swipe, without stealing normal vertical page scrolling.
    if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      didSwipeImageRef.current = true;
      changeDetailImage(deltaX < 0 ? 1 : -1);
    }
  }

  return (
    <aside className="detail-overlay" onClick={input.onClose}>
      <section
        ref={detailPanelRef}
        className="detail-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-topbar">
          <button
            className="detail-close-icon"
            type="button"
            aria-label="Zamknij okno"
            title="Zamknij"
            onClick={input.onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="panel-header detail-header">
          <div>
            <p className="eyebrow">Szczegół oferty</p>
            <h2>{input.listing.title}</h2>
            <div className="listing-id-row">
              <code className="listing-record-id">ID: {input.listing.id}</code>
              <button
                className={copiedId ? "icon-button copied" : "icon-button"}
                type="button"
                title="Kopiuj ID"
                aria-label="Kopiuj ID"
                onClick={async () => {
                  try {
                    if (navigator.clipboard) await navigator.clipboard.writeText(input.listing.id);
                    else {
                      const area = document.createElement("textarea");
                      area.value = input.listing.id;
                      document.body.appendChild(area);
                      area.select();
                      document.execCommand("copy");
                      area.remove();
                    }
                    setCopiedId(true);
                    window.setTimeout(() => setCopiedId(false), 1600);
                  } catch {
                    setCopiedId(false);
                  }
                }}
              >
                {copiedId ? "✓" : <ClipboardCheck size={14} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="action-button secondary-button"
                onClick={async () => {
                  try {
                    await copyText(
                      `${window.location.origin}/oferty?listing=${encodeURIComponent(input.listing.id)}`,
                    );
                    setLinkCopyStatus("Link skopiowany");
                  } catch {
                    setLinkCopyStatus("Skopiuj adres z paska przeglądarki");
                  }
                }}
              >
                Kopiuj link
              </button>
              {linkCopyStatus && <span role="status">{linkCopyStatus}</span>}
            </div>
            <ListingBadgeRow badges={input.listing.badges} />
          </div>
          <div className="detail-actions">
            <button
              className="action-button secondary-button detail-refresh-button"
              type="button"
              onClick={() => void input.onRefreshFromSource(input.listing)}
              disabled={input.isRefreshingFromSource || !input.listing.canonicalUrl}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={input.isRefreshingFromSource ? "icon-spin" : ""}
              />{" "}
              {input.isRefreshingFromSource ? "Dociągam ofertę…" : "Dociągnij ofertę"}
            </button>
            <button
              className={
                input.listing.isShortlisted
                  ? "action-button shortlist-active"
                  : "action-button secondary-button"
              }
              onClick={() =>
                void input.onToggleShortlist(input.listing.id, !input.listing.isShortlisted)
              }
              disabled={input.isUpdatingShortlist}
            >
              <Star
                size={16}
                aria-hidden="true"
                fill={input.listing.isShortlisted ? "currentColor" : "none"}
              />{" "}
              {input.listing.isShortlisted ? "W ulubionych" : "Dodaj do ulubionych"}
            </button>
            <button
              className={
                input.isCompared
                  ? "action-button shortlist-active"
                  : "action-button secondary-button"
              }
              type="button"
              onClick={() => input.onToggleCompare(input.listing.id)}
            >
              <GitCompareArrows size={16} aria-hidden="true" />{" "}
              {input.isCompared ? "W porównaniu" : "Porównaj"}
            </button>
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => void input.onArchive(input.listing.id)}
              disabled={input.isArchiving}
            >
              <Archive size={16} aria-hidden="true" />{" "}
              {input.isArchiving ? "Oznaczanie..." : "Oznacz jako archiwalną"}
            </button>
            <button
              className="action-button danger-button"
              type="button"
              onClick={() => setIsDismissConfirmOpen(true)}
              disabled={input.isDismissing}
            >
              <Trash2 size={16} aria-hidden="true" />{" "}
              {input.isDismissing ? "Odrzucanie..." : "Odrzuć ofertę"}
            </button>
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => input.onAddToMortgage(input.listing)}
            >
              <Calculator size={16} aria-hidden="true" /> Dodaj do kalkulacji kredytowej
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-gallery">
              {activeImageUrl ? (
                <button
                  className="detail-image-button"
                  type="button"
                  onPointerDown={handleImagePointerDown}
                  onPointerUp={handleImagePointerUp}
                  onPointerCancel={() => {
                    imageSwipeStartRef.current = null;
                  }}
                  onClick={(event) => {
                    if (didSwipeImageRef.current) {
                      event.preventDefault();
                      didSwipeImageRef.current = false;
                      return;
                    }
                    setLightboxImageIndex(activeImageIndex);
                  }}
                  aria-label="Otwórz zdjęcie na pełnym ekranie. Przesuń palcem w lewo lub prawo, aby zmienić zdjęcie."
                >
                  <div
                    className="detail-image-track"
                    style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
                  >
                    {input.listing.imageUrls.map((imageUrl, index) => (
                      <img
                        key={`${input.listing.id}-${imageUrl}`}
                        className="detail-image detail-image-primary"
                        src={imageUrl}
                        alt={`${input.listing.title}, zdjęcie ${index + 1}`}
                        loading={index === 0 ? "eager" : "lazy"}
                      />
                    ))}
                  </div>
                </button>
              ) : (
                <div className="detail-image detail-image-empty">Brak zdjęć</div>
              )}
              {input.listing.imageUrls.length > 1 ? (
                <div className="detail-thumbs" role="tablist" aria-label="Miniatury zdjęć oferty">
                  {input.listing.imageUrls.map((imageUrl, index) => (
                    <button
                      key={`${input.listing.id}-${index}`}
                      type="button"
                      className={
                        index === activeImageIndex ? "detail-thumb active" : "detail-thumb"
                      }
                      onClick={() => {
                        setActiveImageIndex(index);
                      }}
                    >
                      <img
                        className="detail-thumb-image"
                        src={imageUrl}
                        alt={`${input.listing.title} miniatura ${index + 1}`}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              <SunExposureCompass description={input.listing.description} />
              {input.listing.imageUrls.length > 1 ? (
                <>
                  <button
                    className="detail-gallery-nav detail-gallery-prev"
                    type="button"
                    aria-label="Poprzednie zdjęcie"
                    onClick={() => changeDetailImage(-1)}
                  >
                    <ChevronLeft size={22} aria-hidden="true" />
                  </button>
                  <button
                    className="detail-gallery-nav detail-gallery-next"
                    type="button"
                    aria-label="Następne zdjęcie"
                    onClick={() => changeDetailImage(1)}
                  >
                    <ChevronRight size={22} aria-hidden="true" />
                  </button>
                  <div className="detail-image-dots" aria-label="Wybierz zdjęcie">
                    {input.listing.imageUrls.map((imageUrl, index) => (
                      <button
                        key={`${imageUrl}-${index}`}
                        type="button"
                        className={index === activeImageIndex ? "active" : ""}
                        aria-label={`Zdjęcie ${index + 1}`}
                        onClick={() => setActiveImageIndex(index)}
                      />
                    ))}
                  </div>
                  <span className="detail-gallery-counter">
                    {activeImageIndex + 1} / {input.listing.imageUrls.length}
                  </span>
                </>
              ) : null}
            </div>
            <MortgageQuickPreview listing={input.listing} downPayment={input.downPayment} />
            <div className="detail-section-tabs">
              <button
                className={tabClass(activeDetailTab === "overview")}
                type="button"
                onClick={() => setActiveDetailTab("overview")}
              >
                <LayoutDashboard size={16} aria-hidden="true" /> Przegląd
              </button>
              <button
                className={tabClass(activeDetailTab === "manual")}
                type="button"
                onClick={() => setActiveDetailTab("manual")}
              >
                <NotebookPen size={16} aria-hidden="true" /> Notatki
              </button>
              <button
                className={tabClass(activeDetailTab === "features")}
                type="button"
                onClick={() => setActiveDetailTab("features")}
              >
                <ClipboardCheck size={16} aria-hidden="true" /> Cechy
              </button>
            </div>
            <div
              className={
                activeDetailTab === "overview" ? "detail-tab-section" : "detail-section-hidden"
              }
            >
              <table className="listing-facts-table">
                <tbody>
                  <tr>
                    <th>Adres</th>
                    <td colSpan={3}>{input.listing.addressText ?? "Brak adresu"}</td>
                  </tr>
                  <tr>
                    <th>Okolica</th>
                    <td>
                      {input.listing.district}
                      {input.listing.neighborhood ? ` / ${input.listing.neighborhood}` : ""}
                    </td>
                    <th>Data</th>
                    <td>{formatListingDateLabel(input.listing)}</td>
                  </tr>
                  <tr>
                    <th>Cena</th>
                    <td className="fact-price">{input.listing.priceLabel}</td>
                    <th>Metraż</th>
                    <td>{input.listing.areaLabel ?? "-"}</td>
                  </tr>
                  {input.listing.additionalPurchaseCosts ? (
                    <tr>
                      <th>Dodatki do zakupu</th>
                      <td>
                        {formatPln(input.listing.additionalPurchaseCosts.total)}
                        {input.listing.additionalPurchaseCosts.garage
                          ? ` (garaż: ${formatPln(input.listing.additionalPurchaseCosts.garage)})`
                          : ""}
                        {input.listing.additionalPurchaseCosts.storage
                          ? ` (komórka: ${formatPln(input.listing.additionalPurchaseCosts.storage)})`
                          : ""}
                      </td>
                      <th>Łączna cena zakupu</th>
                      <td className="fact-price">
                        {input.listing.totalAcquisitionPrice
                          ? formatPln(input.listing.totalAcquisitionPrice)
                          : "-"}
                      </td>
                    </tr>
                  ) : null}
                  {input.listing.additionalPurchaseCosts ? (
                    <tr>
                      <th>Cena całkowita</th>
                      <td className="fact-price">
                        {input.listing.totalAcquisitionPrice
                          ? formatPln(input.listing.totalAcquisitionPrice)
                          : input.listing.priceLabel}
                      </td>
                      <th>Cena mieszkania</th>
                      <td>{input.listing.priceLabel}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <th>PLN/m2</th>
                    <td>{input.listing.pricePerSqmLabel ?? "-"}</td>
                    <th>Pokoje</th>
                    <td>{input.listing.rooms ?? "-"}</td>
                  </tr>
                  <tr>
                    <th>RCN</th>
                    <td colSpan={3}>{input.listing.rcnDeltaLabel}</td>
                  </tr>
                  <tr>
                    <th>Piętro</th>
                    <td>
                      {input.listing.floor === 0 ? "Parter" : (input.listing.floor ?? "-")} /{" "}
                      {input.listing.totalFloors ?? "-"}
                    </td>
                    <th>Czynsz</th>
                    <td>{maintenanceFee ?? "-"}</td>
                  </tr>
                  {input.listing.additionalPurchaseCosts?.garage ? (
                    <>
                      <tr>
                        <th>Rok budowy</th>
                        <td>{input.listing.yearBuilt ?? "-"}</td>
                        <th>Garaż / parking</th>
                        <td>{formatPln(input.listing.additionalPurchaseCosts.garage)}</td>
                      </tr>
                      <tr>
                        <th>Telefon</th>
                        <td colSpan={3}>
                          {manual.contactPhone ?? input.listing.sourceContactPhone ?? "Brak"}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th>Rok budowy</th>
                      <td>{input.listing.yearBuilt ?? "-"}</td>
                      <th>Telefon</th>
                      <td>{manual.contactPhone ?? input.listing.sourceContactPhone ?? "Brak"}</td>
                    </tr>
                  )}
                  <tr>
                    <th>Po rozmowie</th>
                    <td>
                      {manual.askingPriceOverride ? formatPln(manual.askingPriceOverride) : "-"}
                    </td>
                    <th>Do utargowania</th>
                    <td>
                      {manual.negotiatedPriceAmount ? formatPln(manual.negotiatedPriceAmount) : "-"}
                    </td>
                  </tr>
                  <tr className="listing-portals-row">
                    <th>Portale</th>
                    <td colSpan={3}>
                      <div className="source-links-list">
                        {input.listing.canonicalUrl ? (
                          <a href={input.listing.canonicalUrl} target="_blank" rel="noreferrer">
                            {input.listing.sourceLabel ?? "Główna oferta"}
                          </a>
                        ) : (
                          <span>Brak</span>
                        )}
                        {input.listing.relatedListings.map((related) =>
                          related.canonicalUrl ? (
                            <a
                              key={related.id}
                              href={related.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {related.sourceLabel ?? "Inny portal"}
                            </a>
                          ) : null,
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <ListingParcelCard listing={input.listing} />
              <div className="quick-contact-card">
                <div>
                  <Phone size={18} aria-hidden="true" />
                  <span>
                    <strong>Telefon do oferty</strong>
                    <small>Możesz poprawić numer bez wchodzenia w osobny moduł kontaktu.</small>
                  </span>
                </div>
                <label className="detail-field">
                  <span>Numer telefonu</span>
                  <input
                    className="text-input"
                    inputMode="tel"
                    value={manual.contactPhone ?? input.listing.sourceContactPhone ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, contactPhone: event.target.value }))
                    }
                    placeholder="np. 600 000 000"
                  />
                </label>
                <button
                  className="action-button secondary-button"
                  type="button"
                  disabled={input.isSavingManual}
                  onClick={() => void input.onSaveManual(manual)}
                >
                  {input.isSavingManual ? "Zapisuję…" : "Zapisz numer"}
                </button>
              </div>
              {maintenanceFee ? (
                <p className="muted listing-facts-hint">
                  Czynsz odczytano informacyjnie z opisu oferty (np. „czynsz administracyjny” z
                  zaliczkami). Podobne zapisy automatycznie uzupełniają tę wartość.
                </p>
              ) : null}
              <DescriptionReview
                description={input.listing.description}
                floor={input.listing.floor}
              />
              <ListingDescription value={input.listing.description} />
              <section className="subsection rcn-transactions">
                <div className="section-topline">
                  <div>
                    <h3>Transakcje RCN z tej ulicy · do 150 m</h3>
                    <p className="muted">
                      Rzeczywiste ceny transakcyjne z ostatnich 4 lat, sortowane od najbliższej
                      lokalizacji.
                    </p>
                  </div>
                </div>
                {input.listing.rcnTransactions.length > 0 ? (
                  <div className="rcn-transaction-list">
                    {input.listing.rcnTransactions.map((transaction) => (
                      <div className="rcn-transaction" key={transaction.id}>
                        <strong>
                          {transaction.areaSqm.toFixed(1)} m² · {formatPln(transaction.priceAmount)}
                        </strong>
                        <span>
                          {Math.round(transaction.pricePerSqm).toLocaleString("pl-PL")} PLN/m² ·{" "}
                          {transaction.distanceMeters} m ·{" "}
                          {transaction.marketType === "primary" ? "pierwotny" : "wtórny"}
                        </span>
                        <small>
                          {new Date(transaction.transactionDate).toLocaleDateString("pl-PL")}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Brak transakcji z ostatnich 4 lat z tej samej ulicy w promieniu 150 m. Benchmark
                    tej oferty: {input.listing.rcnDeltaLabel}.
                  </p>
                )}
              </section>
            </div>

            <section
              className={
                activeDetailTab === "manual"
                  ? "subsection detail-tab-section"
                  : "detail-section-hidden"
              }
            >
              <div className="section-topline">
                <div>
                  <h3>Wasze notatki i ustalenia</h3>
                  <p className="muted">
                    Tu zapisujesz to, co uslyszysz od posrednika albo wlasciciela.
                  </p>
                </div>
              </div>
              <div className="ops-form viewing-form">
                <fieldset className="manual-feature-corrections">
                  <legend>Korekta automatycznego odczytu</legend>
                  <p className="muted">
                    Potwierdź po rozmowie lub oglądaniu. Te wartości mają pierwszeństwo przed
                    tekstem ogłoszenia.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={manual.hasLiftOverride === true}
                      onChange={(event) =>
                        setManual((current) => ({
                          ...current,
                          hasLiftOverride: event.target.checked ? true : undefined,
                        }))
                      }
                    />{" "}
                    Jest winda
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={manual.hasGarageOverride === true}
                      onChange={(event) =>
                        setManual((current) => ({
                          ...current,
                          hasGarageOverride: event.target.checked ? true : undefined,
                        }))
                      }
                    />{" "}
                    Jest miejsce w garażu
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={manual.hasStorageOverride === true}
                      onChange={(event) =>
                        setManual((current) => ({
                          ...current,
                          hasStorageOverride: event.target.checked ? true : undefined,
                        }))
                      }
                    />{" "}
                    Jest komórka lokatorska
                  </label>
                  <label className="detail-field">
                    <span>Dopłata za garaż / parking</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={stringValue(manual.garageCostOverride)}
                      onChange={(event) =>
                        setManual((current) => ({
                          ...current,
                          garageCostOverride: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="detail-field">
                    <span>Dopłata za komórkę</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={stringValue(manual.storageCostOverride)}
                      onChange={(event) =>
                        setManual((current) => ({
                          ...current,
                          storageCostOverride: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                </fieldset>
                <label className="detail-field">
                  <span>Etap decyzji</span>
                  <select
                    className="text-input"
                    value={manual.decisionStage ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({
                        ...current,
                        decisionStage: toDecisionStage(event.target.value),
                      }))
                    }
                  >
                    <option value="">Etap decyzji</option>
                    <option value="new">Nowa oferta</option>
                    <option value="to_call">Do telefonu</option>
                    <option value="after_call">Po rozmowie</option>
                    <option value="to_viewing">Do oglądania</option>
                    <option value="after_viewing">Po oglądaniu</option>
                    <option value="to_offer">Do oferty</option>
                    <option value="rejected">Odrzucona</option>
                    <option value="bought">Kupiona</option>
                  </select>
                </label>
                <label className="detail-field">
                  <span>Status kontaktu</span>
                  <select
                    className="text-input"
                    value={manual.contactStatus ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({
                        ...current,
                        contactStatus: toContactStatus(event.target.value),
                      }))
                    }
                  >
                    <option value="">Status kontaktu</option>
                    <option value="new">Nowa</option>
                    <option value="contacted">Po kontakcie</option>
                    <option value="negotiating">W negocjacji</option>
                    <option value="viewing_scheduled">Oglądanie umówione</option>
                    <option value="rejected">Odrzucone</option>
                    <option value="closed">Zamkniete</option>
                  </select>
                </label>
                <label className="detail-field">
                  <span>Osoba kontaktowa</span>
                  <input
                    className="text-input"
                    value={manual.contactName ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, contactName: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Rola</span>
                  <input
                    className="text-input"
                    value={manual.contactRole ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, contactRole: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Telefon</span>
                  <input
                    className="text-input"
                    value={manual.contactPhone ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, contactPhone: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Ostatni kontakt</span>
                  <input
                    className="text-input"
                    type="datetime-local"
                    value={toDatetimeInputValue(manual.lastContactAt)}
                    onChange={(event) =>
                      setManual((current) => ({
                        ...current,
                        lastContactAt: event.target.value
                          ? new Date(event.target.value).toISOString()
                          : undefined,
                      }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Cena po rozmowie</span>
                  <input
                    className="text-input"
                    value={stringValue(manual.askingPriceOverride)}
                    onChange={(event) =>
                      setManual((current) => ({
                        ...current,
                        askingPriceOverride: toOptionalNumber(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Cena po negocjacji</span>
                  <input
                    className="text-input"
                    value={stringValue(manual.negotiatedPriceAmount)}
                    onChange={(event) =>
                      setManual((current) => ({
                        ...current,
                        negotiatedPriceAmount: toOptionalNumber(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Informacje od sprzedajacego</span>
                  <textarea
                    className="text-input"
                    rows={4}
                    value={manual.sourceNotes ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, sourceNotes: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Wasze notatki</span>
                  <textarea
                    className="text-input"
                    rows={5}
                    value={manual.notes ?? ""}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </label>
                <button
                  className="action-button"
                  disabled={input.isSavingManual}
                  onClick={() => void input.onSaveManual(manual)}
                >
                  {input.isSavingManual ? "Zapisywanie..." : "Zapisz notatki do oferty"}
                </button>
              </div>
            </section>

            <section
              className={
                activeDetailTab === "contact"
                  ? "subsection detail-tab-section"
                  : "detail-section-hidden"
              }
            >
              <div className="section-topline">
                <div>
                  <h3>Historia kontaktow</h3>
                  <p className="muted">
                    Kazdy telefon, wiadomosc, negocjacje i ustalenia zapisujesz jako osobne
                    zdarzenie.
                  </p>
                </div>
              </div>
              {input.listing.sourceContactPhone ? (
                <div className="result-box">
                  <strong>Kontakt z portalu</strong>
                  <p>{input.listing.sourceContactPhone}</p>
                </div>
              ) : null}
              <div className="ops-form">
                <label className="detail-field">
                  <span>Rodzaj zdarzenia</span>
                  <select
                    className="text-input"
                    value={contactEvent.eventType}
                    onChange={(event) =>
                      setContactEvent((current) => ({
                        ...current,
                        eventType: event.target.value as ListingContactEventType,
                      }))
                    }
                  >
                    <option value="call">Telefon</option>
                    <option value="message">Wiadomosc</option>
                    <option value="email">E-mail</option>
                    <option value="meeting">Spotkanie</option>
                    <option value="viewing_note">Notatka po ogladaniu</option>
                    <option value="negotiation">Negocjacje</option>
                    <option value="status_change">Zmiana statusu</option>
                    <option value="other">Inne</option>
                  </select>
                </label>
                <label className="detail-field">
                  <span>Data i godzina</span>
                  <input
                    className="text-input"
                    type="datetime-local"
                    value={contactEvent.occurredAt}
                    onChange={(event) =>
                      setContactEvent((current) => ({ ...current, occurredAt: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Osoba kontaktowa</span>
                  <input
                    className="text-input"
                    value={contactEvent.contactName}
                    onChange={(event) =>
                      setContactEvent((current) => ({
                        ...current,
                        contactName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Tytul zdarzenia</span>
                  <input
                    className="text-input"
                    value={contactEvent.title}
                    onChange={(event) =>
                      setContactEvent((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Kwota</span>
                  <input
                    className="text-input"
                    value={contactEvent.amount}
                    onChange={(event) =>
                      setContactEvent((current) => ({ ...current, amount: event.target.value }))
                    }
                  />
                </label>
                <label className="detail-field">
                  <span>Notatka</span>
                  <textarea
                    className="text-input"
                    rows={4}
                    value={contactEvent.notes}
                    onChange={(event) =>
                      setContactEvent((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </label>
                <button
                  className="action-button"
                  disabled={input.isSavingContactEvent || !contactEvent.occurredAt}
                  onClick={() => void saveContactEvent()}
                >
                  {input.isSavingContactEvent ? "Zapisywanie..." : "Dodaj zdarzenie"}
                </button>
              </div>
              <div className="result-box">
                <strong>Timeline</strong>
                {input.listing.contactHistory.length > 0 ? (
                  <ul className="result-list">
                    {input.listing.contactHistory.map((event) => (
                      <li key={event.id}>{formatContactEvent(event)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Brak zapisanej historii kontaktow.</p>
                )}
              </div>
            </section>

            <section
              className={
                activeDetailTab === "features"
                  ? "subsection detail-tab-section"
                  : "detail-section-hidden"
              }
            >
              <h3>Cechy wyciagniete z oferty</h3>
              <div className="feature-grid">
                {input.listing.features.map((feature) => (
                  <article key={`${feature.key}-${feature.value}`} className="feature-card">
                    <span>{feature.label}</span>
                    <strong>{feature.value}</strong>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div>
            <div className="result-box detail-sidebar-box">
              <strong>Oglądanie mieszkania</strong>
              {input.listing.viewing?.scheduledAt ? (
                <p className="viewing-line">
                  Aktualny termin: {formatViewingDate(input.listing.viewing.scheduledAt)}
                </p>
              ) : (
                <p className="muted">Brak umówionego oglądania.</p>
              )}
              <div className="ops-form viewing-form">
                <label className="detail-field">
                  <span>Termin</span>
                  <input
                    className="text-input"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </label>
                <label className="detail-field">
                  <span>Notatka do oglądania</span>
                  <textarea
                    className="text-input"
                    rows={3}
                    value={viewingNotes}
                    onChange={(event) => setViewingNotes(event.target.value)}
                    placeholder="Na co zwrócić uwagę?"
                  />
                </label>
                <button
                  className="action-button"
                  disabled={!scheduledAt}
                  onClick={() =>
                    void input.onScheduleViewing({
                      listingId: input.listing.id,
                      scheduledAt: new Date(scheduledAt).toISOString(),
                      notes: viewingNotes || undefined,
                    })
                  }
                >
                  Zapisz termin oglądania
                </button>
                {input.listing.viewing?.scheduledAt ? (
                  <button
                    className="action-button secondary-button"
                    onClick={() => void input.onDeleteViewing(input.listing.id)}
                  >
                    Usuń termin
                  </button>
                ) : null}
              </div>
            </div>

            {input.listing.relatedListings.length > 0 ? (
              <div className="result-box detail-sidebar-box">
                <strong>Powiązane oferty z innych portali</strong>
                <ul className="result-list">
                  {input.listing.relatedListings.map((related) => (
                    <li key={related.id}>
                      <button
                        className="map-card-title"
                        onClick={() => void input.onOpenRelatedListing(related.id)}
                      >
                        {related.sourceLabel ?? "Inny portal"}: {related.title}
                      </button>
                      {related.canonicalUrl ? (
                        <div>
                          <a
                            href={related.canonicalUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Otworz link zrodlowy
                          </a>
                        </div>
                      ) : null}
                      {related.relationNote ? (
                        <div className="muted">{related.relationNote}</div>
                      ) : null}
                      <div className="muted">
                        {related.priceLabel}
                        {related.areaLabel ? ` / ${related.areaLabel}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="result-box detail-sidebar-box">
              <strong>Potencjalne duplikaty</strong>
              {input.isLoadingDuplicateCandidates ? (
                <p className="muted">Sprawdzanie kandydatów...</p>
              ) : null}
              {!input.isLoadingDuplicateCandidates &&
              duplicateCandidates.length === 0 &&
              input.listing.relatedListings.length > 0 ? (
                <p className="muted">
                  Brak nierozstrzygniętych kandydatów. Ta oferta ma już powiązane rekordy z innych
                  portali powyżej.
                </p>
              ) : null}
              {!input.isLoadingDuplicateCandidates &&
              duplicateCandidates.length === 0 &&
              input.listing.relatedListings.length === 0 ? (
                <p className="muted">Brak nierozstrzygniętych kandydatów dla tej oferty.</p>
              ) : null}
              {duplicateCandidates.map((candidate) => {
                const counterpart =
                  candidate.left.id === input.listing.id ? candidate.right : candidate.left;
                return (
                  <div className="duplicate-candidate-card" key={candidate.pairKey}>
                    <button
                      className="map-card-title"
                      onClick={() => void input.onOpenRelatedListing(counterpart.id)}
                    >
                      {counterpart.sourceLabel ?? "Inny portal"}: {counterpart.title}
                    </button>
                    <div className="muted">
                      {counterpart.priceLabel}
                      {counterpart.areaLabel ? ` / ${counterpart.areaLabel}` : ""}
                      {counterpart.roomsLabel ? ` / ${counterpart.roomsLabel}` : ""}
                    </div>
                    <div className="muted">
                      {counterpart.addressText ??
                        `${counterpart.city}${counterpart.district ? ` / ${counterpart.district}` : ""}`}
                    </div>
                    <div className="muted">
                      Pewność: {candidate.confidenceScore}% · {candidate.reasons.join(", ")}
                    </div>
                    <div className="panel-inline-actions">
                      <button
                        className="action-button secondary-button"
                        type="button"
                        onClick={() => void input.onReviewDuplicate(candidate, "different_listing")}
                        disabled={input.isReviewingDuplicatePair === candidate.pairKey}
                      >
                        To nie duplikat
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        onClick={() => void input.onReviewDuplicate(candidate, "same_listing")}
                        disabled={input.isReviewingDuplicatePair === candidate.pairKey}
                      >
                        Zostaw tę, ukryj duplikat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="result-box detail-sidebar-box">
              <strong>Historia cen</strong>
              {input.listing.priceHistory.length > 0 ? (
                <ul className="result-list">
                  {[...input.listing.priceHistory]
                    .sort(
                      (left, right) =>
                        new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime(),
                    )
                    .map((event, index) => (
                      <li key={`${event.changedAt}-${index}`}>{formatPriceEvent(event)}</li>
                    ))}
                </ul>
              ) : (
                <p className="muted">Brak zapisanej historii zmian ceny.</p>
              )}
            </div>

            <div className="result-box detail-sidebar-box">
              <strong>Dojazdy do pracy</strong>
              {input.isLoadingInsights && input.listing.commutes.length === 0 ? (
                <p className="muted">Ładowanie dojazdów...</p>
              ) : (
                <ul className="result-list">
                  {input.listing.commutes.map((commute) => (
                    <li key={commute.key}>
                      {commute.label}:{" "}
                      {commute.durationMinutes ? `${commute.durationMinutes} min` : "brak"}
                      {commute.distanceKm ? ` / ${commute.distanceKm} km` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="result-box detail-sidebar-box">
              <strong>Okolica</strong>
              {input.isLoadingInsights ? (
                <p className="muted">Pobieram aktualne dane o okolicy...</p>
              ) : input.listing.amenityAnalysis?.status === "unavailable" ? (
                <div className="amenity-unavailable">
                  <p className="muted">
                    Publiczne serwery OpenStreetMap chwilowo nie odpowiedziały. To nie oznacza, że w
                    okolicy niczego nie ma.
                  </p>
                  <button
                    className="action-button secondary-button"
                    type="button"
                    onClick={() => void input.onRefreshInsights()}
                  >
                    <RefreshCw size={15} aria-hidden="true" /> Spróbuj ponownie
                  </button>
                </div>
              ) : input.listing.amenityAnalysis?.status === "missing_location" ? (
                <p className="muted">Do analizy okolicy potrzebna jest dokładna lokalizacja.</p>
              ) : !input.listing.amenityAnalysis && input.listing.amenities.length === 0 ? (
                <div className="amenity-unavailable">
                  <p className="muted">
                    Nie udało się jeszcze przygotować analizy okolicy dla tej oferty.
                  </p>
                  <button
                    className="action-button secondary-button"
                    type="button"
                    onClick={() => void input.onRefreshInsights()}
                  >
                    <RefreshCw size={15} aria-hidden="true" /> Pobierz analizę
                  </button>
                </div>
              ) : (
                <>
                  <div className="amenity-analysis-list">
                    {input.listing.amenities.map((amenity) => (
                      <div className="amenity-analysis-row" key={amenity.key}>
                        <div>
                          <span>{amenity.label}</span>
                          <strong>{amenity.count}</strong>
                        </div>
                        <div className="amenity-distance-bands">
                          <small>≤ 500 m: {amenity.within500m ?? 0}</small>
                          <small>≤ 1 km: {amenity.within1000m ?? 0}</small>
                        </div>
                        {amenity.nearestPlaces?.[0] ? (
                          <p>
                            {amenity.nearestPlaces[0].name} ·{" "}
                            {formatDistance(amenity.nearestPlaces[0].distanceMeters)}
                          </p>
                        ) : amenity.nearestDistanceMeters ? (
                          <p>Najbliżej · {formatDistance(amenity.nearestDistanceMeters)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {input.listing.amenityAnalysis?.plannedFacilities.length ? (
                    <div className="planned-facilities">
                      <strong>Planowane / w budowie</strong>
                      {input.listing.amenityAnalysis.plannedFacilities
                        .slice(0, 5)
                        .map((facility) => (
                          <p key={facility.osmKey}>
                            {facility.name} · {formatDistance(facility.distanceMeters)}{" "}
                            <span>
                              {facility.stage === "construction" ? "w budowie" : "propozycja"}
                            </span>
                          </p>
                        ))}
                    </div>
                  ) : null}
                  {input.listing.amenityAnalysis?.mapUrl ? (
                    <a
                      className="map-link amenity-source-link"
                      href={input.listing.amenityAnalysis.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Zobacz okolicę w OpenStreetMap
                    </a>
                  ) : null}
                  {input.listing.amenityAnalysis?.partial ? (
                    <p className="amenity-partial-note">
                      Część serwerów nie odpowiedziała — pokazujemy dostępny fragment analizy.
                      Możesz ponowić pobranie.
                    </p>
                  ) : null}
                  <p className="amenity-attribution">
                    Promień 2 km · dane © OpenStreetMap contributors
                  </p>
                </>
              )}
            </div>

            <div className="map-block detail-sidebar-box">
              {isValidMapPoint(input.listing.latitude, input.listing.longitude) ? (
                <ListingTransitMap listing={input.listing} />
              ) : (
                <div className="map-placeholder">
                  Brak geokodu, dostepny link do wyszukiwania OSM.
                </div>
              )}
              {input.listing.coordinateAccuracy === "approximate" ? (
                <p className="muted">
                  Punkt orientacyjny: brak numeru budynku albo dokladnego geokodu z portalu.
                </p>
              ) : null}
              <a className="map-link" href={mapHref} target="_blank" rel="noreferrer">
                Otworz w OpenStreetMap
              </a>
            </div>
          </div>
        </div>
        <div className="detail-footer">
          <button className="action-button secondary-button" type="button" onClick={input.onClose}>
            Zamknij
          </button>
        </div>
        {isDismissConfirmOpen ? (
          <div
            className="dismiss-confirm-backdrop"
            role="presentation"
            onClick={() => setIsDismissConfirmOpen(false)}
          >
            <section
              className="dismiss-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dismiss-confirm-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="dismiss-confirm-title">Odrzucić tę ofertę?</h3>
              <p>
                Oferta zostanie oznaczona jako usunięta. Nie usuniemy jej z bazy, ale nie pojawi się
                już na dashboardzie, mapie ani w archiwum.
              </p>
              <div className="panel-inline-actions">
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => setIsDismissConfirmOpen(false)}
                >
                  Anuluj
                </button>
                <button
                  className="action-button danger-button"
                  type="button"
                  onClick={() => void input.onDismiss(input.listing.id)}
                  disabled={input.isDismissing}
                >
                  {input.isDismissing ? "Odrzucanie..." : "Tak, odrzuć ofertę"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {lightboxImageIndex !== null ? (
          <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Podgląd zdjęcia"
            onClick={() => setLightboxImageIndex(null)}
          >
            <FullscreenFrame label="Zdjęcia oferty" className="photo-fullscreen" modal>
              <button
                className="photo-rotate"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPhotoRotation((value) => (value + 90) % 360);
                }}
                aria-label="Obróć zdjęcie o 90 stopni"
              >
                <RotateCcw size={20} />
              </button>
              <button
                className="image-lightbox-close"
                type="button"
                onClick={() => setLightboxImageIndex(null)}
                aria-label="Zamknij podgląd"
              >
                X
              </button>
              {input.listing.imageUrls.length > 1 ? (
                <button
                  className="image-lightbox-nav image-lightbox-prev"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    showPreviousLightboxImage();
                  }}
                  aria-label="Poprzednie zdjęcie"
                >
                  ‹
                </button>
              ) : null}
              <ZoomablePhoto
                key={input.listing.imageUrls[lightboxImageIndex]}
                src={input.listing.imageUrls[lightboxImageIndex]}
                alt={`${input.listing.title} zdjęcie ${lightboxImageIndex + 1}`}
                rotation={photoRotation}
                onPrevious={showPreviousLightboxImage}
                onNext={showNextLightboxImage}
              />
              {input.listing.imageUrls.length > 1 ? (
                <button
                  className="image-lightbox-nav image-lightbox-next"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    showNextLightboxImage();
                  }}
                  aria-label="Następne zdjęcie"
                >
                  ›
                </button>
              ) : null}
              <div className="image-lightbox-counter">
                {lightboxImageIndex + 1} / {input.listing.imageUrls.length}
              </div>
            </FullscreenFrame>
          </div>
        ) : null}
      </section>
    </aside>
  );

  function showPreviousLightboxImage() {
    setLightboxImageIndex((current) => {
      if (current === null || input.listing.imageUrls.length === 0) {
        return current;
      }

      const nextIndex = current - 1;
      return nextIndex < 0 ? input.listing.imageUrls.length - 1 : nextIndex;
    });
  }

  function showNextLightboxImage() {
    setLightboxImageIndex((current) => {
      if (current === null || input.listing.imageUrls.length === 0) {
        return current;
      }

      return (current + 1) % input.listing.imageUrls.length;
    });
  }

  async function saveContactEvent() {
    await input.onAddContactEvent({
      eventType: contactEvent.eventType,
      occurredAt: new Date(contactEvent.occurredAt).toISOString(),
      title: contactEvent.title.trim() || undefined,
      notes: contactEvent.notes.trim() || undefined,
      contactName: contactEvent.contactName.trim() || undefined,
      amount: toOptionalNumber(contactEvent.amount),
    });
    setContactEvent(createEmptyContactEventDraft(manual.contactName));
  }
}
