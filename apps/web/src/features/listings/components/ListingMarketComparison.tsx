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
  const [result, setResult] = useState<
    | (OfferComparison & {
        marketIndex: {
          score: number | null;
          coverage: number;
          months: number;
          preliminary: boolean;
        };
      })
    | null
  >();
  const [failed, setFailed] = useState(false);
  const [showAllPeers, setShowAllPeers] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setFailed(false);
    setResult(undefined);
    setShowAllPeers(false);
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
      <section className="offer-independent-scores" aria-label="Trzy niezależne oceny">
        <div>
          <h4>Buyer Power Index</h4>
          <strong>
            {result.marketIndex.score === null
              ? "W kalibracji"
              : Math.round(result.marketIndex.score) + " / 100"}
          </strong>
          <small>
            Presja na sprzedających w monitorowanym segmencie Warszawy.{" "}
            {result.marketIndex.score === null
              ? `Historia: ${result.marketIndex.months} okresów odniesienia.`
              : `${result.marketIndex.preliminary ? "Wstępny · zapisy portali. " : ""}Historia: ${result.marketIndex.months} okresów. Pokrycie wag: ${result.marketIndex.coverage}%.`}
          </small>
        </div>
        <div>
          <h4>Negotiation Score</h4>
          <strong>
            {result.negotiationScore === null
              ? (result.negotiationReason ?? "Za mało danych")
              : result.negotiationScore + " / 100"}
          </strong>
          <small>
            Sygnały tej oferty. Wiek względem podobnych (30%), liczba obniżek (35%), łączna przecena
            (30%) i potwierdzone ponowne wystawienie (5%). Pokrycie wag:{" "}
            {result.negotiationCoverage}%. Bez obniżki zbieramy minimum 14 dni obserwacji i
            porównujemy wiek z co najmniej 5 ofertami.
          </small>
        </div>
        <div>
          <h4>Value Score</h4>
          <strong>
            {result.valueScore === null ? "Mała próba" : result.valueScore + " / 100"}
          </strong>
          <small>
            Pozycja ceny za m² wśród {result.count} podobnych ofert. Tańsza oferta ma wyższy wynik.
            Minimum 5 porównań.{result.count >= 5 && result.count < 10 ? " Mała próba." : ""}
          </small>
        </div>
      </section>
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
            <h4>
              Najbliższy metraż ·{" "}
              {showAllPeers ? result.examples.length : Math.min(3, result.examples.length)} z{" "}
              {result.count}
            </h4>
            <div className="buyer-list">
              {(showAllPeers ? result.examples : result.examples.slice(0, 3)).map((p) => (
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
            {result.examples.length > 3 && (
              <button
                className="ghost-button peer-list-toggle"
                type="button"
                aria-expanded={showAllPeers}
                onClick={() => setShowAllPeers(!showAllPeers)}
              >
                {showAllPeers ? "Zwiń do 3" : `Pokaż wszystkie (${result.examples.length})`}
              </button>
            )}
          </>
        )}
      </details>
    </section>
  );
}
