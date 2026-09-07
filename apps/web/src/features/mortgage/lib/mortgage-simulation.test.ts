import assert from "node:assert/strict";
import test from "node:test";
import { calculateMortgage } from "./mortgage-simulation";

test("zero interest repays capital exactly and zero months stays finite", () => {
  const loan = calculateMortgage(120000, 0, 120, 0);
  assert.equal(loan.basePayment, 1000);
  assert.equal(loan.interest, 0);
  assert.equal(loan.totalPaid, 120000);
  assert.equal(calculateMortgage(120000, 0, 0, 0).totalPaid, 120000);
});
test("lower-payment strategy preserves term after a one-off overpayment", () => {
  const lower = calculateMortgage(500000, 6, 360, 0, 100000, 1, "lower_payment");
  const shorter = calculateMortgage(500000, 6, 360, 0, 100000, 1, "shorten");
  assert.equal(lower.rows.length, 360);
  assert.ok(shorter.rows.length < 360);
  assert.ok(lower.rows[1].payment < lower.basePayment);
  assert.ok(shorter.interest < lower.interest);
  for (const loan of [lower, shorter]) {
    assert.ok(
      Math.abs(loan.rows.reduce((sum, row) => sum + row.principal + row.extra, 0) - 500000) < 0.01,
    );
    assert.ok(loan.rows.at(-1)!.balance < 0.01);
  }
});
test("increased rate recalculates installment and fully repays without a balloon", () => {
  const loan = calculateMortgage(500000, 5, 360, 0, 0, 1, "shorten", {
    month: 61,
    rate: 8,
    transitionMonths: 1,
  });
  assert.ok(loan.rows[60].payment > loan.basePayment);
  assert.ok(loan.rows.at(-1)!.balance < 0.01);
  assert.ok(Math.abs(loan.rows.at(-1)!.payment - loan.rows.at(-2)!.payment) < 0.01);
});
