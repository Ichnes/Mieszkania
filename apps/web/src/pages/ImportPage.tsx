import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { InitialDataSetup } from "../features/imports/InitialDataSetup";

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
    runRcnImport,
    isImportingRcn,
    rcnError,
    rcnResult,
  } = model;
  return (
    <>
      {activeTab === "operations" ? (
        <section className="import-page">
          <Link to="/aktualizacja" className="import-back">
            <ArrowLeft size={18} />
            Wróć do aktualizacji
          </Link>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Twoja lokalna baza</p>
              <h1>Import i przygotowanie danych</h1>
            </div>
          </div>

          <InitialDataSetup />
          <div className="ops-grid">
            <article className="ops-card">
              <h3>Dodaj ofertę z linku</h3>
              <p className="muted">
                Wklej link do oferty z jednego z obsługiwanych portali. Pobierzemy opis, zdjęcia,
                adres i cechy mieszkania.
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
                  {isCollecting ? "Pobieranie..." : "Pobierz ofertę"}
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
                  <p>Zdjęcia: {collectResult.parsed.imageCount}</p>
                </div>
              ) : null}
            </article>

            <article className="ops-card">
              <h3>Ceny transakcyjne RCN</h3>
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
