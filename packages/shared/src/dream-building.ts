import { getSunExposure, type ExposureDirection } from "./sun-exposure.js";

export function getBuildingYearPoints(year: number | undefined, currentYear: number) {
  if (year === undefined || !Number.isFinite(year)) return -3;
  if (year <= 1980) return -4;
  if (year <= 1990) return -2;
  if (year <= 2000) return 0;
  if (year <= 2005) return 4;
  if (year <= 2010) return 6;
  if (year <= 2015) return 8;
  if (year <= 2020) return 10;
  return 12 + (year === currentYear || year === currentYear - 1 ? 2 : 0);
}

export function getFloorPoints(floor?: number, totalFloors?: number, confirmedTopFloor = false) {
  if (floor === undefined || !Number.isFinite(floor)) return confirmedTopFloor ? 12 : 0;
  if (floor <= 0) return -4;
  if (totalFloors !== undefined && Number.isFinite(totalFloors) && totalFloors > 0) {
    if (floor > totalFloors) return 0; // Conflicting facts need correction, not a top-floor bonus.
    return Math.round((9 * floor) / totalFloors) + (floor === totalFloors ? 3 : 0);
  }
  return confirmedTopFloor ? 12 : 0;
}

export function hasApartmentGroundFloor(text: string) {
  const pattern =
    /\b(?:na\s+(?:(?:wysokim|niskim|podwyzszonym|slonecznym)\s+)?parterze|(?:wysoki|niski)\s+parter|pietro\s*[:=-]\s*parter|(?:mieszkanie|lokal)\s+parterow\w*)\b/g;
  return Array.from(text.matchAll(pattern)).some((match) => {
    const sentenceBefore =
      text
        .slice(Math.max(0, match.index! - 80), match.index)
        .split(/[.!?;]/)
        .at(-1) ?? "";
    const apartmentStart = [...sentenceBefore.matchAll(/\b(?:mieszkanie|lokal)\b/g)].at(-1)?.index;
    const before =
      apartmentStart === undefined ? sentenceBefore : sentenceBefore.slice(apartmentStart);
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 100);
    return (
      !/\b(?:nie|bez|sklep\w*|uslug\w*|recepcj\w*|garaz\w*|komork\w*)\b/.test(before) &&
      !/^\s*[,:-]?\s*(?:(?:sa|jest|mieszcza\s+sie|znajduj\w*\s+sie|zlokalizowan\w*)\s+)?(?:(?:lokal\w*|punkt\w*|pomieszczeni\w*)\s+)?(?:sklep\w*|uslug\w*|recepcj\w*|garaz\w*|komork\w*)\b/.test(
        after,
      )
    );
  });
}

export function getExposureEvaluation(description: string, override?: ExposureDirection[]) {
  const exposure = getSunExposure(description, override);
  const sides = exposure.sideCount ?? (exposure.directions.length || undefined);
  const cardinals = [...new Set(exposure.directions.flatMap((direction) => direction.split("")))]
    .sort()
    .join("");
  let points = 0;
  if (sides === 1) {
    const direction = exposure.directions.length === 1 ? exposure.directions[0] : undefined;
    points = direction
      ? (({ S: 4, W: 4, SW: 6, SE: 4, NW: 1, NE: 0, N: -15, E: 2 } as Record<string, number>)[
          direction
        ] ?? -5)
      : -5;
  } else if (sides === 2) {
    points =
      ({ SW: 20, ES: 18, NS: 15, NW: 13, EN: 11, EW: 18 } as Record<string, number>)[cardinals] ??
      10;
  } else if (sides === 3) {
    points = ({ ESW: 20, NSW: 20, ENS: 18, ENW: 18 } as Record<string, number>)[cardinals] ?? 13;
  } else if (sides && sides >= 4) {
    points = 20;
  }
  // Additional exposure can never erase a good pair, including mixed diagonals.
  if (sides && sides >= 2) {
    for (const [pair, bonus] of Object.entries({ SW: 20, ES: 18, NS: 15, NW: 13, EN: 11, EW: 18 }))
      if ([...pair].every((direction) => cardinals.includes(direction)))
        points = Math.max(points, bonus);
  }
  return { ...exposure, sides, points, maxPoints: 20 };
}
