import { formatPln } from "../../shared/lib/format";
import type { calculateMortgage } from "./lib/mortgage-simulation";

type Simulation = ReturnType<typeof calculateMortgage>;

export function MortgageComparison({
  principal,
  monthlyExtra,
  base,
  modified,
}: {
  principal: number;
  monthlyExtra: number;
  base: Simulation;
  modified: Simulation;
}) {
  const nextPayment = modified.rows[1]?.payment ?? modified.rows[0]?.payment ?? 0;
  const savedInterest = Math.max(0, base.interest - modified.interest);
  const savedMonths = Math.max(0, base.rows.length - modified.rows.length);
  return (
    <section className="panel mortgage-comparison" aria-labelledby="mortgage-comparison-title">
      <h3 id="mortgage-comparison-title">Kredyt i efekt nadpłat</h3>
      <dl className="mortgage-comparison-inputs">
        <div>
          <dt>Kwota kredytu</dt>
          <dd>{formatPln(principal)}</dd>
        </div>
        <div>
          <dt>Stała nadpłata miesięczna</dt>
          <dd>{formatPln(monthlyExtra)}</dd>
        </div>
      </dl>
      <div className="mortgage-comparison-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Porównanie spłaty</th>
              <th scope="col">Bez nadpłat</th>
              <th scope="col">Po nadpłatach</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Łączna spłata</th>
              <td>{formatPln(base.totalPaid)}</td>
              <td>{formatPln(modified.totalPaid)}</td>
            </tr>
            <tr>
              <th scope="row">W tym odsetki</th>
              <td>{formatPln(base.interest)}</td>
              <td>{formatPln(modified.interest)}</td>
            </tr>
            <tr>
              <th scope="row">Liczba rat</th>
              <td>{base.rows.length}</td>
              <td>{modified.rows.length}</td>
            </tr>
            <tr>
              <th scope="row">
                Rata bankowa<small>pierwsza / po pierwszym miesiącu</small>
              </th>
              <td>{formatPln(base.basePayment)}</td>
              <td>{formatPln(nextPayment)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mortgage-comparison-savings">
        <div>
          <span>Oszczędność na odsetkach</span>
          <strong>{formatPln(savedInterest)}</strong>
        </div>
        <div>
          <span>Spłata krótsza o</span>
          <strong>{savedMonths} mies.</strong>
        </div>
      </div>
      <p className="muted">
        Łączna spłata obejmuje kapitał, odsetki i nadpłaty. Polisy i opłaty dodatkowe są poniżej.
      </p>
    </section>
  );
}
