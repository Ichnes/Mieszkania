import { useMortgageInput } from "./useMortgageInput";
import { LoaderCircle } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { formatPln } from "../../shared/lib/format";
import {
  calculateBankCosts,
  calculatePurchaseCosts,
  mortgageInsurancePresets,
  type MortgageInsurancePreset,
} from "./lib/mortgage-costs";
import { calculateMortgage } from "./lib/mortgage-simulation";
import { MortgageDraft } from "./types";

export const PremiumMortgageVisuals = lazy(() => import("./MortgageVisuals"));

export function MortgageCalculator({
  draft,
  defaultDownPayment,
  onSaveDownPayment,
  savingSettings,
  settingsError,
  onBackToListing,
}: {
  draft: MortgageDraft;
  defaultDownPayment: number;
  onSaveDownPayment: (value: number) => void | Promise<void>;
  savingSettings: boolean;
  settingsError: string | null;
  onBackToListing: () => void;
}) {
  const [propertyTotal, setPropertyTotal] = useMortgageInput(
    "propertyTotal",
    draft.propertyTotal || 1_200_000,
  );
  const [downPayment, setDownPayment] = useState(
    Math.min(defaultDownPayment, draft.propertyTotal || 1_200_000),
  );
  const [rate, setRate] = useMortgageInput("rate", 5.8);
  const [months, setMonths] = useMortgageInput("months", 360);
  const [monthlyTarget, setMonthlyTarget] = useMortgageInput("monthlyTarget", 8500);
  const [oneOffAmount, setOneOffAmount] = useMortgageInput("oneOffAmount", 0);
  const [oneOffMonth, setOneOffMonth] = useMortgageInput("oneOffMonth", 1);
  const [strategy, setStrategy] = useMortgageInput<"shorten" | "lower_payment">(
    "strategy",
    "lower_payment",
  );
  const [rateChangeMonth, setRateChangeMonth] = useMortgageInput("rateChangeMonth", 13);
  const [rateAfterChange, setRateAfterChange] = useMortgageInput("rateAfterChange", 4.8);
  const [rateChangeEnabled, setRateChangeEnabled] = useMortgageInput("rateChangeEnabled", false);
  const [rateTransitionMonths, setRateTransitionMonths] = useMortgageInput(
    "rateTransitionMonths",
    12,
  );
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [showBaselineSchedule, setShowBaselineSchedule] = useState(false);
  const [insurancePresetKey, setInsurancePresetKey] = useMortgageInput<
    MortgageInsurancePreset["key"]
  >("insurancePresetKey", "ing_basic");
  const [includeLifeInsurance, setIncludeLifeInsurance] = useMortgageInput(
    "includeLifeInsurance",
    true,
  );
  const [includePropertyInsurance, setIncludePropertyInsurance] = useMortgageInput(
    "includePropertyInsurance",
    true,
  );
  const [marketType, setMarketType] = useMortgageInput<"primary" | "secondary">(
    "marketType",
    "secondary",
  );
  const [firstHomeExemption, setFirstHomeExemption] = useMortgageInput("firstHomeExemption", false);
  const [customCommission, setCustomCommission] = useMortgageInput("customCommission", 0);
  const [customValuation, setCustomValuation] = useMortgageInput("customValuation", 500);
  const [customLifeRate, setCustomLifeRate] = useMortgageInput("customLifeRate", 0.035);
  const [customPropertyRate, setCustomPropertyRate] = useMortgageInput("customPropertyRate", 0.01);
  const [monthlyAccountFee, setMonthlyAccountFee] = useMortgageInput("monthlyAccountFee", 0);

  useEffect(() => {
    if (draft.propertyTotal > 0) {
      setPropertyTotal(draft.propertyTotal);
      setDownPayment(Math.min(defaultDownPayment, draft.propertyTotal));
    }
  }, [draft.propertyTotal, draft.listingId]);

  useEffect(
    () => setDownPayment(Math.min(defaultDownPayment, propertyTotal)),
    [defaultDownPayment],
  );

  const principal = Math.max(0, propertyTotal - downPayment);
  const rateChange = rateChangeEnabled
    ? { month: rateChangeMonth, rate: rateAfterChange, transitionMonths: rateTransitionMonths }
    : undefined;
  const base = calculateMortgage(principal, rate, months, 0, 0, 1, "shorten", rateChange);
  const monthlyExtra = Math.max(0, monthlyTarget - base.basePayment);
  const modified = calculateMortgage(
    principal,
    rate,
    months,
    monthlyExtra,
    oneOffAmount,
    oneOffMonth,
    strategy,
    rateChange,
  );
  const chartPoints = modified.rows.filter(
    (row) => row.month === 1 || row.month % 12 === 0 || row.balance === 0,
  );
  const customPreset: MortgageInsurancePreset = {
    key: "custom",
    label: "Własny bank",
    description: "Własne parametry",
    commissionRate: customCommission / 100,
    valuationFee: customValuation,
    lifeMonthlyRate: customLifeRate / 100,
    propertyMonthlyRate: customPropertyRate / 100,
  };
  const insurancePreset =
    insurancePresetKey === "custom"
      ? customPreset
      : (mortgageInsurancePresets.find((preset) => preset.key === insurancePresetKey) ??
        mortgageInsurancePresets[0]);
  const bankCosts = calculateBankCosts({
    principal,
    rows: modified.rows,
    preset: insurancePreset,
    includeLife: includeLifeInsurance,
    includeProperty: includePropertyInsurance,
  });
  const purchaseCosts = calculatePurchaseCosts({
    propertyPrice: propertyTotal,
    marketType,
    firstHomeExemption,
  });
  const cashAtStart = Math.min(downPayment, propertyTotal) + purchaseCosts.total + bankCosts.oneOff;
  const accountCosts = principal > 0 ? monthlyAccountFee * modified.rows.length : 0;
  const additionalCosts =
    purchaseCosts.total + bankCosts.oneOff + bankCosts.insuranceTotal + accountCosts;
  const bankComparisons = mortgageInsurancePresets
    .map((preset) => {
      const selected = preset.key === "custom" ? customPreset : preset;
      const costs = calculateBankCosts({
        principal,
        rows: modified.rows,
        preset: selected,
        includeLife: includeLifeInsurance,
        includeProperty: includePropertyInsurance,
      });
      return {
        key: preset.key,
        label: preset.label,
        first:
          base.basePayment + costs.firstInsuranceMonthly + (principal > 0 ? monthlyAccountFee : 0),
        upfront: costs.oneOff,
        total: modified.interest + costs.oneOff + costs.insuranceTotal + accountCosts,
      };
    })
    .sort((a, b) => a.total - b.total);
  const rateScenarios = [-2, -1, 0, 1, 2].map((delta) => {
    const scenarioRate = Math.max(0, rate + delta);
    const loan = calculateMortgage(principal, scenarioRate, months, 0, 0, 1, "shorten");
    return { delta, rate: scenarioRate, payment: loan.basePayment, interest: loan.interest };
  });

  return (
    <section className="mortgage-page">
      <div className="panel mortgage-header">
        <div>
          <p className="eyebrow">Finansowanie</p>
          <h2>Kalkulator kredytowy</h2>
          <p className="muted">
            Raty równe. Wybierz skrócenie okresu lub obniżenie raty i uwzględnij koszty wybranego
            scenariusza banku.
          </p>
          {draft.listingTitle ? (
            <p className="mortgage-source">Z oferty: {draft.listingTitle}</p>
          ) : null}
        </div>
      </div>
      {draft.listingTitle ? (
        <button
          className="action-button secondary-button mortgage-back-button"
          type="button"
          onClick={onBackToListing}
        >
          Wróć do oferty: {draft.listingTitle}
        </button>
      ) : null}
      <section className="mortgage-explainer" aria-label="Jak czytać kalkulator">
        <article>
          <span>1</span>
          <div>
            <strong>Ustal finansowanie</strong>
            <small>Cena całkowita minus wkład własny daje kwotę kredytu.</small>
          </div>
        </article>
        <article>
          <span>2</span>
          <div>
            <strong>Podaj budżet miesięczny</strong>
            <small>
              Nadwyżka ponad pierwszą ratę ustala stałą nadpłatę. Po zmianie stopy lub raty łączna
              wpłata może się zmienić.
            </small>
          </div>
        </article>
        <article>
          <span>3</span>
          <div>
            <strong>Porównaj scenariusze</strong>
            <small>Zobacz koszt odsetek, zmianę raty i moment całkowitej spłaty.</small>
          </div>
        </article>
      </section>
      <section className="panel mortgage-full-costs">
        <div className="section-topline mortgage-full-costs-heading">
          <div>
            <p className="eyebrow">Pełny koszt transakcji</p>
            <h3>Bank, notariusz i opłaty urzędowe</h3>
            <p className="muted">
              Zapisane profile banków to przykładowe założenia, nie bieżące oferty. Własne parametry
              przepisz z oferty banku.
            </p>
          </div>
          <span className="costs-reference-badge">Założenia symulacji</span>
        </div>
        <div className="mortgage-cost-options">
          <label className="detail-field">
            <span>Scenariusz banku</span>
            <select
              className="text-input"
              value={insurancePresetKey}
              onChange={(event) =>
                setInsurancePresetKey(event.target.value as MortgageInsurancePreset["key"])
              }
            >
              {mortgageInsurancePresets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
            <small>{insurancePreset.description}</small>
          </label>
          <label className="detail-field">
            <span>Rynek</span>
            <select
              className="text-input"
              value={marketType}
              onChange={(event) => setMarketType(event.target.value as "primary" | "secondary")}
            >
              <option value="secondary">Wtórny</option>
              <option value="primary">Pierwotny</option>
            </select>
            <small>PCC 2% dotyczy zasadniczo rynku wtórnego.</small>
          </label>
          <div className="mortgage-cost-toggles">
            <label className={includeLifeInsurance ? "is-active" : ""}>
              <input
                type="checkbox"
                checked={includeLifeInsurance}
                onChange={(event) => setIncludeLifeInsurance(event.target.checked)}
              />{" "}
              Polisa na życie
            </label>
            <label className={includePropertyInsurance ? "is-active" : ""}>
              <input
                type="checkbox"
                checked={includePropertyInsurance}
                onChange={(event) => setIncludePropertyInsurance(event.target.checked)}
              />{" "}
              Ubezpieczenie lokalu
            </label>
            <label className={firstHomeExemption ? "is-active" : ""}>
              <input
                type="checkbox"
                checked={firstHomeExemption}
                onChange={(event) => setFirstHomeExemption(event.target.checked)}
                disabled={marketType === "primary"}
              />{" "}
              Pierwsze mieszkanie — zwolnienie PCC
            </label>
          </div>
        </div>
        {insurancePresetKey === "custom" ? (
          <div className="mortgage-custom-fields">
            <MortgageInput
              label="Prowizja banku (%)"
              value={customCommission}
              onChange={setCustomCommission}
            />
            <MortgageInput
              label="Wycena (zł)"
              value={customValuation}
              onChange={setCustomValuation}
            />
            <MortgageInput
              label="Życie (% salda / miesiąc)"
              value={customLifeRate}
              onChange={setCustomLifeRate}
            />
            <MortgageInput
              label="Lokal (% kredytu / miesiąc)"
              value={customPropertyRate}
              onChange={setCustomPropertyRate}
            />
          </div>
        ) : null}
        <MortgageInput
          label="Konto i karta / miesiąc (zł, wspólne założenie porównania)"
          value={monthlyAccountFee}
          onChange={setMonthlyAccountFee}
        />
        <div className="mortgage-total-cards">
          <article>
            <span>Rata bankowa</span>
            <strong>{formatPln(base.basePayment)}</strong>
            <small>bez dobrowolnych polis</small>
          </article>
          <article className="is-highlight">
            <span>Pierwszy miesiąc z polisami i kontem</span>
            <strong>
              {formatPln(
                base.basePayment +
                  bankCosts.firstInsuranceMonthly +
                  (principal > 0 ? monthlyAccountFee : 0),
              )}
            </strong>
            <small>polisy: ok. {formatPln(bankCosts.firstInsuranceMonthly)} / mies.</small>
          </article>
          <article>
            <span>Gotówka potrzebna na start</span>
            <strong>{formatPln(cashAtStart)}</strong>
            <small>
              wkład {formatPln(Math.min(downPayment, propertyTotal))} + opłaty jednorazowe
            </small>
          </article>
          <article>
            <span>Dodatkowe koszty łącznie</span>
            <strong>{formatPln(additionalCosts)}</strong>
            <small>formalności, bank i polisy w okresie spłaty</small>
          </article>
        </div>
        <dl className="mortgage-cost-breakdown">
          <div>
            <dt>Notariusz — taksa maks. brutto</dt>
            <dd>{formatPln(purchaseCosts.notaryMaximumGross)}</dd>
          </div>
          <div>
            <dt>Wypisy aktu (założenie: 4 × 10 stron)</dt>
            <dd>{formatPln(purchaseCosts.copiesGross)}</dd>
          </div>
          <div>
            <dt>Wniosek do księgi przez notariusza</dt>
            <dd>{formatPln(purchaseCosts.landRegisterApplicationGross)}</dd>
          </div>
          <div>
            <dt>PCC od zakupu</dt>
            <dd>{purchaseCosts.purchaseTax > 0 ? formatPln(purchaseCosts.purchaseTax) : "0 zł"}</dd>
          </div>
          <div>
            <dt>Wpis własności + odpis KW</dt>
            <dd>{formatPln(purchaseCosts.ownershipEntry + purchaseCosts.landRegisterExtract)}</dd>
          </div>
          <div>
            <dt>Prowizja banku</dt>
            <dd>{formatPln(bankCosts.commission)}</dd>
          </div>
          <div>
            <dt>Konto i karta przez okres spłaty</dt>
            <dd>{formatPln(accountCosts)}</dd>
          </div>
          <div>
            <dt>Wycena bankowa</dt>
            <dd>{formatPln(bankCosts.valuation)}</dd>
          </div>
          <div>
            <dt>Wpis hipoteki + PCC-3</dt>
            <dd>{formatPln(bankCosts.mortgageEntry + bankCosts.mortgageTax)}</dd>
          </div>
          <div>
            <dt>Polisy przez cały okres symulacji</dt>
            <dd>{formatPln(bankCosts.insuranceTotal)}</dd>
          </div>
        </dl>
        <p className="mortgage-cost-disclaimer">
          To symulacja budżetowa, nie oferta banku ani wycena kancelarii. Bank może doliczyć
          prowizję, konto lub kartę zgodnie z konkretnym ESIS; kancelaria może ustalić taksę niższą
          od maksimum.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">Porównanie scenariuszy banku</p>
        <h3>Ile kosztują dodatki do kredytu</h3>
        <p className="muted">
          Wspólne oprocentowanie {rate}%, nadpłaty, okres i wybrane polisy. Koszt finansowania =
          odsetki + bank + polisy + konto; bez kapitału i kosztów zakupu. Brak polis w profilu nie
          oznacza zwolnienia z wymagań banku.
        </p>
        <div className="mortgage-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scenariusz</th>
                <th>Pierwsza rata + dodatki</th>
                <th>Bank na start</th>
                <th>Koszt finansowania</th>
                <th>Wybór</th>
              </tr>
            </thead>
            <tbody>
              {bankComparisons.map((scenario) => (
                <tr
                  key={scenario.key}
                  className={scenario.key === insurancePresetKey ? "is-selected" : ""}
                >
                  <td>{scenario.label}</td>
                  <td>{formatPln(scenario.first)}</td>
                  <td>{formatPln(scenario.upfront)}</td>
                  <td>{formatPln(scenario.total)}</td>
                  <td>
                    <button
                      className="action-button secondary-button"
                      aria-pressed={scenario.key === insurancePresetKey}
                      onClick={() => setInsurancePresetKey(scenario.key)}
                    >
                      {scenario.key === insurancePresetKey ? "Wybrany" : "Wybierz"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Wrażliwość na oprocentowanie</p>
        <h3>Co zmienia różnica 1–2 punktów procentowych</h3>
        <p className="muted">
          Osobne scenariusze stałej stopy przez cały okres, bez nadpłat i opłat dodatkowych.
        </p>
        <div className="rate-scenario-grid">
          {rateScenarios.map((scenario) => (
            <article className="insight-category" key={scenario.delta}>
              <span>
                {scenario.delta === 0
                  ? "Bazowe"
                  : `${scenario.delta > 0 ? "+" : ""}${scenario.delta} p.p.`}{" "}
                · {scenario.rate.toLocaleString("pl-PL")}%
              </span>
              <strong className="insight-number">{formatPln(scenario.payment)}</strong>
              <small>odsetki łącznie: {formatPln(scenario.interest)}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="panel mortgage-cost-structure">
        <h3>Struktura kosztów</h3>
        <div className="mortgage-donuts">
          <MortgageDonut
            label="Bez nadpłat"
            principal={principal}
            interest={base.interest}
            extra={0}
          />
          <MortgageDonut
            label="Po nadpłatach"
            principal={principal}
            interest={modified.interest}
            extra={modified.rows.reduce((sum, row) => sum + row.extra, 0)}
          />
        </div>
      </section>
      <div className="mortgage-layout">
        <section className="panel mortgage-form">
          <h3>Podstawowe dane</h3>
          <MortgageInput
            label="Cena całkowita zakupu"
            value={propertyTotal}
            onChange={setPropertyTotal}
          />
          <div>
            <MortgageInput label="Wkład własny" value={downPayment} onChange={setDownPayment} />
            <small>Domyślnie z Preferencji wyszukiwania.</small>
            {downPayment !== defaultDownPayment && (
              <button
                type="button"
                className="action-button secondary-button"
                disabled={savingSettings}
                onClick={() => void onSaveDownPayment(downPayment)}
              >
                {savingSettings ? "Zapisywanie…" : "Zapisz wkład w preferencjach"}
              </button>
            )}
            {settingsError && (
              <p role="alert" className="error-text">
                {settingsError}
              </p>
            )}
          </div>
          <MortgageInput label="Oprocentowanie roczne (%)" value={rate} onChange={setRate} />
          <MortgageInput label="Liczba rat" value={months} onChange={setMonths} integer />
          <MortgageInput
            label="Rata + miesięczna nadpłata"
            value={monthlyTarget}
            onChange={setMonthlyTarget}
          />
          <hr />
          <h3>Jednorazowa nadpłata</h3>
          <label className="detail-field">
            <span>Efekt nadpłaty</span>
            <select
              className="text-input"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as "shorten" | "lower_payment")}
            >
              <option value="shorten">Skróć okres kredytu</option>
              <option value="lower_payment">Obniż ratę (nadpłaty mogą skrócić okres)</option>
            </select>
          </label>
          <fieldset className="rate-change-box">
            <legend>
              <label>
                <input
                  type="checkbox"
                  checked={rateChangeEnabled}
                  onChange={(event) => setRateChangeEnabled(event.target.checked)}
                />{" "}
                Symuluj zmianę oprocentowania
              </label>
            </legend>
            {rateChangeEnabled ? (
              <>
                <MortgageInput
                  label="Docelowe oprocentowanie (%)"
                  value={rateAfterChange}
                  onChange={setRateAfterChange}
                />
                <MortgageInput
                  label="Zmiana od miesiąca"
                  value={rateChangeMonth}
                  onChange={setRateChangeMonth}
                  integer
                />
                <MortgageInput
                  label="Okres płynnej zmiany (mies.)"
                  value={rateTransitionMonths}
                  onChange={setRateTransitionMonths}
                  integer
                />
              </>
            ) : (
              <p className="muted">Np. spadek z 5,8% do 4,8% rozłożony na 12 miesięcy.</p>
            )}
          </fieldset>
          <MortgageInput label="Kwota" value={oneOffAmount} onChange={setOneOffAmount} />
          <MortgageInput label="Miesiąc" value={oneOffMonth} onChange={setOneOffMonth} integer />
        </section>
        <section className="mortgage-results">
          <div className="mortgage-stat-grid">
            <MortgageStat label="Kredyt" value={formatPln(principal)} />
            <MortgageStat label="Pierwsza rata" value={formatPln(base.basePayment)} />
            <MortgageStat
              label="Nadpłata / mies."
              value={formatPln(Math.max(0, monthlyTarget - base.basePayment))}
            />
            <MortgageStat label="Po nadpłatach" value={`${modified.rows.length} rat`} />
          </div>
          <div className="panel">
            <h3>Kredyt wyjściowy vs po nadpłatach</h3>
            <div className="mortgage-compare">
              <p>
                <span>Bez nadpłat</span>
                <strong>{formatPln(base.totalPaid)}</strong>
                <small>odsetki: {formatPln(base.interest)}</small>
              </p>
              <p>
                <span>Po nadpłatach</span>
                <strong>{formatPln(modified.totalPaid)}</strong>
                <small>odsetki: {formatPln(modified.interest)}</small>
              </p>
              <p>
                <span>Oszczędność</span>
                <strong>{formatPln(Math.max(0, base.interest - modified.interest))}</strong>
                <small>{Math.max(0, months - modified.rows.length)} rat krócej</small>
              </p>
            </div>
          </div>
          <div className="panel">
            <h3>Spadek kapitału</h3>
            <svg
              className="mortgage-chart"
              viewBox="0 0 600 160"
              role="img"
              aria-label="Wykres pozostałego kapitału po nadpłatach"
            >
              <polyline
                fill="none"
                stroke="#1f6f5f"
                strokeWidth="4"
                points={chartPoints
                  .map(
                    (row, index) =>
                      `${(index / Math.max(1, chartPoints.length - 1)) * 580 + 10},${145 - (row.balance / Math.max(1, principal)) * 130}`,
                  )
                  .join(" ")}
              />
            </svg>
          </div>
        </section>
      </div>
      <MortgageSavings base={base} modified={modified} months={months} strategy={strategy} />
      <Suspense
        fallback={
          <section className="panel mortgage-chart-loading">
            <LoaderCircle className="icon-spin" aria-hidden="true" /> Przygotowuję wykresy…
          </section>
        }
      >
        <PremiumMortgageVisuals principal={principal} base={base} modified={modified} />
      </Suspense>
      <section className="panel mortgage-schedule">
        <div className="section-topline">
          <div>
            <h3>
              {showBaselineSchedule ? "Harmonogram bez nadpłat" : "Harmonogram rat po nadpłatach"}
            </h3>
            <p className="muted">
              {showBaselineSchedule
                ? "Bazowy plan spłaty dla porównania."
                : "Plan po wybranych nadpłatach."}
            </p>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={showBaselineSchedule}
              onChange={(event) => setShowBaselineSchedule(event.target.checked)}
            />{" "}
            Pokaż bez nadpłat
          </label>
        </div>
        <div className="mortgage-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nr</th>
                <th>Rata</th>
                <th>Odsetki</th>
                <th>Kapitał</th>
                <th>Nadpłata</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {(showAllInstallments
                ? showBaselineSchedule
                  ? base.rows
                  : modified.rows
                : (showBaselineSchedule ? base.rows : modified.rows).slice(0, 120)
              ).map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{formatPln(row.payment)}</td>
                  <td>{formatPln(row.interest)}</td>
                  <td>{formatPln(row.principal)}</td>
                  <td>{formatPln(row.extra)}</td>
                  <td>{formatPln(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(showBaselineSchedule ? base.rows : modified.rows).length > 120 ? (
          <div className="mortgage-schedule-toggle">
            <p className="muted">
              {showAllInstallments
                ? `Pokazano wszystkie ${(showBaselineSchedule ? base.rows : modified.rows).length} rat.`
                : `Pokazano pierwsze 120 z ${(showBaselineSchedule ? base.rows : modified.rows).length} rat.`}
            </p>
            <button
              className="action-button secondary-button"
              type="button"
              onClick={() => setShowAllInstallments((current) => !current)}
            >
              {showAllInstallments ? "Pokaż skrócony harmonogram" : "Pokaż wszystkie raty"}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}

export function MortgageSavings({
  base,
  modified,
  months,
  strategy,
}: {
  base: ReturnType<typeof calculateMortgage>;
  modified: ReturnType<typeof calculateMortgage>;
  months: number;
  strategy: "shorten" | "lower_payment";
}) {
  const savedInterest = Math.max(0, base.interest - modified.interest);
  const savedMonths = Math.max(0, months - modified.rows.length);
  const loweredPayment = Math.max(
    0,
    base.basePayment - (modified.rows[1]?.payment ?? modified.basePayment),
  );
  return (
    <section className="mortgage-savings">
      <article>
        <span>Oszczędność na odsetkach</span>
        <strong>{formatPln(savedInterest)}</strong>
        <small>mniej pieniędzy dla banku</small>
      </article>
      <article>
        <span>
          {strategy === "lower_payment" ? "Rata po pierwszej nadpłacie" : "Krótszy okres"}
        </span>
        <strong>
          {strategy === "lower_payment"
            ? formatPln(modified.rows[1]?.payment ?? modified.basePayment)
            : `${savedMonths} mies.`}
        </strong>
        <small>
          {strategy === "lower_payment"
            ? `${formatPln(loweredPayment)} mniej niż rata wyjściowa`
            : "przy stałej racie i nadpłacie"}
        </small>
      </article>
      <article>
        <span>Łączny koszt po zmianach</span>
        <strong>{formatPln(modified.totalPaid)}</strong>
        <small>kapitał, odsetki i wszystkie nadpłaty</small>
      </article>
    </section>
  );
}

export function MortgageDonut({
  label,
  principal,
  interest,
  extra,
}: {
  label: string;
  principal: number;
  interest: number;
  extra: number;
}) {
  const total = Math.max(1, principal + interest);
  const capitalSlice = (principal / total) * 100;
  return (
    <div className="mortgage-donut-card">
      <div
        className="mortgage-donut"
        style={{
          background: `conic-gradient(#1f6f5f 0 ${capitalSlice}%, #d8954c ${capitalSlice}% 100%)`,
        }}
      >
        <span>{formatPln(total)}</span>
      </div>
      <strong>{label}</strong>
      <small>
        <i className="legend-capital" /> Kapitał: {formatPln(principal)}
      </small>
      <small>
        <i className="legend-interest" /> Odsetki: {formatPln(interest)}
      </small>
      {extra > 0 ? <small>Nadpłaty: {formatPln(extra)}</small> : null}
    </div>
  );
}

export function MortgageInput({
  label,
  value,
  onChange,
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  integer?: boolean;
}) {
  return (
    <label className="detail-field">
      <span>{label}</span>
      <input
        className="text-input"
        inputMode="decimal"
        value={String(value)}
        onChange={(event) =>
          onChange(
            Math.max(
              0,
              integer
                ? Math.round(Number(event.target.value.replace(",", ".")))
                : Number(event.target.value.replace(",", ".")),
            ) || 0,
          )
        }
      />
    </label>
  );
}

export function MortgageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mortgage-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
