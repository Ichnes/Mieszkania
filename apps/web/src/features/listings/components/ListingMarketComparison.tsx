import { useEffect, useState } from "react";
import type { OfferComparison } from "@mieszkania/shared";
import { buyerPriceCuts } from "@mieszkania/shared";
import { apiFetch } from "../../../shared/lib/http";
import { OfferPriceChart } from "./OfferPriceChart";
import { apiBaseUrl } from "../../../shared/lib/api";

const number = (n: number) => Math.round(n).toLocaleString("pl-PL");
export function ListingMarketComparison({
  id,
  acquisitionPrice,
}: {
  id: string;
  acquisitionPrice?: number;
}) {
  const [result, setResult] = useState<OfferComparison | null>();
  const [failed, setFailed] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setFailed(false);
    setResult(undefined);
    apiFetch(`${apiBaseUrl}/api/listings/${id}/market-comparison`, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((value) => {
        if (!c.signal.aborted) setResult(value);
      })
      .catch(() => {
        if (!c.signal.aborted) setFailed(true);
      });
    return () => c.abort();
  }, [id, attempt]);
  if (!result)
    return (
      <section className="buyer-card">
        <h3>Cena na tle podobnych mieszkań</h3>
        {failed ? (
          <button onClick={() => retry((n) => n + 1)}>Ponów pobieranie porównania</button>
        ) : result === null ? (
          "Brak porównywalnych danych dla tej oferty."
        ) : (
          "Dobieramy mieszkania do porównania…"
        )}
      </section>
    );
  const { row, prices, reference, delta } = result;
  const price = row.area > 0 ? row.price / row.area : 0;
  const changes = buyerPriceCuts(row);
  const extra = acquisitionPrice == null ? 0 : Math.max(0, acquisitionPrice - row.price);
  const date = (day: number) =>
    new Date(day * 86400000).toLocaleDateString("pl-PL", { timeZone: "UTC" });
  return (
    <section className="buyer-card offer-comparison">
      <header className="offer-analysis-heading">
        <div>
          <p className="eyebrow">
            {row.district} · {row.rooms ?? "—"} pok. · {row.area ?? "—"} m²
          </p>
          <h3>Cena na tle podobnych mieszkań</h3>
        </div>
        {delta !== null && (
          <span className="offer-delta">
            {Math.abs(delta).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%{" "}
            {delta < 0 ? "poniżej" : delta > 0 ? "powyżej" : "odchylenia od"} mediany
          </span>
        )}
      </header>
      <OfferPriceChart price={price} prices={prices} median={reference} />
      <div className="offer-ledger">
        <h4>Koszt zakupu</h4>
        <dl>
          <div>
            <dt>Cena w ogłoszeniu</dt>
            <dd>{row.price > 0 ? number(row.price) + " zł" : "Brak danych"}</dd>
          </div>
          {extra > 0 && (
            <>
              <div>
                <dt>Znane dopłaty</dt>
                <dd>+{number(extra)} zł</dd>
              </div>
              <div className="ledger-total">
                <dt>Razem</dt>
                <dd>
                  {number(acquisitionPrice!)} zł
                  {row.area > 0 && <small>{number(acquisitionPrice! / row.area)} zł/m²</small>}
                </dd>
              </div>
            </>
          )}
        </dl>
        <h4>Historia ceny</h4>
        <dl>
          <div>
            <dt>W obserwacji od</dt>
            <dd>{date(row.start)}</dd>
          </div>
          <div>
            <dt>Odnotowane obniżki</dt>
            <dd>
              {changes.length}
              {changes.length > 0 && <small>ostatnia {date(changes[changes.length - 1][0])}</small>}
            </dd>
          </div>
          {result.net !== null && (
            <div>
              <dt>Od pierwszej ceny</dt>
              <dd>
                {result.net === 0
                  ? "Bez zmian"
                  : result.net.toLocaleString("pl-PL", {
                      maximumFractionDigits: 1,
                      signDisplay: "exceptZero",
                    }) + "%"}
              </dd>
            </div>
          )}
        </dl>
        {result.signals.length > 0 && (
          <>
            <h4>Przesłanki do negocjacji</h4>
            <ul>
              {result.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <details className="offer-peers">
        <summary>
          Podobne mieszkania <span>{result.count}</span>
        </summary>
        <p>
          {result.scope}. Ta sama liczba pokoi i rodzaj rynku, metraż w granicach ±15%. Wskazówka
          porównuje ceny za m² przed dopłatami.
        </p>
        {result.examples.length > 0 && (
          <>
            <h4>Najbliższy metraż</h4>
            <div className="buyer-list">
              {result.examples.map((p) => (
                <a key={p.id} href={`/oferty?listing=${p.id}`}>
                  <b>
                    {row.district} · {p.area.toLocaleString("pl-PL")} m²
                  </b>
                  <span>
                    {number(p.price)} zł<small>{number(p.price / p.area)} zł/m²</small>
                  </span>
                </a>
              ))}
            </div>
          </>
        )}
      </details>
    </section>
  );
}
