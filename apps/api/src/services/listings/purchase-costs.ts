import { extractParkingSpaceCount } from "./parking-count";

export type PurchaseCosts = {
  parkingCount?: number;
  parkingUnitPrice?: number;
  garage?: number;
  storage?: number;
  garden?: number;
  garageAndStorage?: number;
  garageIncluded?: boolean;
  storageIncluded?: boolean;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
}
function amenities(text: string) {
  return {
    garage: /garaz\w*|miejsc\w*\s+(?:postojow\w*|parkingow\w*|w\s+garaz\w*|z\s+komork\w*)/.test(
      text,
    ),
    storage: /komork\w*|piwnic\w*|box\w*\s+lokatorsk\w*/.test(text),
    garden: /ogrod(?:ek|ka|kiem|ku)\b/.test(text),
  };
}

export function extractAdditionalPurchaseCosts(description: string): PurchaseCosts {
  const text = normalize(description.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
  const result: PurchaseCosts = {};
  let previousEnd = 0;
  let indoorParking: number | undefined;
  let otherParking: number | undefined;
  for (const match of text.matchAll(
    /(\d{1,3}(?:[ .]\d{3})+|\d{1,7})(?:,(\d{1,2}))?\s*(tys(?:iecy|\.)?\b|pln\b|zl\b|,\s*-|(?=za\s+(?:jedno\s+)?miejsce\b))/g,
  )) {
    const index = match.index!;
    const before = text
      .slice(Math.max(previousEnd, index - 400), index)
      .split(/[.!?](?!\d)/)
      .at(-1)!;
    const after = text.slice(index + match[0].length, index + match[0].length + 70);
    previousEnd = index + match[0].length;
    const mentioned = amenities(before);
    if (!mentioned.garage && !mentioned.storage && !mentioned.garden) continue;
    // A price for the apartment together with an amenity is the total, not a surcharge.
    const bundle = before.match(
      /(?:mieszkanie|apartament|lokal)\s+(?:(?:wraz|razem)\s+)?z\s+([^:;.!?]+)\s*[:—–-]?\s*$/,
    );
    if (bundle && !/dodatkow|platn|dokup|kosztuje/.test(bundle[1])) {
      const included = amenities(bundle[1]);
      if (included.garage) result.garageIncluded = true;
      if (included.storage) result.storageIncluded = true;
      continue;
    }
    if (
      !/dodatkow|platn|cen[ayie]|kosztuje|dokup/.test(before) &&
      !/(?:garaz\w*|miejsc\w*\s+(?:postojow\w*|parkingow\w*)(?:\s+przed\s+budynkiem)?|piwnic\w*|komork\w*(?:\s+lokatorsk\w*)?|ogrod\w*)\s*[:—–-]?\s*$/.test(
        before,
      ) &&
      !/^[^.!?]{0,50}obligatoryjn\w*\s+(?:zakup|nabyci)/.test(after)
    )
      continue;
    if (
      /^\s*(?:\/\s*(?:mies|msc)|miesieczn|za\s+miesiac)/.test(after) ||
      /wynaj\w*|czynsz/.test(before)
    )
      continue;
    const amount =
      Number(match[1].replace(/[ .]/g, "") + "." + (match[2] ?? "0")) *
      (/tys/.test(match[3]) ? 1000 : 1);
    if (!Number.isFinite(amount) || amount < 1000) continue;
    if (mentioned.garage && mentioned.storage) result.garageAndStorage = amount;
    else if (mentioned.garage) {
      const count = extractParkingSpaceCount(before);
      const perSpace =
        /\bpo\s*$/.test(before) ||
        /^\s*(?:za\s+(?:jedno\s+)?miejsce|(?:za\s+)?kazde|\/\s*(?:miejsce|szt))/i.test(after);
      const parkingAmount = amount * (perSpace ? (count ?? 1) : 1);
      if (count && perSpace) {
        result.parkingCount = count;
        result.parkingUnitPrice = amount;
      }
      if (/garaz\w*|podziemn\w*/.test(before)) indoorParking = parkingAmount;
      else otherParking = parkingAmount;
      result.garage = (indoorParking ?? 0) + (otherParking ?? 0);
    } else if (mentioned.storage) result.storage = amount;
    else result.garden = amount;
  }
  for (const clause of text.split(/[.!?](?!\d)/)) {
    for (const match of clause.matchAll(/w\s+cenie\b/g)) {
      const before = clause.slice(0, match.index);
      const after = clause.slice(match.index! + match[0].length);
      if (
        /nie\s+(?:(?:jest|sa|wchodzi|wchodza)\s+)?$/.test(before) ||
        /^\s*[:\-]?\s*\d/.test(after)
      )
        continue;
      const mentioned = amenities(clause);
      if (mentioned.garage && result.garage === undefined && result.garageAndStorage === undefined)
        result.garageIncluded = true;
      if (
        mentioned.storage &&
        result.storage === undefined &&
        result.garageAndStorage === undefined
      )
        result.storageIncluded = true;
    }
  }
  if (result.garageAndStorage !== undefined) {
    delete result.garage;
    delete result.storage;
  }
  return result;
}
