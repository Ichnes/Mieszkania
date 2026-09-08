export const MIN_MARKET_SAMPLE = 10;

export type PriceSampleRow = {
  priced: string;
  median_price: string | null;
  q1: string | null;
  q3: string | null;
};
export function mapPriceSample(row: PriceSampleRow) {
  const pricedListings = Number(row.priced);
  const sufficientSample = pricedListings >= MIN_MARKET_SAMPLE;
  return {
    pricedListings,
    sufficientSample,
    medianPricePerSqm:
      sufficientSample && row.median_price != null ? Number(row.median_price) : null,
    lowerQuartilePricePerSqm: sufficientSample && row.q1 != null ? Number(row.q1) : null,
    upperQuartilePricePerSqm: sufficientSample && row.q3 != null ? Number(row.q3) : null,
  };
}

export const priceSampleSql = `count(*) filter (where l.price_amount>0 and l.area_sqm>0)::text priced,
 percentile_cont(0.5) within group(order by l.price_amount/nullif(l.area_sqm,0)) filter(where l.price_amount>0 and l.area_sqm>0)::text median_price,
 percentile_cont(0.25) within group(order by l.price_amount/nullif(l.area_sqm,0)) filter(where l.price_amount>0 and l.area_sqm>0)::text q1,
 percentile_cont(0.75) within group(order by l.price_amount/nullif(l.area_sqm,0)) filter(where l.price_amount>0 and l.area_sqm>0)::text q3`;
