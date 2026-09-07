import assert from "node:assert/strict";
import test from "node:test";
import { calculateBankCosts, calculateNotaryMaximumNet, calculatePurchaseCosts, mortgageInsurancePresets } from "./mortgage-costs";

test("cash purchase has no loan valuation, policies or mortgage fees", () => {
  const result = calculateBankCosts({ principal: 0, rows: [], preset: mortgageInsurancePresets.find((item) => item.key === "ing_basic")!, includeLife: true, includeProperty: true });
  assert.equal(result.oneOff, 0);
  assert.equal(result.valuation, 0);
  assert.equal(result.insuranceTotal, 0);
});

test("custom commission and valuation are included in upfront bank costs", () => {
  const preset = { ...mortgageInsurancePresets.find((item) => item.key === "custom")!, commissionRate: 0.02, valuationFee: 500 };
  const costs = calculateBankCosts({ principal: 500000, rows: [], preset, includeLife: false, includeProperty: false });
  assert.equal(costs.commission, 10000);
  assert.equal(costs.oneOff, 10719);
});

test("uses half of the statutory notarial scale for a residential sale", () => {
  assert.equal(calculateNotaryMaximumNet(800_000), 1_985);
  assert.equal(calculateNotaryMaximumNet(1_500_000), 2_885);
});

test("applies PCC only to a non-exempt secondary-market purchase", () => {
  const taxed = calculatePurchaseCosts({ propertyPrice: 800_000, marketType: "secondary", firstHomeExemption: false });
  const exempt = calculatePurchaseCosts({ propertyPrice: 800_000, marketType: "secondary", firstHomeExemption: true });
  assert.equal(taxed.purchaseTax, 16_000);
  assert.equal(exempt.purchaseTax, 0);
  assert.ok(taxed.total > exempt.total);
});

test("bank scenario includes declining-balance life insurance and fixed property insurance", () => {
  const preset = mortgageInsurancePresets.find((item) => item.key === "ing_basic")!;
  const result = calculateBankCosts({
    principal: 100_000,
    rows: [{ balance: 99_000, principal: 1_000, extra: 0 }, { balance: 98_000, principal: 1_000, extra: 0 }],
    preset,
    includeLife: true,
    includeProperty: true
  });
  assert.equal(result.firstInsuranceMonthly, 44.6);
  assert.equal(result.mortgageTax, 19);
  assert.equal(result.mortgageEntry, 200);
});
