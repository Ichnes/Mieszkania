import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

export function DuplicatePreview({
  id,
  title,
  urls = [],
  sharedFromIndex,
  onOpen,
}: {
  id: string;
  title: string;
  urls?: string[];
  sharedFromIndex?: number;
  onOpen: (id: string) => void;
}) {
  const signature = urls.join("|");
  const [images, setImages] = useState(urls);
  const [sharedStart, setSharedStart] = useState(sharedFromIndex);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setImages(signature ? signature.split("|") : []);
    setIndex(0);
    setSharedStart(sharedFromIndex);
    setError("");
  }, [id, signature, sharedFromIndex]);
  async function retry() {
    setBusy(true);
    setError("");
    try {
      const existing = await apiFetch(`${apiBaseUrl}/api/listings/${id}/preview-images`);
      if (existing.ok) {
        const available = await existing.json();
        if (
          available.urls.some(
            (url: string) => !/^https?:/.test(url) && !images.slice(0, index).includes(url),
          )
        ) {
          setImages(available.urls);
          setSharedStart(available.sharedFromIndex);
          setIndex(0);
          return;
        }
      }
      const downloaded = await apiFetch(`${apiBaseUrl}/api/media/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, limit: 4 }),
      });
      if (!downloaded.ok) throw Error("Nie udało się pobrać zdjęć. Spróbuj ponownie.");
      const response = await apiFetch(`${apiBaseUrl}/api/listings/${id}/preview-images`);
      if (!response.ok) throw Error("Nie udało się odczytać zdjęć.");
      const data = await response.json();
      setImages(data.urls);
      setSharedStart(data.sharedFromIndex);
      setIndex(0);
      if (!data.urls.length)
        setError(
          "Brak zdjęć w lokalnym archiwum tej oferty. Portal mógł usunąć je wraz z ogłoszeniem.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się pobrać zdjęć.");
    } finally {
      setBusy(false);
    }
  }
  if (images[index])
    return (
      <button
        type="button"
        className="duplicate-photo-button"
        onClick={() => onOpen(id)}
        aria-label={`Otwórz ofertę: ${title}`}
      >
        <img
          key={images[index]}
          src={images[index]}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setIndex((value) => value + 1)}
        />
        {sharedStart !== undefined && index >= sharedStart && (
          <span className="duplicate-photo-shared">Zdjęcie z połączonej oferty</span>
        )}
      </button>
    );
  return (
    <div className="duplicate-preview-empty duplicate-preview-retry">
      <span>{busy ? "Pobieranie zdjęć…" : "Zdjęcie niedostępne"}</span>
      <button
        type="button"
        className="action-button secondary-button"
        disabled={busy}
        onClick={() => void retry()}
      >
        Pobierz zdjęcia
      </button>
      <button type="button" className="text-link-button" onClick={() => onOpen(id)}>
        Otwórz ofertę
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
