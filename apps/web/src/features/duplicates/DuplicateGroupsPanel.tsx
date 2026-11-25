import { Select } from "../../components/Select";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import type { DuplicateGroupQuery, DuplicateGroupsResponse } from "@mieszkania/shared";
import { DuplicatePreview } from "./DuplicatePreview";
import { DuplicateComparisonFacts } from "./DuplicateComparisonFacts";

export function DuplicateGroupsPanel({
  data,
  query,
  onQueryChange,
  error,
  busy,
  onReload,
  isLoading,
  onOpen,
  onUnmerge,
  onDissolve,
  onConfirm,
}: {
  data?: DuplicateGroupsResponse;
  query: DuplicateGroupQuery;
  onQueryChange: (query: DuplicateGroupQuery) => void;
  error: string | null;
  busy: string | null;
  onReload: () => void;
  isLoading: boolean;
  onOpen: (id: string) => void;
  onUnmerge: (primaryListingId: string, duplicateListingId: string) => Promise<boolean>;
  onDissolve: (groupId: string, memberIds: string[]) => Promise<boolean>;
  onConfirm: (primaryListingId: string) => void;
}) {
  const [search, setSearch] = useState(query.search);
  const [notice, setNotice] = useState("");
  const [returnQuery, setReturnQuery] = useState<DuplicateGroupQuery>();
  const heading = useRef<HTMLElement>(null);
  const visible = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));
  const currentPage = data?.page ?? query.page;
  const filter = (change: Partial<DuplicateGroupQuery>) => {
    setReturnQuery(undefined);
    setNotice("");
    onQueryChange({ ...query, ...change, page: 1 });
  };
  async function detach(group: DuplicateGroupsResponse["items"][number], id: string) {
    if (!(await onUnmerge(group.primaryListingId, id))) return;
    if (group.members.length > 2) {
      setReturnQuery(returnQuery ?? query);
      onQueryChange({
        ...query,
        search: group.primaryListingId,
        source: "",
        onlyConflicts: false,
        page: 1,
      });
      setNotice(
        "Odłączono wybrane ogłoszenie. Możesz dalej sprawdzać pozostałe oferty z tej grupy.",
      );
    } else {
      setNotice("Rozłączono parę. Oba ogłoszenia są teraz osobnymi ofertami.");
      if (returnQuery) {
        onQueryChange(returnQuery);
        setSearch(returnQuery.search);
        setReturnQuery(undefined);
      }
    }
    heading.current?.scrollIntoView({ block: "start" });
  }
  return (
    <section className="duplicate-groups-page">
      <section ref={heading} className="panel duplicate-queue-controls">
        <div className="section-topline">
          <div>
            <h2>Połączone grupy do sprawdzenia</h2>
            {data && (
              <p className="muted">
                {data.total.toLocaleString("pl-PL")} grup ·{" "}
                {data.totalMembers.toLocaleString("pl-PL")} ogłoszeń ·{" "}
                {data.totalCopies.toLocaleString("pl-PL")} kopii
              </p>
            )}
          </div>
          <button
            className="action-button secondary-button"
            type="button"
            onClick={onReload}
            disabled={isLoading || Boolean(busy)}
          >
            <RefreshCw size={16} /> Odśwież
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        {returnQuery && (
          <button
            className="action-button secondary-button"
            onClick={() => {
              onQueryChange(returnQuery);
              setSearch(returnQuery.search);
              setReturnQuery(undefined);
              setNotice("");
            }}
          >
            Wróć do listy grup
          </button>
        )}
        {!returnQuery && (
          <>
            <form
              className="duplicate-search"
              onSubmit={(event) => {
                event.preventDefault();
                filter({ search });
              }}
            >
              <input
                type="search"
                className="text-input"
                aria-label="Szukaj we wszystkich grupach"
                placeholder="Tytuł, adres, portal lub ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit" className="action-button secondary-button">
                Szukaj
              </button>
            </form>
            <details className="duplicate-filter-menu">
              <summary>
                Filtry i sortowanie{(query.source || query.onlyConflicts) && " · aktywne"}
              </summary>
              <div className="duplicate-toolbar">
                <label>
                  <span>Kolejność grup</span>
                  <Select
                    label="Kolejność grup"
                    value={query.sort}
                    onChange={(sort) => filter({ sort })}
                  >
                    <option value="conflicts">Najwięcej rozbieżności</option>
                    <option value="members_desc">Najwięcej powiązanych ofert</option>
                    <option value="members_asc">Najmniej powiązanych ofert</option>
                  </Select>
                </label>
                <label>
                  <span>Portal w grupie</span>
                  <Select
                    label="Portal w grupie"
                    value={query.source}
                    onChange={(source) => filter({ source })}
                  >
                    <option value="">Wszystkie portale</option>
                    {data?.sources.map((label) => (
                      <option key={label}>{label}</option>
                    ))}
                  </Select>
                </label>
                <label className="duplicate-conflict-toggle">
                  <input
                    type="checkbox"
                    checked={query.onlyConflicts}
                    onChange={(event) => filter({ onlyConflicts: event.target.checked })}
                  />
                  <span>Tylko grupy z rozbieżnościami</span>
                </label>
              </div>
            </details>
          </>
        )}
        {isLoading && (
          <p className="muted" role="status">
            Wczytywanie grup…
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </section>
      {visible.map((group) => (
        <section className="panel duplicate-review-v2" key={group.groupId}>
          <div className="section-topline">
            <div className="duplicate-group-heading">
              <h3>{group.primaryTitle}</h3>
              {Boolean(group.conflicts.length) && (
                <p className="error-text">{group.conflicts.join(" · ")}</p>
              )}
            </div>
            <span className="pill">
              {group.members.length} ogłoszeń ·{" "}
              {new Set(group.members.map((member) => member.sourceLabel)).size} portali
            </span>
          </div>
          <DuplicateComparisonFacts
            offers={group.members.map((member) => ({
              ...member,
              roomsLabel: member.rooms === undefined ? undefined : String(member.rooms),
            }))}
          />
          <div className="duplicate-review-footer">
            <button
              className="action-button"
              disabled={Boolean(busy) || isLoading}
              onClick={() => onConfirm(group.primaryListingId)}
            >
              {busy === group.primaryListingId ? "Zapisuję…" : "Zatwierdź całą grupę"}
            </button>
            <button
              type="button"
              className="action-button secondary-button"
              disabled={Boolean(busy) || isLoading}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Rozłączyć całą grupę „${group.primaryTitle}”? Liczba ofert: ${group.members.length}. Wszystkie staną się osobnymi ofertami.`,
                  )
                )
                  return;
                if (
                  !(await onDissolve(
                    group.groupId,
                    group.members.map((member) => member.id),
                  ))
                )
                  return;
                if (returnQuery) {
                  onQueryChange(returnQuery);
                  setSearch(returnQuery.search);
                  setReturnQuery(undefined);
                }
                setNotice(`Rozłączono całą grupę. Liczba osobnych ofert: ${group.members.length}.`);
                heading.current?.scrollIntoView({ block: "start" });
              }}
            >
              Rozłącz całą grupę
            </button>
            <details>
              <summary>Zapisz rozstrzygnięcie i źródło</summary>
              <LazyGroupNotes listingId={group.primaryListingId} />
            </details>
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
                  <DuplicatePreview
                    id={member.id}
                    title={member.title}
                    urls={
                      member.thumbnailUrls ?? (member.thumbnailUrl ? [member.thumbnailUrl] : [])
                    }
                    sharedFromIndex={member.thumbnailSharedFromIndex}
                    onOpen={onOpen}
                  />
                </div>
                <div className="duplicate-member-content">
                  <span className="duplicate-role">
                    {member.isPrimary ? "Oferta główna" : "Powiązane ogłoszenie"}
                  </span>
                  <h4>{member.title}</h4>
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
                        onClick={() => void detach(group, member.id)}
                      >
                        Rozłącz
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {!visible.length && !isLoading && !error ? (
        <div className="panel">
          {query.search || query.source || query.onlyConflicts
            ? "Brak grup dla tych filtrów."
            : "Brak grup oczekujących na weryfikację."}
        </div>
      ) : null}
      {pages > 1 ? (
        <div className="duplicate-pagination">
          <button
            className="action-button secondary-button"
            disabled={isLoading || currentPage <= 1}
            onClick={() => onQueryChange({ ...query, page: currentPage - 1 })}
          >
            Poprzednie
          </button>
          <span>
            {currentPage} / {pages}
          </span>
          <button
            className="action-button secondary-button"
            disabled={isLoading || currentPage >= pages}
            onClick={() => onQueryChange({ ...query, page: currentPage + 1 })}
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
