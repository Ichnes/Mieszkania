import type { ListingDetail } from "@mieszkania/shared";
import { Calculator } from "lucide-react";
import { formatPln, parseNumericLabel } from "../../shared/lib/format";
import { calculateMortgage } from "./lib/mortgage-simulation";

export function MortgageQuickPreview({
  listing,
  downPayment,
}: {
  listing: ListingDetail;
  downPayment: number;
}) {
  const total = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0;
  const principal = Math.max(0, total - downPayment);
  const payment = calculateMortgage(principal, 5.8, 360, 0).basePayment;
  return total > downPayment ? (
    <div className="mortgage-quick-preview">
      <Calculator size={18} aria-hidden="true" />
      <span>Szacowana rata</span>
      <strong>{formatPln(payment)} / mies.</strong>
      <small>{formatPln(downPayment)} wkładu · 5,8% · 360 rat</small>
    </div>
  ) : null;
}
