import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

export function DuplicatePreview({
  id,
  title,
  urls = [],
  onOpen,
}: {
  id: string;
  title: string;
  urls?: string[];
  onOpen: (id: string) => void;
}) {
  const signature = urls.join("|");
  const [images, setImages] = useState(urls);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setImages(signature ? signature.split("|") : []);
    setIndex(0);
    setError("");
  }, [id, signature]);
  async function retry() {
    setBusy(true);
    setError("");
    try {
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
      setIndex(0);
      if (!data.urls.length)
        setError("Brak zapisanych adresów zdjęć. Otwórz ofertę i wybierz „Pobierz dane”.");
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
