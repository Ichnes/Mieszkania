import { useEffect, useState } from "react";
import type { DecisionReminder } from "@mieszkania/shared";
import { decisionRequest } from "./api";

export function DecisionReminders({ onOpen }: { onOpen: (id: string) => unknown }) {
  const [items, setItems] = useState<DecisionReminder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("decision-notes-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("decision-notes-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    decisionRequest<DecisionReminder[]>("/api/decision-reminders")
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <details className="panel decision-reminders">
      <summary>
        Następne kroki ({items.length}
        {items.length === 100 ? "+" : ""})
        {items.some((item) => Date.parse(item.dueAt) <= Date.now()) ? " · są zaległe terminy" : ""}
        {error ? " · błąd odczytu" : ""}
      </summary>
      <p className="muted">
        Przypomnienia w aplikacji, również dla ofert archiwalnych. Termin i wykonanie zmienisz w
        zakładce „Ustalenia” oferty.
      </p>
      {loading && <p role="status">Wczytuję terminy…</p>}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="action-button secondary-button"
        disabled={loading}
        onClick={() => setRevision((value) => value + 1)}
      >
        Odśwież terminy
      </button>
      {!loading && !error && !items.length && <p>Brak zaplanowanych czynności.</p>}
      <ul>
        {items.map((item) => (
          <li key={`${item.listingId}-${item.key}`}>
            <button
              type="button"
              className="action-button secondary-button"
              onClick={() => onOpen(item.listingId)}
            >
              {item.title}
            </button>
            <span>
              {item.answer} · {new Date(item.dueAt).toLocaleString("pl-PL")}
              {Date.parse(item.dueAt) <= Date.now() ? " · termin minął" : ""}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
