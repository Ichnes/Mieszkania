import { useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import type { ListingFilters } from "@mieszkania/shared";
import type { ListingSortKey } from "../../../app/types";
import { sanitizeListingFilters } from "../../../app/session";
import {
  maxSavedSearches,
  parseSavedSearches,
  savedSearchesKey,
  type SavedSearch,
} from "../lib/saved-searches";

export function SavedSearches({
  filters,
  sort,
  pending,
  onApply,
}: {
  filters: ListingFilters;
  sort: ListingSortKey;
  pending: boolean;
  onApply: (filters: ListingFilters, sort: ListingSortKey) => void;
}) {
  const [items, setItems] = useState(() => {
    try {
      return parseSavedSearches(window.localStorage.getItem(savedSearchesKey));
    } catch {
      return [];
    }
  });
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState<SavedSearch>();
  function persist(next: SavedSearch[]) {
    try {
      window.localStorage.setItem(savedSearchesKey, JSON.stringify(next));
      setItems(next);
      setError("");
      return true;
    } catch {
      setError("Nie udało się zapisać wyszukiwań w tej przeglądarce.");
      return false;
    }
  }
  function save() {
    if (pending) return;
    const label = name.trim();
    if (!label) {
      setError("Nadaj nazwę wyszukiwaniu.");
      return;
    }
    if (
      items.some(
        (item) => item.name.toLocaleLowerCase("pl-PL") === label.toLocaleLowerCase("pl-PL"),
      )
    ) {
      setError("Wyszukiwanie o tej nazwie już istnieje. Wybierz inną nazwę.");
      return;
    }
    if (items.length >= maxSavedSearches) {
      setError("Możesz zapisać do 12 wyszukiwań. Usuń nieużywane, aby dodać kolejne.");
      return;
    }
    if (
      persist([
        ...items,
        {
          // UUID requires HTTPS; local-network installations also run over HTTP.
          id:
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: label,
          filters: sanitizeListingFilters(filters),
          sort,
        },
      ])
    ) {
      setName("");
      setDeleted(undefined);
      setNotice(`Zapisano: ${label}.`);
    }
  }
  return (
    <details className="saved-searches">
      <summary>
        <Bookmark size={16} aria-hidden="true" /> Zapisane wyszukiwania
        {items.length ? ` (${items.length})` : ""}
      </summary>
      <p className="muted">
        Wróć do swoich filtrów i kolejności ofert. Zapis dotyczy tej przeglądarki.
      </p>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="saved-search-apply"
                type="button"
                onClick={() => {
                  onApply(item.filters, item.sort);
                  setNotice(`Wybrano: ${item.name}.`);
                }}
              >
                {item.name}
              </button>
              <button
                className="saved-search-delete"
                type="button"
                aria-label={`Usuń wyszukiwanie: ${item.name}`}
                onClick={() => {
                  if (persist(items.filter((other) => other.id !== item.id))) {
                    setDeleted(item);
                    setNotice(`Usunięto: ${item.name}.`);
                  }
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label htmlFor="saved-search-name">Nazwa wyszukiwania</label>
        <input
          id="saved-search-name"
          className="text-input"
          value={name}
          maxLength={60}
          placeholder="np. Mokotów, 3 pokoje"
          onChange={(event) => setName(event.target.value)}
        />
        <button className="action-button secondary-button" type="submit" disabled={pending}>
          Zapisz aktualne wyniki
        </button>
      </form>
      {pending && (
        <p className="muted">Najpierw kliknij „Filtruj”, aby zastosować zmienione kryteria.</p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status">
          {notice}{" "}
          {deleted && items.length < maxSavedSearches && (
            <button
              className="text-link-button"
              type="button"
              onClick={() => {
                if (persist([...items, deleted])) {
                  setDeleted(undefined);
                  setNotice("Przywrócono wyszukiwanie.");
                }
              }}
            >
              Cofnij usunięcie
            </button>
          )}
        </p>
      )}
    </details>
  );
}
