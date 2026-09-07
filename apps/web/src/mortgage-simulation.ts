export type MortgageRow = { month: number; payment: number; interest: number; principal: number; extra: number; balance: number; annualRate: number };

export function calculateMortgage(principal: number, annualRate: number, months: number, monthlyExtra: number, oneOffAmount = 0, oneOffMonth = 1, strategy: "shorten" | "lower_payment" = "shorten", rateChange?: { month: number; rate: number; transitionMonths: number }) {
  const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  principal = nonNegative(principal);
  annualRate = nonNegative(annualRate);
  months = Math.max(1, Math.min(600, Math.round(nonNegative(months))));
  monthlyExtra = nonNegative(monthlyExtra);
  oneOffAmount = nonNegative(oneOffAmount);
  const annuity = (balance: number, rate: number, count: number) => rate === 0 ? balance / count : balance * rate / (1 - (1 + rate) ** -count);
  const basePayment = annuity(principal, annualRate / 1200, months);
  let balance = principal, interestTotal = 0, totalPaid = 0, scheduledPayment = basePayment, previousRate = annualRate;
  const rows: MortgageRow[] = [];
  for (let month = 1; month <= months && balance > 0.01; month += 1) {
    const progress = rateChange ? Math.min(1, Math.max(0, month - Math.max(1, rateChange.month) + 1) / Math.max(1, rateChange.transitionMonths)) : 0;
    const effectiveRate = rateChange ? annualRate + (nonNegative(rateChange.rate) - annualRate) * progress : annualRate;
    const rate = effectiveRate / 1200;
    if (strategy === "lower_payment" || effectiveRate !== previousRate) scheduledPayment = annuity(balance, rate, months - month + 1);
    previousRate = effectiveRate;
    const interest = balance * rate;
    const capital = month === months ? balance : Math.min(balance, Math.max(0, scheduledPayment - interest));
    const extra = Math.min(Math.max(0, balance - capital), monthlyExtra + (month === oneOffMonth ? oneOffAmount : 0));
    const payment = interest + capital;
    balance = Math.max(0, balance - capital - extra);
    interestTotal += interest;
    totalPaid += payment + extra;
    rows.push({ month, payment, interest, principal: capital, extra, balance, annualRate: effectiveRate });
  }
  return { basePayment, rows, interest: interestTotal, totalPaid };
}
