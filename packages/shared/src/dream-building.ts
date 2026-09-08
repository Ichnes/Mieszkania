import { getSunExposure } from "./sun-exposure.js";

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

export function getFloorPoints(floor?: number) {
  if (floor === undefined || !Number.isFinite(floor)) return 0;
  if (floor <= 0) return -4;
  if (floor > 12) return 12;
  return ({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 8 } as Record<number, number>)[floor] ?? 9;
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

export function getExposureEvaluation(description: string) {
  const exposure = getSunExposure(description);
  const sides = exposure.sideCount ?? (exposure.directions.length || undefined);
  const cardinals = [...new Set(exposure.directions.flatMap((direction) => direction.split("")))]
    .sort()
    .join("");
  let points = 0;
  if (sides === 1) {
    const direction = exposure.directions.length === 1 ? exposure.directions[0] : undefined;
    points = direction
      ? (({ S: 4, W: 4, N: -15, E: 2 } as Record<string, number>)[direction] ?? -5)
      : -5;
  } else if (sides === 2) {
    points =
      10 +
      (({ SW: 10, ES: 7, NS: 4, NW: 2, EN: 1, EW: 10 } as Record<string, number>)[cardinals] ?? 0);
  } else if (sides === 3) {
    points = 13 + (({ ESW: 5, NSW: 4, ENS: 3, ENW: 1 } as Record<string, number>)[cardinals] ?? 0);
  }
  return { ...exposure, sides, points, maxPoints: sides && sides <= 3 ? 20 : 0 };
}
