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
    badge === "Brak miejsca postojowego" ||
    badge === "Prywatne miejsce postojowe" ||
    badge === "Garaż" ||
    badge === "Garaż (platforma)" ||
    badge === "Miejsce na platformie" ||
    badge === "Garaż na wynajem" ||
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
