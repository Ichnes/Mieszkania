import { cashPurchaseEvidence } from "../lib/purchase-evidence";
import {
  getSelectedPhoto,
  selectListingPhoto,
  subscribeToPhotoChanges,
} from "../lib/gallery-position";
import type { ListingSummary } from "@mieszkania/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatPln, parseNumericLabel } from "../../../shared/lib/format";
import { calculateMortgage } from "../../mortgage/lib/mortgage-simulation";

export function ListingImageSlide({
  listing,
  downPayment,
}: {
  listing: ListingSummary;
  downPayment: number;
}) {
  const imageUrls =
    listing.imageUrls.length > 0
      ? listing.imageUrls
      : listing.thumbnailUrl
        ? [listing.thumbnailUrl]
        : [];
  const selectedPhoto = useSyncExternalStore(
    subscribeToPhotoChanges,
    () => getSelectedPhoto(listing.id),
    () => undefined,
  );
  const activeImageIndex = Math.max(0, imageUrls.indexOf(selectedPhoto ?? ""));
  const [imagesReady, setImagesReady] = useState(false);
  const [prefetchAdjacent, setPrefetchAdjacent] = useState(false);
  const [visitedImages, setVisitedImages] = useState<Set<string>>(() => new Set());
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const didSwipeRef = useRef(false);
  const activeImageUrl = imageUrls[activeImageIndex] ?? imageUrls[0];

  useEffect(() => {
    setImagesReady(false);
    setPrefetchAdjacent(false);
    setVisitedImages(new Set());
  }, [listing.id]);

  if (!activeImageUrl) {
    return null;
  }

  function selectImage(index: number) {
    selectListingPhoto(listing.id, imageUrls[index]);
  }
  const changeImage = (direction: -1 | 1) => {
    setPrefetchAdjacent(true);
    selectImage((activeImageIndex + direction + imageUrls.length) % imageUrls.length);
  };

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    setPrefetchAdjacent(true);
    if (event.pointerType === "mouse" || imageUrls.length < 2) {
      return;
    }

    didSwipeRef.current = false;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 36 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      didSwipeRef.current = true;
      event.stopPropagation();
      changeImage(deltaX < 0 ? 1 : -1);
    }
  }

  return (
    <>
      <div
        className="listing-image-track"
        style={{ transform: `translateX(-${activeImageIndex * 100}%)` }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setPrefetchAdjacent(true);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
        onClick={(event) => {
          if (didSwipeRef.current) {
            event.stopPropagation();
            didSwipeRef.current = false;
          }
        }}
      >
        {imageUrls.map((imageUrl, index) =>
          index === activeImageIndex ||
          visitedImages.has(imageUrl) ||
          (imagesReady &&
            prefetchAdjacent &&
            (index === (activeImageIndex + 1) % imageUrls.length ||
              index === (activeImageIndex - 1 + imageUrls.length) % imageUrls.length)) ? (
            <img
              key={imageUrl}
              className="listing-thumb"
              src={imageUrl}
              alt={`${listing.title}, zdjecie ${index + 1}`}
              loading={imagesReady ? "eager" : "lazy"}
              decoding="async"
              onLoad={() => {
                setImagesReady(true);
                setVisitedImages((current) =>
                  current.has(imageUrl) ? current : new Set([...current, imageUrl]),
                );
              }}
            />
          ) : (
            <div key={imageUrl} className="listing-thumb" aria-hidden="true" />
          ),
        )}
      </div>
      {imageUrls.length > 1 ? (
        <>
          <button
            className="listing-image-nav listing-image-prev"
            type="button"
            aria-label="Poprzednie zdjecie"
            onClick={(event) => {
              event.stopPropagation();
              changeImage(-1);
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            className="listing-image-nav listing-image-next"
            type="button"
            aria-label="Nastepne zdjecie"
            onClick={(event) => {
              event.stopPropagation();
              changeImage(1);
            }}
          >
            <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <div className="listing-image-dots" aria-label="Wybierz zdjecie">
            {imageUrls.map((imageUrl, index) => (
              <button
                key={imageUrl}
                className={index === activeImageIndex ? "active" : ""}
                type="button"
                aria-label={`Zdjecie ${index + 1}`}
                onClick={(event) => {
                  event.stopPropagation();
                  selectImage(index);
                }}
              />
            ))}
          </div>
          <span className="listing-image-counter">
            {activeImageIndex + 1} / {imageUrls.length}
          </span>
        </>
      ) : null}
      {(() => {
        const total = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0;
        const payment = calculateMortgage(
          Math.max(0, total - downPayment),
          5.8,
          360,
          0,
        ).basePayment;
        return total > downPayment && !cashPurchaseEvidence(listing.description) ? (
          <span className="listing-mortgage-chip">Rata: {formatPln(payment)}</span>
        ) : null;
      })()}
    </>
  );
}
