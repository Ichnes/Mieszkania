import type { ListingSummary } from "@mieszkania/shared";
import { inferBuildingDetails, statedApartmentArea } from "./listing-description-facts";

export function descriptionDiscrepancies(listing: ListingSummary, description: string) {
  const warnings: string[] = [];
  const area = statedApartmentArea(description);
  const listedArea = Number.parseFloat(listing.areaLabel ?? "");
  if (area !== undefined && Math.abs(area - listedArea) > 1)
    warnings.push(`Metraż w danych oferty: ${listedArea} m². W opisie: ${area} m².`);
  const { floor, yearBuilt } = inferBuildingDetails(description);
  if (listing.yearBuilt != null && yearBuilt != null && yearBuilt !== listing.yearBuilt)
    warnings.push(`Rok budowy w danych oferty: ${listing.yearBuilt}. W opisie: ${yearBuilt}.`);
  const roomCounts = new Set(
    [
      ...description.matchAll(
        /(?:\bliczba pokoi\s*:\s*([1-9])\b|\b(?:do sprzedania|na sprzedaż|sprzedam)\s+mieszkanie\s+([1-9])\s*[-–]?\s*pokojowe\b)/giu,
      ),
    ].map((match) => Number(match[1] ?? match[2])),
  );
  const [rooms] = roomCounts;
  if (roomCounts.size === 1 && listing.roomsCount != null && listing.roomsCount !== rooms)
    warnings.push(`Liczba pokoi w danych oferty: ${listing.roomsCount}. W opisie: ${rooms}.`);
  if (floor != null && listing.floor != null && listing.floor !== floor)
    warnings.push(`Piętro w danych oferty: ${listing.floor}. W opisie: ${floor}.`);
  return warnings;
}
