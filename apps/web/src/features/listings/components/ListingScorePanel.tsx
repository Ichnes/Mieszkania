import { useState } from "react";
import {
  computeDreamEvaluation,
  type FamilySettings,
  type ListingSummary,
} from "@mieszkania/shared";
import { formatPln } from "../../../shared/lib/format";
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
      <p>
        {evaluation.points} pkt / {evaluation.maxPoints} możliwych pkt × 100%, po zaokrągleniu i
        ograniczeniu do 0–100%.
      </p>
      <p className="muted">
        Punkty nie są punktami procentowymi. Brak potwierdzenia cechy oznacza brak danych w
        ogłoszeniu, nie pewność, że mieszkanie jej nie ma.
      </p>
      {evaluation.mortgage && (
        <p>
          Szacowana rata: <strong>{formatPln(evaluation.mortgage.payment)}</strong>. Wkład własny:{" "}
          {formatPln(evaluation.mortgage.downPayment)}; kwota kredytu:{" "}
          {formatPln(evaluation.mortgage.principal)}. Założenia podglądu ofert: 5,8% rocznie, 360
          równych rat, bez dodatkowych opłat bankowych. Lokalne scenariusze kalkulatora nie
          zmieniają tych założeń; zapisany wkład własny zmienia ocenę.
        </p>
      )}
      {showRules && <ListingScoreRules rows={evaluation.rows} />}
      <div className="listing-score-table-wrap" tabIndex={0} aria-label="Rozbicie punktacji">
        <table className="listing-score-table">
          <thead>
            <tr>
              <th scope="col">Kryterium</th>
              <th scope="col">Punkty</th>
              <th scope="col">Do mianownika</th>
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
                  {row.points}
                </td>
                <td>{row.maxPoints}</td>
                <td>{row.detail || row.rule}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Suma</th>
              <td>{evaluation.points}</td>
              <td>{evaluation.maxPoints}</td>
              <td>{evaluation.score}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
