import { useState } from "react";
import { buyerMedian, type BuyerObservation } from "@mieszkania/shared";
import { PriceInput } from "../../shared/components/PriceInput";
export function BuyerBudget({ active, today }: { active: BuyerObservation[]; today: number }) {
  const [budget, setBudget] = useState<number>(),
    [extras, setExtras] = useState<number>();
  const available = Math.max(0, (budget ?? 0) - (extras ?? 0));
  const priced = active.filter((r) => Number.isFinite(r.price) && r.price > 0);
  const matches = priced.filter((r) => r.price <= available);
  const medianArea = buyerMedian(matches.map((r) => r.area).filter((a) => a > 0));

  return (
    <article className="buyer-card">
      <p className="eyebrow">Twój rynek</p>
      <h3>Ile mieszkań mieści się w budżecie?</h3>
      <div className="buyer-budget-fields">
        <label>
          Budżet całkowity
          <span>
            <PriceInput value={budget} onChange={setBudget} />
            <i aria-hidden="true">zł</i>
          </span>
        </label>
        <label>
          Rezerwa na dodatki
          <span>
            <PriceInput value={extras} onChange={setExtras} />
            <i aria-hidden="true">zł</i>
          </span>
        </label>
      </div>
      {budget !== undefined ? (
        <>
          <p className="budget-available">
            Na cenę mieszkania po odjęciu rezerwy <b>{available.toLocaleString("pl-PL")} zł</b>
          </p>
          <div className="buyer-headline">
            <strong>
              {matches.length} / {priced.length}
            </strong>
            <span>aktywnych ofert ze znaną ceną w budżecie</span>
          </div>
          <p>
            {!active.length ? (
              "Brak aktywnych ofert w wybranym segmencie."
            ) : !priced.length ? (
              "Aktywne oferty w tym segmencie nie mają zapisanej ceny."
            ) : !matches.length ? (
              "Żadna znana cena ofertowa w tym segmencie nie mieści się w dostępnej kwocie."
            ) : (
              <>
                {matches.filter((r) => r.start > today - 7).length} wykryto w ostatnich 7 dniach.
                {medianArea !== null &&
                  ` Mediana dostępnego metrażu: ${medianArea.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} m².`}
              </>
            )}
          </p>
        </>
      ) : (
        <p>
          Wpisz budżet całkowity. Możesz odłożyć część kwoty na parking, komórkę lub inne dodatki.
        </p>
      )}
    </article>
  );
}
