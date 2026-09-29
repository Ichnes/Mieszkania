import { Select } from "../../components/Select";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { normalizeListingText } from "../listings/lib/listing-language";

type Group = {
  groupId: string;
  primaryListingId: string;
  primaryTitle: string;
  conflicts?: string[];
  members: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    canonicalUrl?: string;
    thumbnailUrl?: string;
    priceLabel: string;
    areaLabel: string;
    floor?: number;
    rooms?: number;
    isPrimary: boolean;
  }>;
};

export function DuplicateGroupsPanel({
  groups,
  total,
  totalMembers,
  totalCopies,
  error,
  busy,
  onReload,
  onLoadMore,
  isLoading,
  onOpen,
  onUnmerge,
  onConfirm,
}: {
  groups: Group[];
  total: number;
  totalMembers: number;
  totalCopies: number;
  error: string | null;
  busy: string | null;
  onReload: () => void;
  onLoadMore: () => void;
  isLoading: boolean;
  onOpen: (id: string) => void;
  onUnmerge: (primaryListingId: string, duplicateListingId: string) => void;
  onConfirm: (primaryListingId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [page, setPage] = useState(1);
  const filtered = groups.filter(
    (group) =>
      (!onlyConflicts || Boolean(group.conflicts?.length)) &&
      (!source || group.members.some((member) => member.sourceLabel === source)) &&
      normalizeListingText(group.members.map((member) => member.title).join(" ")).includes(
        normalizeListingText(search),
      ),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const members = new Set(filtered.flatMap((group) => group.members.map((member) => member.id)))
    .size;
  const copies = new Set(
    filtered.flatMap((group) =>
      group.members.filter((member) => !member.isPrimary).map((member) => member.id),
    ),
  ).size;
  return (
    <section className="duplicate-groups-page">
      <section className="panel">
        <div className="section-topline">
          <div>
            <p className="eyebrow">Kontrola jakości</p>
            <h2>Duplikaty do weryfikacji</h2>
            <p className="muted">
              Zatwierdzone grupy znikają z tej kolejki. Liczniki obejmują całą kolejkę oczekującą na
              weryfikację.
            </p>
          </div>
          <button
            className="action-button secondary-button"
            onClick={onReload}
            disabled={isLoading || Boolean(busy)}
          >
            <RefreshCw size={16} /> Odśwież
          </button>
        </div>
        <div className="insight-card-grid duplicate-metrics">
          <article>
            <strong>{isLoading ? "…" : total}</strong>
            <span>grup do sprawdzenia</span>
          </article>
          <article>
            <strong>{isLoading ? "…" : totalMembers}</strong>
            <span>ogłoszeń w tych grupach</span>
          </article>
          <article>
            <strong>{isLoading ? "…" : totalCopies}</strong>
            <span>kopii poza głównymi</span>
          </article>
        </div>
        <div className="duplicate-toolbar">
          <label>
            <span>Rozbieżności danych</span>
            <input
              type="checkbox"
              checked={onlyConflicts}
              onChange={(event) => {
                setOnlyConflicts(event.target.checked);
                setPage(1);
              }}
            />
            Tylko grupy z konfliktami
          </label>
          <label>
            <span>Szukaj w pobranych grupach</span>
            <input
              className="text-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tytuł lub lokalizacja"
            />
          </label>
          <label>
            <span>Portal w grupie</span>
            <Select
              label="Portal w grupie"
              value={source}
              onChange={(value) => {
                setSource(value);
                setPage(1);
              }}
            >
              <option value="">Wszystkie portale</option>
              {[
                ...new Set(
                  groups.flatMap((group) => group.members.map((member) => member.sourceLabel)),
                ),
              ]
                .sort()
                .map((label) => (
                  <option key={label}>{label}</option>
                ))}
            </Select>
          </label>
        </div>
        <p className="muted">
          Pobrano {groups.length} z {total} grup do weryfikacji. Po filtrach: {filtered.length}{" "}
          grup, {members} ogłoszeń i {copies} kopii.
        </p>
        {groups.length < total ? (
          <button
            className="action-button secondary-button"
            disabled={isLoading || Boolean(busy)}
            onClick={onLoadMore}
          >
            Pobierz kolejne 100 grup
          </button>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
      {visible.map((group, groupIndex) => (
        <section className="panel duplicate-review-v2" key={group.groupId}>
          <details>
            <summary>Zapisz rozstrzygnięcie i źródło</summary>
            <LazyGroupNotes listingId={group.primaryListingId} />
          </details>
          <div className="section-topline">
            <div className="duplicate-group-heading">
              <p className="eyebrow">
                Porównanie {String((currentPage - 1) * 20 + groupIndex + 1).padStart(2, "0")}
              </p>
              <h3>{group.primaryTitle}</h3>
              {Boolean(group.conflicts?.length) && (
                <p className="error-text">
                  Do sprawdzenia: {group.conflicts!.join(" · ")}. Rozbieżność może wynikać z błędu
                  ogłoszenia.
                </p>
              )}
            </div>
            <span className="pill">
              {group.members.length} ogłoszeń ·{" "}
              {new Set(group.members.map((member) => member.sourceLabel)).size} portali
            </span>
          </div>
          <div className="duplicate-member-grid">
            {group.members.map((member) => (
              <article
                className={
                  member.isPrimary
                    ? "duplicate-review-member is-primary"
                    : "duplicate-review-member"
                }
                key={member.id}
              >
                <div className="duplicate-photo-frame">
                  <span className="duplicate-source-tag">{member.sourceLabel}</span>
                  {member.thumbnailUrl ? (
                    <button
                      className="duplicate-photo-button"
                      onClick={() => onOpen(member.id)}
                      aria-label={`Otwórz ofertę: ${member.title}`}
                    >
                      <img
                        src={member.thumbnailUrl}
                        alt={member.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ) : (
                    <div className="duplicate-preview-empty">Brak zdjęcia</div>
                  )}
                </div>
                <div className="duplicate-member-content">
                  <span className="duplicate-role">
                    {member.isPrimary ? "Oferta główna" : "Powiązane ogłoszenie"}
                  </span>
                  <h4>{member.title}</h4>
                  <p className="duplicate-price-row">
                    <strong>{member.priceLabel}</strong>
                    <span>{member.areaLabel}</span>
                    <span>
                      Piętro: {member.floor ?? "brak danych"} · Pokoje:{" "}
                      {member.rooms ?? "brak danych"}
                    </span>
                  </p>
                  <div className="duplicate-member-actions">
                    <button
                      className="action-button secondary-button"
                      onClick={() => onOpen(member.id)}
                    >
                      Szczegóły
                    </button>
                    {member.canonicalUrl ? (
                      <a
                        className="text-link-button"
                        href={member.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Portal ↗
                      </a>
                    ) : null}
                    {!member.isPrimary ? (
                      <button
                        className="action-button secondary-button"
                        disabled={Boolean(busy) || isLoading}
                        onClick={() => onUnmerge(group.primaryListingId, member.id)}
                      >
                        Rozłącz
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="duplicate-review-footer">
            <small>Porównaj zdjęcia, metraż i lokalizację przed zatwierdzeniem.</small>
            <button
              className="action-button"
              disabled={Boolean(busy) || isLoading}
              onClick={() => onConfirm(group.primaryListingId)}
            >
              {busy === group.primaryListingId ? "Zapisuję…" : "Zatwierdź całą grupę"}
            </button>
          </div>
        </section>
      ))}
      {!visible.length && !isLoading && !error ? (
        <div className="panel">
          {groups.length ? "Brak grup dla tych filtrów." : "Brak grup oczekujących na weryfikację."}
        </div>
      ) : null}
      {pages > 1 ? (
        <div className="duplicate-pagination">
          <button
            className="action-button secondary-button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Poprzednie
          </button>
          <span>
            {currentPage} / {pages}
          </span>
          <button
            className="action-button secondary-button"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Następne
          </button>
        </div>
      ) : null}
    </section>
  );
}

function LazyGroupNotes({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  if (!listingId)
    return (
      <p role="alert">W grupie brakuje głównej oferty. Sprawdź jej skład przed zapisem ustaleń.</p>
    );
  return open ? (
    <DecisionNotebook key={listingId} listingId={listingId} factsOnly />
  ) : (
    <button type="button" className="action-button secondary-button" onClick={() => setOpen(true)}>
      Wczytaj ustalenia tej oferty
    </button>
  );
}
import { DecisionNotebook } from "../decisions/DecisionNotebook";
