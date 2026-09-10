import type { ListingFilters } from "@mieszkania/shared";

export function getActiveFilterBadges(filters: ListingFilters) {
  const badges: string[] = [];

  if (filters.city) badges.push(`Miasto: ${filters.city}`);
  const districts = filters.districts ?? (filters.district ? [filters.district] : []);
  if (districts.length)
    badges.push(
      `Dzielnice: ${districts.map((district) => (district === "__none__" ? "Bez dzielnicy" : district)).join(", ")}`,
    );
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    badges.push(`Cena: ${filters.minPrice ?? 0}-${filters.maxPrice ?? "max"}`);
  if (filters.minArea !== undefined || filters.maxArea !== undefined)
    badges.push(`Metraz: ${filters.minArea ?? 0}-${filters.maxArea ?? "max"} m2`);
  if (filters.minYearBuilt !== undefined || filters.maxYearBuilt !== undefined)
    badges.push(`Rok budowy: ${filters.minYearBuilt ?? "min"}-${filters.maxYearBuilt ?? "max"}`);
  if (filters.roomsMin !== undefined || filters.roomsMax !== undefined)
    badges.push(`Pokoje: ${filters.roomsMin ?? 0}-${filters.roomsMax ?? "max"}`);
  if (filters.search) badges.push(`Fraza: ${filters.search}`);
  if (filters.shortlistedOnly) badges.push("Tylko ulubione");
  if (filters.priceChangedOnly) badges.push("Tylko zmiana ceny");
  if (filters.archivedOnly) badges.push("Tylko archiwalne");
  if (filters.hiddenOnly) badges.push("Tylko ukryte (2 pokoje)");

  return badges;
}

export function buildPageNumbers(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);
  return Array.from(
    { length: end - normalizedStart + 1 },
    (_value, index) => normalizedStart + index,
  );
}
