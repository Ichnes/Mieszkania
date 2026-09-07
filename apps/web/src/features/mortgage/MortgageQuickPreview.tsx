import type { ListingDetail } from "@mieszkania/shared";
import { Calculator } from "lucide-react";
import { formatPln, parseNumericLabel } from "../../shared/lib/format";
import { calculateMortgage } from "./lib/mortgage-simulation";

export function MortgageQuickPreview({ listing }: { listing: ListingDetail }) {
  const total = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel) ?? 0;
  const principal = Math.max(0, total - 400_000);
  const payment = calculateMortgage(principal, 5.8, 360, 0).basePayment;
  return total > 400_000 ? (
    <div className="mortgage-quick-preview">
      <Calculator size={18} aria-hidden="true" />
      <span>Rata od</span>
      <strong>{formatPln(payment)} / mies.</strong>
      <small>400 tys. wkładu · 5,8% · 360 rat</small>
    </div>
  ) : null;
}
