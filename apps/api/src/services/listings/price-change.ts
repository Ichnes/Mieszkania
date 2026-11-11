/** Missing-to-known price is data completion, not a price increase. */
export const realPriceChangeSql = `
  pe.event_type in ('price_drop', 'price_increase')
  and pe.previous_price_amount > 0
  and pe.new_price_amount > 0
  and pe.previous_price_amount <> pe.new_price_amount
`;

/** Only established relistings, never unconfirmed candidate matches. */
export const realRelistingPriceChangeSql = `
  lr.previous_price_amount > 0
  and lr.relisted_price_amount > 0
  and lr.previous_price_amount <> lr.relisted_price_amount
`;

export function relistingPriceChange(previous: string | null, next: string | null) {
  const event = {
    event_type: Number(next) < Number(previous) ? "price_drop" : "price_increase",
    previous_price_amount: previous,
    new_price_amount: next,
  };
  return isRealPriceChange(event) ? event : undefined;
}

export function getPriceChangePercent(event?: {
  previous_price_amount: string | null;
  new_price_amount: string | null;
}) {
  const previous = Number(event?.previous_price_amount);
  const next = Number(event?.new_price_amount);
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= 0 || next <= 0) return 0;
  const change = ((next - previous) / previous) * 100;
  const rounded = Number(change.toFixed(1));
  return rounded === 0 && change !== 0 ? Number(change.toPrecision(2)) : rounded;
}

export function isRealPriceChange(event: {
  event_type: string;
  previous_price_amount: string | null;
  new_price_amount: string | null;
}) {
  const previous = Number(event.previous_price_amount);
  const next = Number(event.new_price_amount);
  return (
    ["price_drop", "price_increase"].includes(event.event_type) &&
    Number.isFinite(previous) &&
    Number.isFinite(next) &&
    previous > 0 &&
    next > 0 &&
    previous !== next
  );
}
