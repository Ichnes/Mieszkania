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
    storage: /komork\w*|piwnic\w*|boks\w*\s+rowerow\w*|box\w*\s+lokatorsk\w*/.test(text),
    garden: /ogrod(?:ek|ka|kiem|ku)\b/.test(text),
  };
}

export function extractAdditionalPurchaseCosts(description: string): PurchaseCosts {
  let text = normalize(description.replace(/<[^>]*>/g, " "))
    .replace(/(?:\n\s*|,\s*-\s*)(?=cena\s*:\s*\d)/g, "; ")
    .replace(/\s+/g, " ")
    .replace(/\blokatrosk/g, "lokatorsk")
    .replace(
      /\bmiejsce garazowe i komorka lokatorska wymaga(?:ja)? odrebnej oplaty w wysokosci (\d+ tys\.?) i (\d+ tys)/g,
      "miejsce garazowe dodatkowo $1; komorka lokatorska dodatkowo $2",
    )
    .replace(/\bschowek\s*:(?=\s*\d)/g, "komorka:")
    .replace(/\bplatn\w*\s+(\d{1,3}\.\d{3})(?=\.(?:\s|$))/g, "platne $1 zl")
    .replace(/\(obok miejsc\w* postojow\w*\)/g, "")
    .replace(/\bcena za (\d+) miejsca to(?=\s+\d)/g, "cena za $1 miejsca postojowe:")
    .replace(
      /dodatkowo platne\s*\(lacznie ([\d .,]+\s*(?:zl|pln))\)\s*:\s*-\s*(miejsce postojowe w garazu podziemnym)\s*-\s*(?:duza |mala )?(piwnica|komorka)/g,
      "$2 i $3 dodatkowo $1",
    )
    .replace(
      /\(dodatkowo platne\)\s+(miejsce w garazu podziemnym)(?=\s+\d)/g,
      "; $1 dodatkowo platne ",
    )
    .replace(
      /\b(dwa|trzy|cztery) miejsca naziemne(?=\s+\d)/g,
      "$1 miejsca parkingowe naziemne dodatkowo",
    )
    .replace(/(dodatkowo platn\w*\s+\d{1,3}[ .]\d{3})(?=\s*[);])/g, "$1 zl")
    .replace(/\b(\d+)\.\s+(?=pietrze)/g, "$1 ")
    .replace(
      /\bplus obligatoryjnie\s+(\d+\s*tys\.?\s*zl)\s+za\s+(\d+ miejsc\w* postojow\w* wraz z komork\w*)/g,
      "; $2 dodatkowo $1",
    )
    .replace(
      /\blaczny koszt (dwoch|trzech|czterech) miejsc\s*:/g,
      "laczny koszt $1 miejsc postojowych:",
    )
    .replace(
      /\b(miejsce (?:parkingowe|postojowe)) i (komorka(?: lokatorska)?) platne dodatkowo\s*\(odpowiednio\s+(\d+(?:[ .,]\d+)*\s*(?:tys\.?|zl|pln))\s+i\s+/g,
      "$1 dodatkowo $3; $2 dodatkowo ",
    )
    .replace(/\bpow\.\s*(?=\d)/g, "pow ")
    .replace(/\bok\./g, "ok")
    .replace(/!\)/g, ")")
    .replace(/(\d)\s*m\.(?=\s)/g, "$1 m");
  const result: PurchaseCosts = {};
  if (
    /cena niezaleznego miejsca postojowego/.test(text) &&
    /cena rodzinnego m-ca postojowego/.test(text)
  ) {
    result.warnings = [
      "Opis zawiera cennik różnych miejsc. Potwierdź wariant parkingu dla tego lokalu.",
    ];
    text = text.split(/cena m-ca postojowego|cena niezaleznego miejsca postojowego/, 1)[0];
  }
  if (/opcjonalnie miejsce[^.!?]{0,120}opcjonalnie komork/.test(text)) {
    result.warnings = ["Parking i komórka są opcjonalne. Koszt zależy od wybranych dodatków."];
    text = text.replace(
      /opcjonalnie (?:miejsce|komork\w*)[^.!?+]{0,100}?\(\s*[\d .,]+\s*(?:pln|zl)\s*\)/g,
      "",
    );
  }
  const catalog = text.search(/miejsce postojowe pojedyncze\s*:/);
  if (catalog >= 0 && /platforma niezalezna gorna/.test(text.slice(catalog))) {
    result.warnings = [
      "Opis zawiera cennik różnych miejsc. Potwierdź wariant parkingu dla tego lokalu.",
    ];
    text = text.slice(0, catalog);
  }
  if (
    /mozliwosc zakupu calosci lub wybranych elementow/.test(text) &&
    /\b(?:kazde|kazda)\b/.test(text)
  ) {
    return {
      warnings: [
        "Sprzedający dopuszcza zakup wybranych dodatków. Łączny koszt zależy od liczby wybranych miejsc i komórek.",
      ],
    };
  }
  if (/koszt miejsca postojowego rodzinnego/.test(text) && /tylko dla lokali/.test(text)) {
    return {
      warnings: [
        "Opis podaje cennik kilku wariantów miejsc postojowych. Potwierdź wariant i cenę dodatków dla tego mieszkania.",
      ],
    };
  }
  let previousEnd = 0;
  let indoorParking: number | undefined;
  let otherParking: number | undefined;
  let secondParking: number | undefined;
  const includedInBundle = { garage: false, storage: false };
  for (const match of text.matchAll(
    /(\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ .]\d{3})+|\d{1,7})(?:[,.](\d{1,2}))?\s*(tys(?:iecy|\.)?\b|pln\b|zl(?:otych|ote|oty)?\b|,\s*-|(?=za\s+(?:jedno\s+)?miejsce\b))/g,
  )) {
    const index = match.index!;
    const clauses = text.slice(Math.max(previousEnd, index - 400), index).split(/[.!?](?!\d)|[•;]/);
    let before = clauses.at(-1)!;
    before = before.replace(/\([^()]*\bprzy miejscach postojowych[^()]*\)\s*:\s*$/, ":");
    before = before.replace(/^.*?\bdo mieszkania przynalez\w*\s+/, "");
    if (
      /^\s*(?:(?:oba\s+sa\s+)?dodatkowo\s+platn|(?:laczna )?cena za (?:oba|dwa) miejsca\b)/.test(
        before,
      ) &&
      clauses.length > 1
    ) {
      const previous = clauses.at(-2)!;
      if (amenities(previous).garage) before = previous + " " + before;
    }
    if (
      /mozliwosc\s+(?:za|do)?kup\w*\s+drugiego\s+miejsca/.test(before) &&
      result.garage !== undefined
    )
      continue;
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
    if (/\bbrak\s+(?:komork\w*|piwnic\w*)/.test(before)) mentioned.storage = false;
    // A summary's unqualified "Cena:" is the apartment price. Earlier fields
    // (including "garaż: w cenie") must not make it an amenity surcharge.
    if (/\bcena\s*[:=]\s*$/.test(before) && /\bw\s+cenie\b/.test(before)) continue;
    // A price directly attached to the parking space is not a joint storage price.
    if (/\bprzy\s+miejscu\s+postojowym\s*\(?\s*(?:dodatkowo\s+platne)?\s*$/.test(before))
      mentioned.storage = false;
    if (!mentioned.garage && !mentioned.storage && !mentioned.garden) continue;
    if (/\bcena laczna nieruchomosci\b/.test(before)) continue;
    if (/\blaczna cena z (?:miejscem|garazem|komorka)\b/.test(before)) continue;
    if (/\bcena\s*[-–—]\s*$/.test(before) && /^\s*\+/.test(after)) continue;
    // Nearby amenity mentions do not turn the apartment price or unit price into a surcharge.
    if (/\bcena\s+(?:mieszkania|apartamentu|lokalu|za\s+m[²2])\s*[:=—–-]?\s*$/.test(before))
      continue;
    // A price for the apartment together with an amenity is the total, not a surcharge.
    const bundle = before.match(
      /(?:mieszkanie|mieszkania|apartament|apartamentu|lokal|lokalu)\s+(?:(?:(?:wraz|razem|lacznie)\s+)?z|\+|i|oraz)\s+([^;.!?]+)\s*[:=—–-]?\s*$/,
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
      !/dodatkow|platn|cen[ayie]|kosztuje|dokup|zakup obligator|obligatoryjn\w* zakup|w kwocie|\b(?:za|po)\s*$|\+\s*$|\b\d{1,2}\s*[x×]\s*$|\(\s*$/.test(
        before,
      ) &&
      !/(?:gara[zż]\w*|miejsc\w* (?:postojow\w*|parkingow\w*|w gara\w*)|komork\w* lokatorsk\w*|piwnic\w*)[^;:!?•]{0,85}[:=–—-]\s*$/.test(
        before,
      ) &&
      !/(?:garaz\w*|miejsc\w*\s+(?:postojow\w*|parkingow\w*)(?:\s+przed\s+budynkiem)?|piwnic\w*|komork\w*(?:\s+lokatorsk\w*)?|ogrod\w*)\s*[:—–-]?\s*$/.test(
        before,
      ) &&
      !/^[^.!?]{0,50}obligatoryjn\w*\s+(?:zakup|nabyci)/.test(after)
    )
      continue;
    if (
      /^\s*(?:\/\s*(?:mies|msc|rok|kwartal|m[2²])|miesieczn|rocznie|kwartalnie|za\s+(?:miesiac|rok|kwartal))/.test(
        after,
      ) ||
      /wynaj\w*|czynsz|dzierzaw\w*/.test(before)
    )
      continue;
    const baseAmount = Number(`${match[1].replace(/[ ,.]/g, "")}.${match[2] ?? "0"}`);
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
      const multiplier = before.match(/\b(\d{1,2})\s*[x×]\s*$/);
      const count = multiplier ? Number(multiplier[1]) : extractParkingSpaceCount(before);
      const perSpace =
        Boolean(multiplier) ||
        /\b(?:po|kazde w cenie)\s*$/.test(before) ||
        /^\s*(?:za\s+(?:jedno\s+)?miejsce|(?:za\s+)?kazde|\/\s*(?:miejsce|szt))/i.test(after);
      const parkingAmount = amount * (perSpace ? (count ?? 1) : 1);
      if (count && perSpace) {
        result.parkingCount = count;
        result.parkingUnitPrice = amount;
      }
      if (/garaz\w*|podziemn\w*/.test(before)) indoorParking = parkingAmount;
      else if (/^\s*drugie miejsce (?:parkingowe|postojowe)\s*:/.test(before))
        secondParking = parkingAmount;
      else if (parkingAmount !== indoorParking || /naziemn|zewnetrz|przed budynkiem/.test(before))
        otherParking = parkingAmount;
      result.garage = (indoorParking ?? 0) + (otherParking ?? 0) + (secondParking ?? 0);
    } else if (mentioned.storage) {
      const boxes = /^\s*\/\s*boks/.test(after)
        ? Number(before.match(/\b(\d{1,2}) boksow rowerowych/)?.[1])
        : 0;
      result.storage = amount * (boxes || 1);
    } else result.garden = amount;
  }
  if (
    result.parkingCount &&
    result.parkingUnitPrice &&
    result.garage !== result.parkingCount * result.parkingUnitPrice
  ) {
    delete result.parkingCount;
    delete result.parkingUnitPrice;
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
