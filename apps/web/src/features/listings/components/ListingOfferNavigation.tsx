import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import type { OfferStep } from "../lib/offer-navigation";

export type OfferNavigation = {
  previous: OfferStep | null;
  next: OfferStep | null;
  position: string;
  busy: boolean;
  error: string | null;
};
export function ListingOfferNavigation({
  navigation,
  onNavigate,
  suspended,
}: {
  navigation: OfferNavigation;
  onNavigate: (direction: -1 | 1) => void;
  suspended: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        suspended ||
        navigation.busy ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="slider"], .leaflet-container, [role="dialog"]',
        )
      )
        return;
      const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : null;
      if (direction && (direction === -1 ? navigation.previous : navigation.next)) {
        event.preventDefault();
        onNavigate(direction);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigation, onNavigate, suspended]);
  if (suspended) return null;
  return (
    <nav
      className="offer-navigation"
      aria-label="Przeglądanie ofert"
      onClick={(event) => event.stopPropagation()}
    >
      {([-1, 1] as const).map((direction) => {
        const step = direction === -1 ? navigation.previous : navigation.next;
        const label = step?.label ?? (direction === -1 ? "Początek wyników" : "Koniec wyników");
        return (
          <button
            key={direction}
            type="button"
            className={`offer-navigation-button ${direction === -1 ? "previous" : "next"}${step?.edge ? " page-boundary" : ""}`}
            aria-label={label}
            title={label}
            disabled={!step || navigation.busy}
            onClick={() => onNavigate(direction)}
          >
            {direction === -1 ? (
              <ChevronLeft size={24} aria-hidden="true" />
            ) : (
              <ChevronRight size={24} aria-hidden="true" />
            )}
            <span>
              {step?.edge
                ? direction === -1
                  ? "Poprzednia strona"
                  : "Następna strona"
                : direction === -1
                  ? "Poprzednia"
                  : "Następna"}
            </span>
            {step?.edge && (
              <small>{direction === -1 ? "Ostatnia oferta" : "Pierwsza oferta"}</small>
            )}
          </button>
        );
      })}
      <div className="offer-navigation-position" role="status">
        {navigation.busy ? (
          <>
            <LoaderCircle size={14} className="spin" aria-hidden="true" /> Wczytywanie…
          </>
        ) : (
          navigation.position
        )}
      </div>
      {navigation.error && (
        <p className="offer-navigation-error" role="alert">
          {navigation.error}
        </p>
      )}
    </nav>
  );
}
