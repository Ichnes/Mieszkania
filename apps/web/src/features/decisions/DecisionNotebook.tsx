import { useEffect, useState } from "react";
import type { DecisionNote, ListingDetail } from "@mieszkania/shared";
import { decisionRequest } from "./api";
import { emptyNote, factNotes, mergeNotes, viewingQuestions } from "./questions";

export function DecisionNotebook({
  listingId,
  listing,
  factsOnly = false,
}: {
  listingId: string;
  listing?: ListingDetail;
  factsOnly?: boolean;
}) {
  const [saved, setSaved] = useState<DecisionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSaved([]);
    decisionRequest<DecisionNote[]>(`/api/listings/${listingId}/decision-notes`)
      .then((notes) => {
        if (active) setSaved(notes);
      })
      .catch((error) => {
        if (active) setError(String(error.message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [listingId, revision]);
  const suggestions = factsOnly
    ? factNotes()
    : [
        ...(listing ? viewingQuestions(listing) : []),
        emptyNote("next-contact", "action", "Następny krok"),
        ...factNotes(),
      ];
  const notes = mergeNotes(suggestions, saved).filter((note) => !factsOnly || note.kind === "fact");
  return (
    <section className="decision-notebook" aria-label="Ustalenia i pytania">
      <h3>{factsOnly ? "Rozstrzygnięcia rozbieżności" : "Pytania, ustalenia i następny krok"}</h3>
      <p className="muted">
        Zapisuj odpowiedź, źródło i datę. Ustalenia pozostają przy tej ofercie; nie zmieniają
        automatycznie danych portali, rankingu ani historii scaleń.
      </p>
      {loading ? (
        <p role="status">Wczytuję zapisane ustalenia…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Ponów odczyt
          </button>
        </div>
      ) : (
        <>
          <p role="status">
            Zapisane: {saved.filter((note) => !factsOnly || note.kind === "fact").length}.
            Potwierdzone lub wykonane: {notes.filter((note) => note.done).length}.
          </p>
          {notes.map((note) => (
            <NoteEditor
              key={`${listingId}-${note.key}-${revision}`}
              note={note}
              listingId={listingId}
              onSaved={(updated) => {
                setSaved((current) => mergeNotes(current, [updated]));
                window.dispatchEvent(new Event("decision-notes-changed"));
              }}
              onReload={() => setRevision((value) => value + 1)}
            />
          ))}
        </>
      )}
    </section>
  );
}

function NoteEditor({
  note,
  listingId,
  onSaved,
  onReload,
}: {
  note: DecisionNote;
  listingId: string;
  onSaved: (note: DecisionNote) => void;
  onReload: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const action = note.kind === "action";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const updated = await decisionRequest<DecisionNote>(
        `/api/listings/${listingId}/decision-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      setDraft(updated);
      onSaved(updated);
      setMessage("Zapisano ustalenie.");
    } catch (error) {
      setError(true);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="decision-note">
      <summary>
        {note.done ? "✓ " : "○ "}
        {note.label}
        {note.version > 0 ? " · zapisane" : " · do uzupełnienia"}
      </summary>
      <form onSubmit={save} className="decision-form">
        <label>
          {action ? "Co zrobić?" : "Odpowiedź / poprawna wartość"}
          <textarea
            maxLength={4000}
            value={draft.answer}
            required={action || draft.done}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
          />
        </label>
        {action ? (
          <label>
            Termin
            <input
              type="datetime-local"
              required
              value={localDate(draft.dueAt)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  dueAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                })
              }
            />
          </label>
        ) : (
          <>
            <label>
              Źródło ustalenia (osoba, dokument lub link)
              <textarea
                maxLength={4000}
                required={draft.done}
                value={draft.evidence}
                onChange={(e) => setDraft({ ...draft, evidence: e.target.value })}
              />
            </label>
            <label>
              Data ustalenia
              <input
                type="date"
                required={draft.done}
                value={draft.checkedAt.slice(0, 10)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    checkedAt: e.target.value ? `${e.target.value}T12:00:00.000Z` : "",
                  })
                }
              />
            </label>
          </>
        )}
        <label className="decision-checkbox">
          <input
            type="checkbox"
            checked={draft.done}
            onChange={(e) => setDraft({ ...draft, done: e.target.checked })}
          />
          {action ? "Wykonane / anulowane" : "Potwierdzone na podstawie źródła"}
        </label>
        <button className="action-button" type="submit" disabled={busy}>
          {busy ? "Zapisuję…" : "Zapisz"}
        </button>
        {message && <p role={error ? "alert" : "status"}>{message}</p>}
        {error && (
          <button type="button" className="action-button secondary-button" onClick={onReload}>
            Wczytaj zapisane dane ponownie
          </button>
        )}
      </form>
    </details>
  );
}

function localDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
