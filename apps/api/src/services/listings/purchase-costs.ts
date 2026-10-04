import { extractParkingSpaceCount } from "./parking-count";
import { hasNoAssignedParking } from "./parking-availability";

export type PurchaseCosts = {
  parkingCount?: number;
  parkingUnitPrice?: number;
  garage?: number;
  storage?: number;
  garden?: number;
  garageAndStorage?: number;
  garageIncluded?: boolean;
  storageIncluded?: boolean;
  warnings?: string[];
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
  const text = normalize(description.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\bok\./g, "ok")
    .replace(/(\d)\s*m\.(?=\s)/g, "$1 m");
  const result: PurchaseCosts = {};
  let previousEnd = 0;
  let indoorParking: number | undefined;
  let otherParking: number | undefined;
  const includedInBundle = { garage: false, storage: false };
  for (const match of text.matchAll(
    /(\d{1,3}(?:[ .]\d{3})+|\d{1,7})(?:,(\d{1,2}))?\s*(tys(?:iecy|\.)?\b|pln\b|zl\b|,\s*-|(?=za\s+(?:jedno\s+)?miejsce\b))/g,
  )) {
    const index = match.index!;
    let before = text
      .slice(Math.max(previousEnd, index - 400), index)
      .split(/[.!?](?!\d)/)
      .at(-1)!;
    const after = text.slice(index + match[0].length, index + match[0].length + 70);
    previousEnd = index + match[0].length;
    const includedPrefix = before.match(/^(.*\bw\s+cenie)\s*[,;]\s*(.*)$/);
    if (includedPrefix && !/\bnie\s+(?:(?:jest|sa)\s+)?w\s+cenie$/.test(includedPrefix[1])) {
      const included = amenities(includedPrefix[1]);
      includedInBundle.garage ||= included.garage;
      includedInBundle.storage ||= included.storage;
      before = includedPrefix[2];
    }
    const mentioned = amenities(before);
    // A price directly attached to the parking space is not a joint storage price.
    if (/\bprzy\s+miejscu\s+postojowym\s*\(?\s*(?:dodatkowo\s+platne)?\s*$/.test(before))
      mentioned.storage = false;
    if (!mentioned.garage && !mentioned.storage && !mentioned.garden) continue;
    // Nearby amenity mentions do not turn the apartment price or unit price into a surcharge.
    if (/\bcena\s+(?:mieszkania|apartamentu|lokalu|za\s+m[²2])\s*[:=—–-]?\s*$/.test(before))
      continue;
    // A price for the apartment together with an amenity is the total, not a surcharge.
    const bundle = before.match(
      /(?:mieszkanie|apartament|lokal)\s+(?:(?:(?:wraz|razem|lacznie)\s+)?z|\+|i|oraz)\s+([^;.!?]+)\s*[:=—–-]?\s*$/,
    );
    const totalPrice =
      /\b(?:mieszkanie|mieszkania|apartament|apartamentu|lokal|lokalu)\b/.test(before) &&
      /(?:cena\s+(?:laczna|calkowita|za\s+calosc)|(?:laczna|calkowita)\s+cena|(?:razem|lacznie)\s+za\s+(?:calosc|mieszkanie|apartament|lokal))\b/.test(
        before,
      );
    if ((bundle && !/dodatkow|platn|dokup|kosztuje/.test(bundle[1])) || totalPrice) {
      const included = amenities(bundle?.[1] ?? before);
      includedInBundle.garage ||= included.garage;
      includedInBundle.storage ||= included.storage;
      continue;
    }
    if (
      !/dodatkow|platn|cen[ayie]|kosztuje|dokup|\bza\s*$|\+\s*$/.test(before) &&
      !/(?:garaz\w*|miejsc\w*\s+(?:postojow\w*|parkingow\w*)(?:\s+przed\s+budynkiem)?|piwnic\w*|komork\w*(?:\s+lokatorsk\w*)?|ogrod\w*)\s*[:—–-]?\s*$/.test(
        before,
      ) &&
      !/^[^.!?]{0,50}obligatoryjn\w*\s+(?:zakup|nabyci)/.test(after)
    )
      continue;
    if (
      /^\s*(?:\/\s*(?:mies|msc|rok|kwartal)|miesieczn|rocznie|kwartalnie|za\s+(?:miesiac|rok|kwartal))/.test(
        after,
      ) ||
      /wynaj\w*|czynsz|dzierzaw\w*/.test(before)
    )
      continue;
    const baseAmount = Number(match[1].replace(/[ .]/g, "") + "." + (match[2] ?? "0"));
    if (/tys/.test(match[3]) && baseAmount > 1000000) {
      (result.warnings ??= []).push(
        `Dopłata „${match[1]} tys.” ma niejednoznaczną kwotę. Potwierdź ją ze sprzedającym; nie doliczono jej do ceny zakupu.`,
      );
      continue;
    }
    // Full zł amounts followed by a redundant "tys." are a common listing typo.
    const amount = baseAmount * (/tys/.test(match[3]) && baseAmount < 1000 ? 1000 : 1);
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
  // Explicit surcharges remain authoritative regardless of where a package total appears.
  if (
    includedInBundle.garage &&
    result.garage === undefined &&
    result.garageAndStorage === undefined
  )
    result.garageIncluded = true;
  if (
    includedInBundle.storage &&
    result.storage === undefined &&
    result.garageAndStorage === undefined
  )
    result.storageIncluded = true;
  if (hasNoAssignedParking(description)) {
    delete result.garage;
    delete result.garageIncluded;
    delete result.garageAndStorage;
    delete result.parkingCount;
    delete result.parkingUnitPrice;
  }
  return result;
}
