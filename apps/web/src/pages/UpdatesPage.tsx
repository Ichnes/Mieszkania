import {
  CircleAlert,
  ClipboardCheck,
  Columns3,
  DatabaseZap,
  GitCompareArrows,
  LoaderCircle,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { formatQueueAttemptTime, formatStaleRefreshTime } from "../features/imports/lib/queue";
import { formatOptionalPln, formatPln } from "../shared/lib/format";

export function UpdatesPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "activeTab"
    | "isQueueBusy"
    | "combinedQueueCounts"
    | "queueStatusError"
    | "queueStatusCheckedAt"
    | "staleListingRefresh"
    | "refreshQueueStatus"
    | "refreshStaleListingStatus"
    | "isRefreshingQueueStatus"
    | "discoverAllCity"
    | "setDiscoverAllCity"
    | "discoverAllMaxPages"
    | "setDiscoverAllMaxPages"
    | "runDiscoverAllPortals"
    | "isDiscoveringAllPortals"
    | "nextQueueAttemptAt"
    | "queueLimit"
    | "setQueueLimit"
    | "runProcessAllPortals"
    | "isTogglingListingAutomation"
    | "isProcessingAllPortals"
    | "stopListingAutomation"
    | "queueNotice"
    | "queueError"
    | "queueErrorAction"
    | "portalQueueRows"
    | "retryAllFailedQueues"
    | "isRetryingAnyQueue"
    | "resetAllProcessingQueues"
    | "isResettingProcessingQueue"
    | "runRcnImport"
    | "isImportingRcn"
    | "rcnResult"
    | "enrichListingsFromStreets"
    | "isEnrichingListingsFromStreets"
    | "streetEnrichmentResult"
    | "runDuplicateAutoMerge"
    | "isRunningDuplicateAutoMerge"
    | "duplicateAutoMergeResult"
    | "runRelistingScan"
    | "isScanningRelistedListings"
    | "relistingScanResult"
    | "openListing"
    | "rcnError"
    | "duplicateAutoMergeError"
    | "relistingScanError"
  >;
}) {
  const {
    activeTab,
    isQueueBusy,
    combinedQueueCounts,
    queueStatusError,
    queueStatusCheckedAt,
    staleListingRefresh,
    refreshQueueStatus,
    refreshStaleListingStatus,
    isRefreshingQueueStatus,
    discoverAllCity,
    setDiscoverAllCity,
    discoverAllMaxPages,
    setDiscoverAllMaxPages,
    runDiscoverAllPortals,
    isDiscoveringAllPortals,
    nextQueueAttemptAt,
    queueLimit,
    setQueueLimit,
    runProcessAllPortals,
    isTogglingListingAutomation,
    isProcessingAllPortals,
    stopListingAutomation,
    queueNotice,
    queueError,
    queueErrorAction,
    portalQueueRows,
    retryAllFailedQueues,
    isRetryingAnyQueue,
    resetAllProcessingQueues,
    isResettingProcessingQueue,
    runRcnImport,
    isImportingRcn,
    rcnResult,
    enrichListingsFromStreets,
    isEnrichingListingsFromStreets,
    streetEnrichmentResult,
    runDuplicateAutoMerge,
    isRunningDuplicateAutoMerge,
    duplicateAutoMergeResult,
    runRelistingScan,
    isScanningRelistedListings,
    relistingScanResult,
    openListing,
    rcnError,
    duplicateAutoMergeError,
    relistingScanError,
  } = model;
  return (
    <>
      {activeTab === "backfill" ? (
        <section className="sync-center">
          <Link className="action-button secondary-button" to="/import">
            Import pojedynczego linku i danych RCN
          </Link>
          <div className="panel sync-hero">
            <div>
              <p className="eyebrow">Aktualizacja bazy</p>
              <h2>Pobierz najnowsze oferty</h2>
              <p className="muted">
                Najpierw sprawdź portale, a potem pobierz przygotowane oferty. Resztą zajmie się
                aplikacja.
              </p>
            </div>
            <div className="sync-hero-actions">
              <div
                className={
                  isQueueBusy
                    ? "sync-state is-running"
                    : combinedQueueCounts.failed > 0
                      ? "sync-state has-errors"
                      : "sync-state"
                }
              >
                {isQueueBusy ? (
                  <LoaderCircle size={18} className="icon-spin" aria-hidden="true" />
                ) : (
                  <DatabaseZap size={18} aria-hidden="true" />
                )}
                <span>
                  {queueStatusError
                    ? "Status części portali niedostępny"
                    : !queueStatusCheckedAt
                      ? "Odczytuję kolejki…"
                      : isQueueBusy
                        ? "Aktualizacja trwa"
                        : staleListingRefresh?.automationPaused
                          ? "Automat jest wstrzymany"
                          : combinedQueueCounts.readyPending > 0
                            ? `${combinedQueueCounts.readyPending} ofert gotowych do pobrania`
                            : combinedQueueCounts.delayedPending > 0
                              ? `${combinedQueueCounts.delayedPending} ofert chwilowo wstrzymanych`
                              : combinedQueueCounts.failed > 0
                                ? `${combinedQueueCounts.failed} ofert wymaga uwagi`
                                : "Baza jest gotowa"}
                </span>
              </div>
              <button
                className="action-button secondary-button sync-refresh-button"
                type="button"
                onClick={() =>
                  void Promise.all([refreshQueueStatus("manual"), refreshStaleListingStatus()])
                }
                disabled={isRefreshingQueueStatus}
              >
                <RefreshCw
                  size={16}
                  className={isRefreshingQueueStatus ? "icon-spin" : ""}
                  aria-hidden="true"
                />{" "}
                {isRefreshingQueueStatus ? "Odświeżam…" : "Odśwież"}
              </button>
            </div>
          </div>

          <div className="sync-connection" role="status">
            {queueStatusError ??
              (queueStatusCheckedAt
                ? `Status portali odczytany: ${queueStatusCheckedAt.toLocaleTimeString("pl-PL")}`
                : "Odczytuję status portali…")}
          </div>
          <section
            className="panel stale-refresh-summary"
            aria-label="Automatyczne odświeżanie ofert po 24 godzinach"
          >
            <div className="stale-refresh-heading">
              <span
                className={
                  staleListingRefresh?.running
                    ? "stale-refresh-icon is-running"
                    : "stale-refresh-icon"
                }
              >
                <RefreshCw size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>Automatyczne odświeżanie co 24 godziny</strong>
                <small>
                  {staleListingRefresh?.running
                    ? "Trwa sprawdzanie starszych ofert"
                    : staleListingRefresh?.automationPaused
                      ? "Automat jest zatrzymany. Wznowisz go przyciskiem pobierania."
                      : (staleListingRefresh?.due ?? 0) > 0
                        ? `${staleListingRefresh?.due} ${staleListingRefresh?.due === 1 ? "oferta czeka" : "ofert czeka"} na automatyczne sprawdzenie`
                        : staleListingRefresh?.nextDueAt
                          ? `Najbliższe oferty wrócą do sprawdzenia ${formatStaleRefreshTime(staleListingRefresh.nextDueAt)}`
                          : "Oferty wracają do sprawdzenia 24 godziny po ostatnim udanym pobraniu"}
                </small>
              </div>
            </div>
            <div className="stale-refresh-metrics">
              <div>
                <strong>{staleListingRefresh?.due ?? 0}</strong>
                <span>wymaga sprawdzenia teraz</span>
              </div>
              <div>
                <strong>
                  {staleListingRefresh?.refreshedLast24Hours?.toLocaleString("pl-PL") ?? "—"}
                </strong>
                <span>sprawdzonych w ostatnich 24 h</span>
              </div>
              <div>
                <strong>
                  {staleListingRefresh?.lastCheckedAt
                    ? formatStaleRefreshTime(staleListingRefresh.lastCheckedAt, true)
                    : "—"}
                </strong>
                <span>ostatnia udana aktualizacja</span>
              </div>
            </div>
          </section>

          <div className="sync-flow">
            <article className="panel sync-step">
              <span className="step-number">1</span>
              <div className="sync-step-copy">
                <h3>Sprawdź portale</h3>
                <p>Wyszukaj nowe ogłoszenia i zmiany w istniejących ofertach.</p>
              </div>
              <div className="sync-step-body">
                <div className="sync-step-fields">
                  <label className="field-label">
                    <span>Miasto</span>
                    <input
                      className="text-input"
                      value={discoverAllCity}
                      onChange={(event) => setDiscoverAllCity(event.target.value)}
                      placeholder="warszawa"
                    />
                  </label>
                  <label className="field-label">
                    <span>Ile stron na portal</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={discoverAllMaxPages}
                      onChange={(event) =>
                        setDiscoverAllMaxPages(event.target.value.replace(/\D/g, ""))
                      }
                      placeholder="50"
                    />
                    <small className="field-hint">Zwykle wystarczy 20–50 stron.</small>
                  </label>
                </div>
              </div>
              <div className="sync-step-footer">
                <button
                  className="action-button sync-main-button"
                  type="button"
                  onClick={() => void runDiscoverAllPortals()}
                  disabled={isDiscoveringAllPortals}
                >
                  {isDiscoveringAllPortals ? (
                    <LoaderCircle size={17} className="icon-spin" aria-hidden="true" />
                  ) : (
                    <Search size={17} aria-hidden="true" />
                  )}{" "}
                  {isDiscoveringAllPortals ? "Sprawdzam 8 portali…" : "Sprawdź wszystkie portale"}
                </button>
              </div>
            </article>

            <div className="sync-connector" aria-hidden="true">
              <span />
            </div>

            <article className="panel sync-step">
              <span className="step-number">2</span>
              <div className="sync-step-copy">
                <h3>Pobierz szczegóły</h3>
                <p>
                  Portale są pobierane równolegle, a w każdym z nich oferta po ofercie w
                  kontrolowanej liczbie zadań.
                </p>
              </div>
              <div className="sync-step-body">
                <div className="sync-metrics" aria-label="Stan kolejki">
                  <div>
                    <strong>{combinedQueueCounts.pendingNew}</strong>
                    <span>nowych</span>
                  </div>
                  <div>
                    <strong>{combinedQueueCounts.pendingPriceUpdates}</strong>
                    <span>do odświeżenia</span>
                  </div>
                  <div className={combinedQueueCounts.failed > 0 ? "metric-alert" : ""}>
                    <strong>{combinedQueueCounts.failed}</strong>
                    <span>błędów</span>
                  </div>
                </div>
                {combinedQueueCounts.delayedPending > 0 ? (
                  <small className="sync-delay-note">
                    {combinedQueueCounts.readyPending > 0
                      ? `${combinedQueueCounts.readyPending} można pobrać teraz, a ${combinedQueueCounts.delayedPending} portal chwilowo wstrzymał.`
                      : `${combinedQueueCounts.delayedPending} ofert portal chwilowo wstrzymał${nextQueueAttemptAt ? `; automatyczne wznowienie ${formatQueueAttemptTime(nextQueueAttemptAt)}` : ""}.`}
                  </small>
                ) : null}
                <label className="field-label sync-queue-limit">
                  <span>Maksymalnie ofert na portal w tej partii</span>
                  <input
                    className="text-input"
                    inputMode="numeric"
                    value={queueLimit}
                    onChange={(event) => setQueueLimit(event.target.value.replace(/\D/g, ""))}
                    placeholder="200"
                  />
                </label>
                <small className="sync-recovery-note">
                  Nieruchomości-online respektuje ten limit (do 500). Żądania startują co 5 sekund,
                  więc 200 ofert wymaga co najmniej ok. 17 minut. Odpowiedzi przetwarzamy
                  równolegle; czasowa blokada portalu odkłada zadania na później.
                </small>
                <small className="sync-recovery-note">
                  Status odświeża się automatycznie także po zatrzymaniu automatu. Dłuższe pobranie
                  nie oznacza błędu — rozpoczęte zadania mogą się jeszcze kończyć.
                </small>
              </div>
              <div className="sync-process-actions sync-step-footer">
                <button
                  className="action-button sync-main-button"
                  type="button"
                  onClick={() => void runProcessAllPortals()}
                  disabled={
                    isTogglingListingAutomation ||
                    isProcessingAllPortals ||
                    (!staleListingRefresh?.automationPaused &&
                      (isQueueBusy || combinedQueueCounts.readyPending === 0))
                  }
                >
                  <DatabaseZap
                    size={17}
                    aria-hidden="true"
                    className={isProcessingAllPortals ? "icon-spin" : ""}
                  />{" "}
                  {isProcessingAllPortals
                    ? "Pobieram oferty…"
                    : staleListingRefresh?.automationPaused
                      ? "Wznów automat i pobierz oferty"
                      : "Pobierz przygotowane oferty"}
                </button>
                {!staleListingRefresh?.automationPaused ? (
                  <button
                    className="action-button danger-button"
                    type="button"
                    onClick={() => void stopListingAutomation()}
                    disabled={isTogglingListingAutomation}
                  >
                    <X size={16} aria-hidden="true" />{" "}
                    {isTogglingListingAutomation ? "Zatrzymuję…" : "Zatrzymaj automat"}
                  </button>
                ) : null}
              </div>
            </article>
          </div>

          {queueNotice && !queueError ? (
            <section
              className={`sync-notice-banner is-${queueNotice.tone}`}
              role="status"
              aria-live="polite"
            >
              {queueNotice.tone === "success" ? (
                <ClipboardCheck size={21} aria-hidden="true" />
              ) : (
                <LoaderCircle
                  size={21}
                  className={isProcessingAllPortals ? "icon-spin" : ""}
                  aria-hidden="true"
                />
              )}
              <p>{queueNotice.message}</p>
            </section>
          ) : null}

          {queueError ? (
            <section className="sync-error-banner" role="alert" aria-live="assertive">
              <CircleAlert size={22} aria-hidden="true" />
              <div>
                <strong>Aktualizacja nie zakończyła się poprawnie</strong>
                <p>{queueError}</p>
              </div>
              <div className="sync-error-actions">
                <button
                  className="action-button danger-button"
                  type="button"
                  onClick={() =>
                    void (queueErrorAction === "discover"
                      ? runDiscoverAllPortals()
                      : runProcessAllPortals())
                  }
                  disabled={isDiscoveringAllPortals || isProcessingAllPortals}
                >
                  <RotateCcw size={16} aria-hidden="true" /> Spróbuj ponownie
                </button>
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => void refreshQueueStatus("manual")}
                  disabled={isRefreshingQueueStatus}
                >
                  <RefreshCw
                    size={16}
                    className={isRefreshingQueueStatus ? "icon-spin" : ""}
                    aria-hidden="true"
                  />{" "}
                  Odśwież status
                </button>
              </div>
            </section>
          ) : null}

          <details className="panel sync-details">
            <summary>
              <span>
                <Columns3 size={18} aria-hidden="true" /> Szczegóły kolejki
              </span>
              <small>Status poszczególnych portali i narzędzia naprawcze</small>
            </summary>
            <div
              className="portal-status-table"
              role="table"
              aria-label="Status pobierania z portali"
            >
              <div className="portal-status-row portal-status-head" role="row">
                <span>Portal</span>
                <span>Nowe</span>
                <span>Odświeżenie</span>
                <span>W toku</span>
                <span>Błędy</span>
              </div>
              {portalQueueRows.map(({ name, status }) => (
                <div className="portal-status-row" role="row" key={name}>
                  <strong>{name}</strong>
                  <span>{status?.pendingNew ?? 0}</span>
                  <span
                    title={
                      status?.nextAttemptAt
                        ? `Najbliższa próba: ${formatQueueAttemptTime(status.nextAttemptAt)}`
                        : undefined
                    }
                  >
                    {status?.pendingPriceUpdates ?? 0}
                    {(status?.delayedPending ?? 0) > 0 ? ` (${status?.delayedPending} wstrz.)` : ""}
                  </span>
                  <span>{status?.counts.processing ?? "—"}</span>
                  <span className={(status?.counts.failed ?? 0) > 0 ? "status-error" : ""}>
                    {status?.counts.failed ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="sync-recent-failures">
              {portalQueueRows
                .filter(({ status }) => status?.recentFailures.length)
                .map(({ name, status }) => (
                  <details key={name}>
                    <summary>
                      {name} · ostatnie błędy ({status!.recentFailures.length})
                    </summary>
                    {status!.recentFailures.map((failure) => (
                      <article key={failure.external_id}>
                        <a href={failure.canonical_url} target="_blank" rel="noreferrer">
                          {failure.external_id} ↗
                        </a>
                        <p>
                          {failure.last_error?.includes("MISSING_PRICE")
                            ? "Portal nie zwrócił odczytywalnej ceny. Poprzednia cena oferty pozostaje w bazie."
                            : failure.last_error?.includes("429")
                              ? "Portal ogranicza częstotliwość pobierania."
                              : failure.last_error?.includes("403")
                                ? "Portal odmówił dostępu do ogłoszenia."
                                : (failure.last_error ?? "Brak szczegółów błędu.")}
                        </p>
                        <details>
                          <summary>Szczegóły techniczne</summary>
                          <code>{failure.last_error}</code>
                        </details>
                      </article>
                    ))}
                  </details>
                ))}
            </div>
            <div className="sync-detail-actions">
              <button
                className="action-button secondary-button"
                type="button"
                onClick={() => void refreshQueueStatus("manual")}
                disabled={isRefreshingQueueStatus}
              >
                <RefreshCw
                  size={16}
                  className={isRefreshingQueueStatus ? "icon-spin" : ""}
                  aria-hidden="true"
                />{" "}
                Odśwież status
              </button>
              {combinedQueueCounts.failed > 0 ? (
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => void retryAllFailedQueues()}
                  disabled={isRetryingAnyQueue}
                >
                  <RotateCcw
                    size={16}
                    className={isRetryingAnyQueue ? "icon-spin" : ""}
                    aria-hidden="true"
                  />{" "}
                  Ponów błędy
                </button>
              ) : null}
              {combinedQueueCounts.processing > 0 && !isProcessingAllPortals ? (
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => void resetAllProcessingQueues()}
                  disabled={isResettingProcessingQueue}
                >
                  <RotateCcw
                    size={16}
                    className={isResettingProcessingQueue ? "icon-spin" : ""}
                    aria-hidden="true"
                  />{" "}
                  Odblokuj zatrzymane ({combinedQueueCounts.processing})
                </button>
              ) : null}
            </div>
          </details>

          <section className="panel data-tools">
            <div className="data-tools-heading">
              <div>
                <p className="eyebrow">Dane pomocnicze</p>
                <h2>Warszawa i porządek w bazie</h2>
              </div>
              <p className="muted">Rzadziej używane operacje zebrane w jednym miejscu.</p>
            </div>
            <div className="data-tool-grid">
              <article>
                <DatabaseZap size={20} aria-hidden="true" />
                <div>
                  <h3>Ceny transakcyjne RCN</h3>
                  <p>Aktualizuje rzeczywiste ceny sprzedaży mieszkań.</p>
                </div>
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => void runRcnImport()}
                  disabled={isImportingRcn}
                >
                  {isImportingRcn ? "Importuję…" : "Aktualizuj RCN"}
                </button>
                {rcnResult ? (
                  <small>{rcnResult.importedTransactions ?? 0} nowych transakcji</small>
                ) : null}
              </article>
              <article>
                <MapPin size={20} aria-hidden="true" />
                <div>
                  <h3>Ulice ofert</h3>
                  <p>Dopasowuje nowe oferty do zapisanej bazy ulic Warszawy.</p>
                </div>
                <div className="tool-actions">
                  <button
                    className="action-button secondary-button"
                    type="button"
                    onClick={() => void enrichListingsFromStreets()}
                    disabled={isEnrichingListingsFromStreets}
                  >
                    {isEnrichingListingsFromStreets ? "Dopasowuję…" : "Dopasuj ulice ofert"}
                  </button>
                </div>
                {streetEnrichmentResult ? (
                  <small>{streetEnrichmentResult.matched} dopasowanych ofert</small>
                ) : null}
              </article>
              <article>
                <GitCompareArrows size={20} aria-hidden="true" />
                <div>
                  <h3>Połącz duplikaty</h3>
                  <p>Szybko grupuje te same oferty z różnych portali.</p>
                </div>
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => void runDuplicateAutoMerge()}
                  disabled={isRunningDuplicateAutoMerge}
                >
                  {isRunningDuplicateAutoMerge ? "Porównuję…" : "Znajdź i połącz"}
                </button>
                {duplicateAutoMergeResult ? (
                  <small>
                    {duplicateAutoMergeResult.merged} połączonych z{" "}
                    {duplicateAutoMergeResult.checked} sprawdzonych
                  </small>
                ) : null}
              </article>
              <article>
                <RotateCcw size={20} aria-hidden="true" />
                <div>
                  <h3>Sprawdź ponownie dodane oferty</h3>
                  <p>
                    Łączy aktywne ogłoszenia z ich wcześniejszą, archiwalną wersją i porównuje ceny.
                  </p>
                </div>
                <button
                  className="action-button secondary-button"
                  type="button"
                  onClick={() => void runRelistingScan()}
                  disabled={isScanningRelistedListings}
                >
                  {isScanningRelistedListings ? "Sprawdzam…" : "Sprawdź ponownie dodane"}
                </button>
                {relistingScanResult ? (
                  <small>{relistingScanResult.matched} znalezionych relistingów</small>
                ) : null}
              </article>
            </div>
            {relistingScanResult ? (
              <section className="relisting-results" aria-live="polite">
                <div className="relisting-results-heading">
                  <div>
                    <h3>Ponownie dodane oferty</h3>
                    <p className="muted">
                      Sprawdzono {relistingScanResult.checkedActive} aktywnych i{" "}
                      {relistingScanResult.checkedArchived} archiwalnych ofert.
                    </p>
                  </div>
                  <span>{relistingScanResult.matched} dopasowań</span>
                </div>
                {relistingScanResult.items.length > 0 ? (
                  <div className="relisting-result-grid">
                    {relistingScanResult.items.map((match) => {
                      const difference = match.priceDifferenceAmount;
                      const differenceClass =
                        difference === undefined || difference === 0
                          ? "is-neutral"
                          : difference < 0
                            ? "is-lower"
                            : "is-higher";
                      return (
                        <article
                          className="relisting-result-card"
                          key={`${match.previous.id}:${match.current.id}`}
                        >
                          <div className="relisting-offer-row is-archived">
                            <span>Archiwalna · {match.previous.sourceLabel}</span>
                            <button
                              className="text-link-button"
                              type="button"
                              onClick={() => void openListing(match.previous.id)}
                            >
                              {match.previous.title}
                            </button>
                            <strong>{formatOptionalPln(match.previous.priceAmount)}</strong>
                          </div>
                          <div className="relisting-arrow" aria-hidden="true">
                            →
                          </div>
                          <div className="relisting-offer-row is-current">
                            <span>Aktualna · {match.current.sourceLabel}</span>
                            <button
                              className="text-link-button"
                              type="button"
                              onClick={() => void openListing(match.current.id)}
                            >
                              {match.current.title}
                            </button>
                            <strong>{formatOptionalPln(match.current.priceAmount)}</strong>
                          </div>
                          <div className={`relisting-price-difference ${differenceClass}`}>
                            <span>Różnica ceny</span>
                            <strong>
                              {difference === undefined
                                ? "brak danych"
                                : `${difference > 0 ? "+" : ""}${formatPln(difference)}`}
                            </strong>
                            {match.priceDifferencePercent !== undefined ? (
                              <small>
                                {match.priceDifferencePercent > 0 ? "+" : ""}
                                {match.priceDifferencePercent.toFixed(1)}%
                              </small>
                            ) : null}
                          </div>
                          <small className="relisting-reasons">
                            Pewność {match.confidenceScore}% · {match.reasons.join(", ")}
                          </small>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted relisting-empty">
                    Nie znaleziono aktywnych ofert, które pojawiły się ponownie po archiwizacji.
                  </p>
                )}
              </section>
            ) : null}
            {rcnError || duplicateAutoMergeError || relistingScanError || queueError ? (
              <p className="error-text">
                {rcnError || duplicateAutoMergeError || relistingScanError || queueError}
              </p>
            ) : null}
          </section>
        </section>
      ) : null}
    </>
  );
}
