export type MortgageInsurancePreset = {
  key: "ing_basic" | "ing_extended" | "pko_example" | "none" | "custom";
  label: string;
  description: string;
  lifeMonthlyRate: number;
  propertyMonthlyRate: number;
  valuationFee: number;
  commissionRate: number;
};

export const mortgageInsurancePresets: MortgageInsurancePreset[] = [
  {
    key: "custom",
    label: "Własny bank · parametry z oferty",
    description:
      "Wpisz oprocentowanie, prowizję, wycenę i miesięczne stawki polis z formularza banku.",
    lifeMonthlyRate: 0,
    propertyMonthlyRate: 0,
    valuationFee: 0,
    commissionRate: 0,
  },
  {
    key: "ing_basic",
    label: "ING · wariant podstawowy",
    description: "Życie 0,035% salda / mies., nieruchomość 0,0096% kwoty kredytu / mies.",
    lifeMonthlyRate: 0.00035,
    propertyMonthlyRate: 0.000096,
    valuationFee: 560,
    commissionRate: 0,
  },
  {
    key: "ing_extended",
    label: "ING · wariant rozszerzony",
    description: "Życie 0,055% salda / mies., nieruchomość 0,0228% kwoty kredytu / mies.",
    lifeMonthlyRate: 0.00055,
    propertyMonthlyRate: 0.000228,
    valuationFee: 560,
    commissionRate: 0,
  },
  {
    key: "pko_example",
    label: "PKO BP · przykład reprezentatywny",
    description: "Życie 0,035% salda / mies.; polisa nieruchomości oszacowana z przykładu banku.",
    lifeMonthlyRate: 0.00035,
    propertyMonthlyRate: 7_900 / 395_000 / 300,
    valuationFee: 400,
    commissionRate: 0,
  },
  {
    key: "none",
    label: "Bez polis bankowych",
    description: "Tylko rata kredytu i obowiązkowe koszty formalne.",
    lifeMonthlyRate: 0,
    propertyMonthlyRate: 0,
    valuationFee: 0,
    commissionRate: 0,
  },
];

export type MortgageBalanceRow = { balance: number; principal: number; extra: number };

export function calculateBankCosts(input: {
  principal: number;
  rows: MortgageBalanceRow[];
  preset: MortgageInsurancePreset;
  includeLife: boolean;
  includeProperty: boolean;
}) {
  if (input.principal <= 0)
    return {
      firstInsuranceMonthly: 0,
      lifeTotal: 0,
      propertyTotal: 0,
      commission: 0,
      valuation: 0,
      mortgageTax: 0,
      mortgageEntry: 0,
      oneOff: 0,
      insuranceTotal: 0,
    };
  const firstOpeningBalance = input.rows[0]
    ? input.rows[0].balance + input.rows[0].principal + input.rows[0].extra
    : input.principal;
  const lifeTotal = input.includeLife
    ? input.rows.reduce(
        (sum, row) =>
          sum + (row.balance + row.principal + row.extra) * input.preset.lifeMonthlyRate,
        0,
      )
    : 0;
  const propertyMonthly = input.includeProperty
    ? input.principal * input.preset.propertyMonthlyRate
    : 0;
  const propertyTotal = propertyMonthly * input.rows.length;
  const commission = input.principal * input.preset.commissionRate;
  const firstLife = input.includeLife ? firstOpeningBalance * input.preset.lifeMonthlyRate : 0;
  const mortgageTax = input.principal > 0 ? 19 : 0;
  const mortgageEntry = input.principal > 0 ? 200 : 0;
  const oneOff = input.preset.valuationFee + commission + mortgageTax + mortgageEntry;

  return {
    firstInsuranceMonthly: firstLife + propertyMonthly,
    lifeTotal,
    propertyTotal,
    commission,
    valuation: input.preset.valuationFee,
    mortgageTax,
    mortgageEntry,
    oneOff,
    insuranceTotal: lifeTotal + propertyTotal,
  };
}

export function calculateNotaryMaximumNet(propertyPrice: number) {
  const price = Math.max(0, propertyPrice);
  if (price === 0) return 0;
  let scale = 0;
  if (price <= 3_000) scale = 100;
  else if (price <= 10_000) scale = 100 + (price - 3_000) * 0.03;
  else if (price <= 30_000) scale = 310 + (price - 10_000) * 0.02;
  else if (price <= 60_000) scale = 710 + (price - 30_000) * 0.01;
  else if (price <= 1_000_000) scale = 1_010 + (price - 60_000) * 0.004;
  else if (price <= 2_000_000) scale = 4_770 + (price - 1_000_000) * 0.002;
  else scale = Math.min(10_000, 6_770 + (price - 2_000_000) * 0.0025);
  return scale / 2;
}

export function calculatePurchaseCosts(input: {
  propertyPrice: number;
  marketType: "primary" | "secondary";
  firstHomeExemption: boolean;
  copyPages?: number;
  copySets?: number;
}) {
  if (input.propertyPrice <= 0) {
    return {
      notaryMaximumGross: 0,
      copiesGross: 0,
      landRegisterApplicationGross: 0,
      purchaseTax: 0,
      ownershipEntry: 0,
      landRegisterExtract: 0,
      total: 0,
    };
  }
  const vatRate = 0.23;
  const notaryNet = calculateNotaryMaximumNet(input.propertyPrice);
  const copiesNet = Math.max(0, input.copyPages ?? 10) * Math.max(0, input.copySets ?? 4) * 6;
  const landRegisterApplicationNet = 200;
  const notaryGross = (notaryNet + copiesNet + landRegisterApplicationNet) * (1 + vatRate);
  const purchaseTax =
    input.marketType === "secondary" && !input.firstHomeExemption
      ? Math.max(0, input.propertyPrice) * 0.02
      : 0;
  const ownershipEntry = 200;
  const landRegisterExtract = 30;

  return {
    notaryMaximumGross: notaryNet * (1 + vatRate),
    copiesGross: copiesNet * (1 + vatRate),
    landRegisterApplicationGross: landRegisterApplicationNet * (1 + vatRate),
    purchaseTax,
    ownershipEntry,
    landRegisterExtract,
    total: notaryGross + purchaseTax + ownershipEntry + landRegisterExtract,
  };
}
