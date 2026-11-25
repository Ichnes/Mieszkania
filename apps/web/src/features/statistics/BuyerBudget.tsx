import { useState } from "react";
import { buyerMedian, type BuyerObservation } from "@mieszkania/shared";
import { PriceInput } from "../../shared/components/PriceInput";
export function BuyerBudget({ active, today }: { active: BuyerObservation[]; today: number }) {
  const [budget, setBudget] = useState<number>(),
    [extras, setExtras] = useState<number>();
  const matches = budget ? active.filter((r) => r.price <= budget - (extras ?? 0)) : [];
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
      {budget ? (
        <>
          <div className="buyer-headline">
            <strong>
              {matches.length} / {active.length}
            </strong>
            <span>aktywnych ofert w budżecie</span>
          </div>
          <p>
            {matches.filter((r) => r.start > today - 7).length} wykryto w ostatnich 7 dniach.{" "}
            {matches.length > 0 &&
              `Mediana dostępnego metrażu: ${buyerMedian(matches.map((r) => r.area))!.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} m².`}
          </p>
        </>
      ) : (
        <p>Podaj budżet zakupu, aby sprawdzić wybrany segment.</p>
      )}
    </article>
  );
}
