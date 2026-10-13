/** Missing-to-known price is data completion, not a price increase. */
export const realPriceChangeSql = `
  pe.event_type in ('price_drop', 'price_increase')
  and pe.previous_price_amount > 0
  and pe.new_price_amount > 0
  and pe.previous_price_amount <> pe.new_price_amount
`;

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
