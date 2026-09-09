import { Select } from "../../components/Select";
import { MortgageComparison } from "./MortgageComparison";
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
  const [firstHomeExemption, setFirstHomeExemption] = useMortgageInput("firstHomeExemption", true);
  const [customCommission, setCustomCommission] = useMortgageInput("customCommission", 0);
  const [customValuation, setCustomValuation] = useMortgageInput("customValuation", 500);
  const [customLifeRate, setCustomLifeRate] = useMortgageInput("customLifeRate", 0.035);
  const [customPropertyRate, setCustomPropertyRate] = useMortgageInput("customPropertyRate", 0.01);

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
  const additionalCosts = purchaseCosts.total + bankCosts.oneOff + bankCosts.insuranceTotal;
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
        first: base.basePayment + costs.firstInsuranceMonthly,
        upfront: costs.oneOff,
        total: modified.interest + costs.oneOff + costs.insuranceTotal,
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
      <section className="panel mortgage-form mortgage-form-horizontal">
        <h3>Podstawowe dane</h3>
        <div className="mortgage-primary-inputs">
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
        </div>
        <h3>Nadpłaty i zmiana oprocentowania</h3>
        <div className="mortgage-extra-inputs">
          <label className="detail-field">
            <span>Efekt nadpłaty</span>
            <Select
              label="Efekt nadpłaty"
              value={strategy}
              onChange={(value) => setStrategy(value as "shorten" | "lower_payment")}
            >
              <option value="shorten">Skróć okres kredytu</option>
              <option value="lower_payment">Obniż ratę (nadpłaty mogą skrócić okres)</option>
            </Select>
          </label>

          <MortgageInput label="Kwota" value={oneOffAmount} onChange={setOneOffAmount} />
          <MortgageInput label="Miesiąc" value={oneOffMonth} onChange={setOneOffMonth} integer />
        </div>
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
      </section>
      <MortgageComparison
        principal={principal}
        monthlyExtra={monthlyExtra}
        base={base}
        modified={modified}
      />
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
            <Select
              label="Scenariusz banku"
              value={insurancePresetKey}
              onChange={(value) => setInsurancePresetKey(value as MortgageInsurancePreset["key"])}
            >
              {mortgageInsurancePresets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </Select>
            <small>{insurancePreset.description}</small>
          </label>
          <label className="detail-field">
            <span>Rynek</span>
            <Select
              label="Rynek"
              value={marketType}
              onChange={(value) => setMarketType(value as "primary" | "secondary")}
            >
              <option value="secondary">Wtórny</option>
              <option value="primary">Pierwotny</option>
            </Select>
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
        <div className="mortgage-total-cards">
          <article className="is-highlight">
            <span>Pierwszy miesiąc z polisami</span>
            <strong>{formatPln(base.basePayment + bankCosts.firstInsuranceMonthly)}</strong>
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
