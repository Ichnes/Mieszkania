import { useRef } from "react";
import { useDialogFocus } from "../../shared/lib/use-dialog-focus";
import { LoaderCircle, X } from "lucide-react";

export function ListingLoadingDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, onClose);
  return (
    <aside
      className="detail-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="detail-panel listing-loading-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-loading-title"
      >
        <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij okno">
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
