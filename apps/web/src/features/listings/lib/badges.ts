import type { ListingSummary } from "@mieszkania/shared";
import { cashPurchaseEvidence } from "./purchase-evidence";
export function filterCommercialBadges(badges: string[]) {
  return badges.filter(
    (badge) =>
      badge === "Bez prowizji" ||
      badge === "Z prowizją" ||
      badge === "Oferta pośrednika" ||
      badge === "Oferta prywatna" ||
      badge === "Oferta bezpośrednia",
  );
}

export function filterNonCommercialBadges(badges: string[]) {
  return badges.filter(
    (badge) =>
      !filterCommercialBadges([badge]).length &&
      !filterImageAmenityBadge(badge) &&
      !badge.startsWith("Mieszkanie docelowe:"),
  );
}

export function filterImageAmenityBadge(badge: string) {
  return (
    badge === "Brak garażu" ||
    badge === "Brak miejsca postojowego" ||
    badge === "Prywatne miejsce postojowe" ||
    badge === "Garaż" ||
    badge === "Garaż (platforma)" ||
    badge === "Miejsce na platformie" ||
    badge === "Garaż na wynajem" ||
    badge === "Garaż — najem" ||
    badge === "Garaż — możliwość zakupu" ||
    badge === "Garaż w pobliżu" ||
    badge === "Komórka — najem" ||
    badge === "Parking miejski / przy ulicy" ||
    badge === "Miejsce postojowe na terenie osiedla" ||
    badge === "Naziemne miejsce postojowe" ||
    /^\d+\s+miejsca w garażu$/.test(badge) ||
    /^\d+\s+prywatne miejsca postojowe$/.test(badge) ||
    /^\d+\s+(?:naziemne miejsca postojowe|miejsca postojowe na osiedlu)$/.test(badge) ||
    badge === "Brak windy" ||
    badge === "Stan deweloperski"
  );
}

export function filterImageBadges(badges: string[]) {
  return badges.filter(
    (badge) => filterCommercialBadges([badge]).length > 0 || filterImageAmenityBadge(badge),
  );
}

export function getRcnIndicator(label: string) {
  if (!label || label === "brak danych RCN") return null;
  return label.startsWith("-") ? "is-below" : label.startsWith("+") ? "is-above" : null;
}

export function cardImageBadges(listing: ListingSummary) {
  const conditions = ["Nieuregulowany grunt", "Cesja mieszkania"];
  const parking = (badge: string) => /garaż|postojow|parking|platformie/iu.test(badge);
  const rank = (badge: string) =>
    conditions.includes(badge) ? 0 : /prowizj/iu.test(badge) ? 1 : parking(badge) ? 2 : 3;
  const badges = listing.badges
    .filter((badge) => conditions.includes(badge) || filterImageBadges([badge]).length > 0)
    .sort((left, right) => rank(left) - rank(right));
  const labels = pricedAmenityBadges(listing, badges);
  if (cashPurchaseEvidence(listing.description)) labels.unshift("Tylko gotówka");
  return labels;
}

export function pricedAmenityBadges(listing: ListingSummary, badges: string[]) {
  const parking = (badge: string) => /garaż|postojow|parking|platformie/iu.test(badge);
  const amount = listing.additionalPurchaseCosts?.garage;
  const paidBadge = badges.find(
    (badge) => parking(badge) && !/brak|bez |najem|wynajem|miejski|pobliżu/iu.test(badge),
  );
  return badges.map((badge) => {
    const label =
      badge === "Naziemne miejsce postojowe"
        ? "Miejsce naziemne"
        : badge === "Brak garażu"
          ? "Bez garażu"
          : badge;
    if (badge !== paidBadge || !amount) return label;
    return (
      label +
      " +" +
      (amount % 1000 === 0
        ? (amount / 1000).toLocaleString("pl-PL") + " tys."
        : amount.toLocaleString("pl-PL")) +
      " zł"
    );
  });
}
