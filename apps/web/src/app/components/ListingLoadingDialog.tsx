import { useEffect, useRef } from "react";
import { LoaderCircle, X } from "lucide-react";

export function ListingLoadingDialog({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return (
    <aside
      className="detail-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="detail-panel listing-loading-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-loading-title"
      >
        <button
          ref={closeButton}
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Zamknij okno"
        >
          <X size={20} />
        </button>
        <div role="status">
          <LoaderCircle className="icon-spin" size={26} />
          <h2 id="listing-loading-title">Wczytywanie oferty</h2>
          <p>Możesz zamknąć okno, aby przerwać pobieranie.</p>
        </div>
      </section>
    </aside>
  );
}
