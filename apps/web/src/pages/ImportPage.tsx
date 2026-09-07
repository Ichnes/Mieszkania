import type { WorkspaceState } from "../app/useWorkspaceController";

export function ImportPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "activeTab"
    | "runCollector"
    | "collectUrl"
    | "setCollectUrl"
    | "isCollecting"
    | "collectError"
    | "collectResult"
    | "runBulkCollector"
    | "bulkCity"
    | "setBulkCity"
    | "bulkStartPage"
    | "setBulkStartPage"
    | "bulkPages"
    | "setBulkPages"
    | "bulkLimit"
    | "setBulkLimit"
    | "isBulkCollecting"
    | "bulkError"
    | "bulkResult"
    | "runRcnImport"
    | "isImportingRcn"
    | "rcnError"
    | "rcnResult"
  >;
}) {
  const {
    activeTab,
    runCollector,
    collectUrl,
    setCollectUrl,
    isCollecting,
    collectError,
    collectResult,
    runBulkCollector,
    bulkCity,
    setBulkCity,
    bulkStartPage,
    setBulkStartPage,
    bulkPages,
    setBulkPages,
    bulkLimit,
    setBulkLimit,
    isBulkCollecting,
    bulkError,
    bulkResult,
    runRcnImport,
    isImportingRcn,
    rcnError,
    rcnResult,
  } = model;
  return (
    <>
      {activeTab === "operations" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Operacje</p>
              <h2>Collectory i import RCN</h2>
            </div>
          </div>

          <div className="ops-grid">
            <article className="ops-card">
              <h3>Otodom collect-one</h3>
              <p className="muted">
                Wklejasz jeden pełny link do konkretnej oferty Otodom. Collector pobiera opis,
                zdjęcia, adres, cechy i zapisuje snapshot do bazy.
              </p>
              <form
                className="ops-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runCollector();
                }}
              >
                <label className="field-label">
                  <span>Link do oferty</span>
                  <input
                    className="text-input"
                    value={collectUrl}
                    onChange={(event) => setCollectUrl(event.target.value)}
                    placeholder="https://www.otodom.pl/pl/oferta/..."
                  />
                </label>
                <button
                  className="action-button"
                  type="submit"
                  disabled={isCollecting || !collectUrl.trim()}
                >
                  {isCollecting ? "Pobieranie..." : "Uruchom collector"}
                </button>
              </form>
              {collectError ? <p className="error-text">{collectError}</p> : null}
              {collectResult ? (
                <div className="result-box">
                  <strong>{collectResult.parsed.title}</strong>
                  <p>
                    {collectResult.parsed.city} / {collectResult.parsed.district ?? "-"} /{" "}
                    {collectResult.parsed.neighborhood ?? "-"}
                  </p>
                  <p>Zdjecia: {collectResult.parsed.imageCount}</p>
                </div>
              ) : null}
            </article>

            <article className="ops-card">
              <h3>Otodom automat</h3>
              <p className="muted">
                `Miasto` to slug z wyników Otodom, np. `warszawa`. `Liczba stron` mówi, przez ile
                stron wyników iść po kolei. `Limit` mówi, ile ofert maksymalnie faktycznie zaciągnąć
                z wykrytych linków.
              </p>
              <form
                className="ops-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runBulkCollector();
                }}
              >
                <label className="field-label">
                  <span>Miasto</span>
                  <input
                    className="text-input"
                    value={bulkCity}
                    onChange={(event) => setBulkCity(event.target.value)}
                    placeholder="warszawa"
                  />
                </label>
                <label className="field-label">
                  <span>Start od strony</span>
                  <input
                    className="text-input"
                    value={bulkStartPage}
                    onChange={(event) => setBulkStartPage(event.target.value)}
                    placeholder="np. 1"
                  />
                </label>
                <label className="field-label">
                  <span>Liczba stron w batchu</span>
                  <input
                    className="text-input"
                    value={bulkPages}
                    onChange={(event) => setBulkPages(event.target.value)}
                    placeholder="np. 3"
                  />
                </label>
                <label className="field-label">
                  <span>Limit ofert do pobrania</span>
                  <input
                    className="text-input"
                    value={bulkLimit}
                    onChange={(event) => setBulkLimit(event.target.value)}
                    placeholder="np. 12"
                  />
                </label>
                <button className="action-button" type="submit" disabled={isBulkCollecting}>
                  {isBulkCollecting ? "Zaciaganie..." : "Lec po ogloszeniach"}
                </button>
              </form>
              {bulkError ? <p className="error-text">{bulkError}</p> : null}
              {bulkResult ? (
                <div className="result-box">
                  <p>Start od strony: {bulkResult.startPage}</p>
                  <p>Przeskanowane strony: {bulkResult.pagesScanned}</p>
                  <p>Wykryte URL-e: {bulkResult.discovered}</p>
                  <p>Limit pobrania: {bulkResult.limitApplied}</p>
                  <p>Przetworzone wpisy: {bulkResult.collected}</p>
                  <p>
                    Nowe: {bulkResult.created} / Zaktualizowane: {bulkResult.updated} / Bez zmian:{" "}
                    {bulkResult.unchanged} / Błędy: {bulkResult.failed}
                  </p>
                </div>
              ) : null}
            </article>

            <article className="ops-card">
              <h3>RCN import</h3>
              <p className="muted">
                To jest nadal warstwa robocza. Import próbuje pobrać publiczne dane WFS dla Warszawy
                i okolic. Jeśli źródło powiatu nic nie zwraca, zobaczysz mało albo zero rekordów.
              </p>
              <button
                className="action-button"
                onClick={() => void runRcnImport()}
                disabled={isImportingRcn}
              >
                {isImportingRcn ? "Import..." : "Uruchom import RCN"}
              </button>
              {rcnError ? <p className="error-text">{rcnError}</p> : null}
              {rcnResult ? (
                <div className="result-box">
                  <strong>Transakcje: {rcnResult.importedTransactions}</strong>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}
