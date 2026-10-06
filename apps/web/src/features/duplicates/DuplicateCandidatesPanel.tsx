import { useEffect, useState } from "react";
import type { DuplicateCandidate, DuplicateCandidatesResponse } from "@mieszkania/shared";
import { Select } from "../../components/Select";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";
import { DuplicatePreview } from "./DuplicatePreview";

export function DuplicateCandidatesPanel({
  onOpen,
  onChanged,
}: {
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [range, setRange] = useState("low");
  const [sort, setSort] = useState("confidence_asc");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<DuplicateCandidatesResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      limit: "20",
      offset: String((page - 1) * 20),
      minConfidence: range === "high" ? "80" : "60",
      maxConfidence: range === "low" ? "79" : "100",
      sort,
    });
    void apiFetch(`${apiBaseUrl}/api/duplicates/candidates?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("Nie udało się pobrać potencjalnych powiązań.");
        const next = await response.json();
        if (!controller.signal.aborted) setData(next);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, sort, page, revision]);
  async function review(pair: DuplicateCandidate, status: "same_listing" | "different_listing") {
    setBusy(pair.pairKey);
    setError("");
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/duplicates/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftId: pair.left.id,
          rightId: pair.right.id,
          status,
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw Error(failure?.message ?? "Nie udało się zapisać decyzji. Spróbuj ponownie.");
      }
      setNotice(
        status === "same_listing"
          ? "Połączono duplikaty. Zdjęcia i źródła znajdziesz w połączonej ofercie."
          : "Odrzucono powiązanie. Ta para nie będzie proponowana ponownie.",
      );
      setPage(1);
      setRevision((v) => v + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu.");
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <section className="duplicate-candidates-page">
      <div className="panel">
        <h2>Potencjalne powiązania</h2>
        <p className="muted">
          To propozycje do sprawdzenia, a nie połączone oferty. Wynik opisuje podobieństwo danych.
          Kolejność i zakres obejmują całą kolejkę, także oferty archiwalne.
        </p>
        <div className="duplicate-toolbar">
          <label>
            <span>Podobieństwo</span>
            <Select
              label="Podobieństwo"
              value={range}
              onChange={(v) => {
                setRange(v);
                setPage(1);
              }}
            >
              <option value="low">Niższe: 60–79%</option>
              <option value="high">Wyższe: 80–100%</option>
              <option value="all">Wszystkie: 60–100%</option>
            </Select>
          </label>
          <label>
            <span>Kolejność propozycji</span>
            <Select
              label="Kolejność propozycji"
              value={sort}
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            >
              <option value="confidence_asc">Najniższe podobieństwo</option>
              <option value="confidence_desc">Najwyższe podobieństwo</option>
              <option value="related_desc">Najwięcej powiązanych ofert</option>
            </Select>
          </label>
          <button
            type="button"
            className="action-button secondary-button"
            disabled={loading || Boolean(busy)}
            onClick={() => setRevision((v) => v + 1)}
          >
            Odśwież propozycje
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Wczytywanie propozycji…</p>
        ) : (
          <p className="muted">{data?.total ?? 0} par w wybranym zakresie.</p>
        )}
      </div>
      {!loading &&
        data?.items.map((pair) => (
          <article className="panel duplicate-review-v2" key={pair.pairKey}>
            <div className="section-topline">
              <h3>Podobieństwo {pair.confidenceScore}%</h3>
              <span className="pill">
                {(pair.left.relatedCount ?? 0) + (pair.right.relatedCount ?? 0) + 2} ogłoszeń z
                powiązaniami
              </span>
            </div>
            <p className="muted">{pair.reasons.join(" · ")}</p>
            <div className="duplicate-member-grid">
              {[pair.left, pair.right].map((offer) => (
                <div className="duplicate-review-member" key={offer.id}>
                  <div className="duplicate-photo-frame">
                    <span className="duplicate-source-tag">{offer.sourceLabel}</span>
                    <DuplicatePreview
                      id={offer.id}
                      title={offer.title}
                      urls={offer.thumbnailUrls ?? []}
                      sharedFromIndex={offer.thumbnailSharedFromIndex}
                      onOpen={onOpen}
                    />
                  </div>
                  <div className="duplicate-member-content">
                    <h4>{offer.title}</h4>
                    <p>
                      {offer.priceLabel} · {offer.areaLabel}
                    </p>
                    <p className="muted">{offer.addressText}</p>
                    <button
                      className="action-button secondary-button"
                      type="button"
                      onClick={() => onOpen(offer.id)}
                    >
                      Otwórz i porównaj
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="panel-inline-actions">
              <button
                type="button"
                className="action-button secondary-button"
                disabled={Boolean(busy)}
                onClick={() => void review(pair, "different_listing")}
              >
                {busy === pair.pairKey ? "Zapisywanie…" : "To inne mieszkania"}
              </button>
              <button
                type="button"
                className="action-button"
                disabled={Boolean(busy)}
                onClick={() => void review(pair, "same_listing")}
              >
                {busy === pair.pairKey ? "Zapisywanie…" : "Połącz duplikaty"}
              </button>
            </div>
          </article>
        ))}
      {!loading && data && data.total > 20 && (
        <div className="panel pagination-row">
          <button
            className="action-button secondary-button"
            disabled={page === 1 || Boolean(busy)}
            onClick={() => setPage((v) => v - 1)}
          >
            Poprzednia
          </button>
          <span>
            Strona {page} z {Math.ceil(data.total / 20)}
          </span>
          <button
            className="action-button secondary-button"
            disabled={page * 20 >= data.total || Boolean(busy)}
            onClick={() => setPage((v) => v + 1)}
          >
            Następna
          </button>
        </div>
      )}
    </section>
  );
}
