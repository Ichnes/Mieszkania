import type { ListingSummary } from "@mieszkania/shared";
import { inferBuildingDetails } from "./listing-description-facts";

export function descriptionDiscrepancies(listing: ListingSummary, description: string) {
  const warnings: string[] = [];
  const areas = new Set(
    [
      ...description.matchAll(
        /\b(?:metraż|powierzchnia (?:mieszkania|lokalu))\s*[:–-]\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*m(?:²|2|kw)/giu,
      ),
    ].map((match) => Number(match[1].replace(",", "."))),
  );
  const [area] = areas;
  const listedArea = Number.parseFloat(listing.areaLabel ?? "");
  if (areas.size === 1 && Math.abs(area - listedArea) > 1)
    warnings.push(`Metraż w danych oferty: ${listedArea} m². W opisie: ${area} m².`);
  const floor = inferBuildingDetails(description).floor;
  if (floor != null && listing.floor != null && listing.floor !== floor)
    warnings.push(`Piętro w danych oferty: ${listing.floor}. W opisie: ${floor}.`);
  return warnings;
}
