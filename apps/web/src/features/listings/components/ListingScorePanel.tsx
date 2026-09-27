import { useState } from "react";
import {
  computeDreamEvaluation,
  type FamilySettings,
  type ListingSummary,
} from "@mieszkania/shared";
import { ListingScoreRules } from "./ListingScoreRules";

export function ListingScorePanel({
  listing,
  settings,
}: {
  listing: ListingSummary;
  settings: FamilySettings;
}) {
  const [showRules, setShowRules] = useState(false);
  const evaluation = computeDreamEvaluation(
    listing,
    settings.dreamProfile,
    settings.workplaces,
    undefined,
    settings.financing,
  );
  return (
    <section className="listing-score-panel" aria-label="Ocena wymarzonego mieszkania">
      <div className="listing-score-heading">
        <div>
          <h3>Ocena wymarzonego mieszkania</h3>
          <strong className="listing-score-total">{evaluation.score}%</strong>
          <p className="listing-score-coverage">
            Pokrycie kryteriów: <strong>{evaluation.coverage.percent}%</strong> (
            {evaluation.coverage.known} z {evaluation.coverage.total})
          </p>
        </div>
        <button
          type="button"
          className="action-button"
          aria-expanded={showRules}
          aria-controls="dream-score-rules"
          onClick={() => setShowRules(!showRules)}
        >
          {showRules ? "Ukryj zasady punktacji" : "Co ile daje punktów?"}
        </button>
      </div>
      <div className="listing-score-data">
        <p>
          Pokrycie oznacza, dla ilu aktywnych kryteriów mamy dane do oceny. Potwierdzony brak cechy
          też jest informacją. Każde kryterium liczy się jednakowo; ten wskaźnik nie zmienia
          punktacji i nie potwierdza prawdziwości ogłoszenia.
        </p>
        {evaluation.coverage.unknowns.length > 0 ? (
          <p>
            <strong>Najpierw sprawdź:</strong> {evaluation.coverage.unknowns.join(", ")}. To
            maksymalnie trzy niewiadome o największej możliwej premii punktowej.
          </p>
        ) : (
          <p>Wszystkie aktywne kryteria mają dane do oceny.</p>
        )}
      </div>
      <p>
        {evaluation.points} pkt / {evaluation.maxPoints} możliwych pkt × 100%, po zaokrągleniu i
        ograniczeniu do 0–100%.
      </p>
      <p className="muted">
        Punkty możliwe to suma maksymalnych punktów wszystkich kryteriów aktywnych w Twoich
        preferencjach. Są takie same dla każdej oferty; uzupełnienie danych ich nie zmienia.
      </p>
      <p className="muted">
        Punkty nie są punktami procentowymi. Brak potwierdzenia cechy oznacza brak danych w
        ogłoszeniu, nie pewność, że mieszkanie jej nie ma.
      </p>
      {showRules && <ListingScoreRules rows={evaluation.rows} />}
      <div className="listing-score-table-wrap" tabIndex={0} aria-label="Rozbicie punktacji">
        <table className="listing-score-table">
          <thead>
            <tr>
              <th scope="col">Kryterium</th>
              <th scope="col" title="Zdobyte punkty (punkty możliwe)">
                Punkty
              </th>
              <th scope="col">Dane / powód</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td
                  className={
                    row.points < 0 ? "score-negative" : row.points > 0 ? "score-positive" : ""
                  }
                >
                  {row.points > 0 ? "+" : ""}
                  {row.points} <span className="score-possible">({row.maxPoints})</span>
                </td>
                <td>
                  <span className="listing-score-data-status">
                    {row.dataStatus === "inactive"
                      ? "Kryterium wyłączone"
                      : row.dataStatus === "unknown"
                        ? "Dane niepełne / niepotwierdzone"
                        : "Dane dostępne"}
                  </span>
                  {row.detail || row.rule}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Suma</th>
              <td>
                {evaluation.points} <span className="score-possible">({evaluation.maxPoints})</span>
              </td>
              <td>{evaluation.score}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
