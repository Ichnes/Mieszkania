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
    storage: /komork\w*|piwnic\w*|boks\w*\s+(?:rowerow|lokatorsk)\w*|box\w*\s+lokatorsk\w*/.test(
      text,
    ),
    garden: /ogrod(?:ek|ka|kiem|ku)\b/.test(text),
  };
}

export function extractAdditionalPurchaseCosts(description: string): PurchaseCosts {
  let text = normalize(description.replace(/<[^>]*>/g, " "))
    .replace(
      /,?\s*\n\s*[-–•]\s*(?=(?:miejsc\w* (?:postojow|parkingow)|komork\w* lokatorsk))/g,
      "; ",
    )
    .replace(/(?:\n\s*|,\s*-\s*)(?=cena\s*:\s*\d)/g, "; ")
    .replace(
      /(\d[\d .]*\s*(?:zl|pln))\s*[-–—]\s*(\d+ miejsca postojowe)\s+(?=lacznie\s*:)/g,
      "; $2 dodatkowo $1; ",
    )
    .replace(/\s+/g, " ")
    .replace(
      /(\bkomork\w* lokatorsk\w*)\s*\(\d+(?:[.,]\d+)?\s*m\s*(?:kw\.?|²|2)\)\s*(?=\d)/g,
      "; $1: ",
    )
    .replace(
      /(\bmiejsce postojowe w garazu podziemnym\s*[-—–]\s*dodatkowo\s+)(\d{1,3} \d{3})(?=\s+(?:lokalizacja|okolica)\b|$)/g,
      "$1$2 zl",
    )
    .replace(
      /(\bdwa miejsca (?:postojowe|parkingowe)[^.!?;:]{0,60}):\s*[-–]\s*miejsce szersze niz standardowe\s*[-–]\s*([\d .]+\s*(?:zl|pln)),?\s*[-–]\s*miejsce standardowe\s*[-–]/g,
      "; miejsce parkingowe: $2; drugie miejsce parkingowe: ",
    )
    .replace(
      /\(dodatkowo platne ([\d .]+\s*(?:zl|pln))\)\s*:\s*-?\s*(?:murowana )?komorka lokatorska([^.;]{0,150}?)\s*[,–-]+\s*(?:dwa |trzy )?(?:prywatne )?miejsca postojowe/g,
      "; komorka lokatorska i miejsca postojowe dodatkowo $1; $2 miejsca postojowe",
    )
    .replace(/(\d)\s+z\s+l\b/g, "$1 zl")
    .replace(
      /((?:platn\w* dodatkowo|dodatkowo platn\w*)\s+)(\d{1,3}(?: \d{3})*),\s*00(?=\s*(?:[).;]|stan prawny\b|$))/g,
      "$1$2 zl",
    )
    .replace(/(dodatkowo platn\w*\s+)(\d{4,7}|\d{1,3} \d{3})(?=\s*(?:\)|za \d+\s*\)))/g, "$1$2 zl")
    .replace(/(piwnic\w* o powierzchni)\s*:\s*(?=\d)/g, "$1 ")
    .replace(
      /\b(miejsca|miejsc) (podziemn\w*|naziemn\w*)(?=\s*[-–—]\s*(?:w cenie|dodatkowo platn))/g,
      "$1 postojowe $2",
    )
    .replace(/\((\d{1,3}(?:[ .]\d{3})+,00)\)(?=[^.!?;]{0,75}dodatkowo platn)/g, "($1 zl)")
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
  if (/dodatkowo platn\w*\s+\d{1,3}\.\d{4}\b/.test(text))
    result.warnings = [
      "Opis zawiera niejednoznaczny zapis kwoty dopłaty. Potwierdź cenę ze sprzedającym.",
    ];
  if (
    /zakup min\.?\s*1 miejsca jest obligatoryjny/.test(text) &&
    /miejsce parkingowe naziemne/.test(text) &&
    /miejsce parkingowe w garazu/.test(text)
  ) {
    return {
      warnings: [
        "Zakup co najmniej jednego miejsca jest obowiązkowy. W opisie są różne ceny miejsc naziemnych i w garażu.",
      ],
    };
  }
  if (/miejsce postojowe i komorka lokatorska\s*\(dodatkowo platne, do wyboru\)/.test(text)) {
    return {
      warnings: [
        "Sprzedający podaje kilka wariantów miejsca z komórką. Dopłata zależy od wyboru pakietu.",
      ],
    };
  }
  if (/brak obowiazku zakupu[^.!?;]{0,80}platformy parkingowe w cenie od/.test(text)) {
    result.warnings = ["Parking jest opcjonalny. Opis podaje ceny początkowe dla różnych miejsc."];
    text = text.replace(
      /platformy parkingowe w cenie od[^.!?;]*?(?:zl|pln)\s+oraz miejsca tradycyjne w cenie od[\d .,]+(?:zl|pln)/g,
      "",
    );
  }
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
    const clauses = text
      .slice(Math.max(previousEnd, index - 400), index)
      .split(/[.!?](?!\d)|[•;|]/);
    let before = clauses.at(-1)!;
    if (
      /^\s*cena miejsca\s*:\s*$/.test(before) &&
      clauses.slice(0, -1).some((clause) => amenities(clause).garage)
    )
      before = "cena miejsca postojowego: ";
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
    if (
      (amenities(before).garage || amenities(before).storage) &&
      (/^\s*\(\s*zakup nie jest obligatoryjny/.test(after) || /mozna dokupic za\s*$/.test(before))
    ) {
      (result.warnings ??= []).push(
        "Sprzedający podaje opcjonalną dopłatę. Kwota nie jest wliczona w koszt zakupu.",
      );
      continue;
    }
    const includedPrefix = before.match(/^(.*\bw\s+cenie)\s*[,;]\s*(.*)$/);
    if (includedPrefix && !/\bnie\s+(?:(?:jest|sa)\s+)?w\s+cenie$/.test(includedPrefix[1])) {
      const included = amenities(includedPrefix[1]);
      includedInBundle.garage ||= included.garage;
      includedInBundle.storage ||= included.storage;
      before = includedPrefix[2];
    }
    before = before.replace(/^.*?\(dodatkowo platn\w*\s+\d{1,3}\.\d{4}\)\s+oraz\s+/, "");
    const mentioned = amenities(before);
    if (
      /^(?:\s*za kazde miejsce postojowe\s+|\s*(?:oraz |i )?)(?:komorka lokatorska|piwnica)\b/.test(
        before,
      ) &&
      (/\b(?:polozon\w* w garazu|obok miejsca postojowego)\b/.test(before) ||
        /komorka lokatorska\s*:\s*$/.test(before))
    )
      mentioned.garage = false;
    if (/\bcena za (?:komork\w*|piwnic\w*)\s*:\s*$/.test(before)) mentioned.garage = false;
    if (
      /\b(?:zachecamy do zakupu|mozliwosc (?:za|do)kupu) (?:drugiego|trzeciego) miejsca\b/.test(
        before,
      )
    ) {
      (result.warnings ??= []).push(
        "Opis podaje opcjonalne dodatkowe miejsce. Jego cena nie jest wliczona w dopłaty.",
      );
      continue;
    }
    if (/\bbrak\s+(?:komork\w*|piwnic\w*)/.test(before)) mentioned.storage = false;
    // A summary's unqualified "Cena:" is the apartment price. Earlier fields
    // (including "garaż: w cenie") must not make it an amenity surcharge.
    if (/\bcena\s*[:=]\s*$/.test(before) && /\bw\s+cenie\b/.test(before)) continue;
    // A price directly attached to the parking space is not a joint storage price.
    if (/\bprzy\s+miejscu\s+postojowym\s*\(?\s*(?:dodatkowo\s+platne)?\s*$/.test(before))
      mentioned.storage = false;
    if (!mentioned.garage && !mentioned.storage && !mentioned.garden) continue;
    if (/\b(?:cena laczna|laczna cena) nieruchomosci\b/.test(before)) continue;
    if (
      /\bcena\s*:\s*$/.test(before) &&
      (/\bmieszkanie gotowe do (?:zamieszkania|wprowadzenia)\b/.test(before) ||
        /\b\d+ pokoje?\b[^;!?]{0,140}\b(?:balkon|piwnica)\b/.test(before))
    )
      continue;
    if (/\bcena (?:calego )?pakietu\b/.test(before)) continue;
    if (/\b(?:osiedle|forma sprzedazy)\s*:[^.!?;:]{1,80}\bcena\s*:\s*$/.test(before)) continue;
    if (/\bmieszkanie\s*\(\s*\d+(?:[.,]\d+)?\s*m[2²]\s*\)\s*\+/.test(before)) continue;
    if (/\b(?:laczna cena|cena laczna) z (?:miejscem|garazem|komorka)\b/.test(before)) continue;
    if (/\blaczna kwota za (?:nieruchomosc|mieszkanie|apartament|lokal)\b/.test(before)) continue;
    if (
      /\b(?:mieszkanie|apartament|lokal)\s+\d+(?:[,.]\d+)?\s*m[²2]\s+z ogrodkiem\s*[-–—:]\s*$/.test(
        before,
      )
    )
      continue;
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
      !/dodatkow|platn|cen[ayie]|kosztuje|dokup|zakup obligator|obligatoryjn\w* zakup|w kwocie|oplata wynosi\s*$|\b(?:za|po)\s*$|\+\s*$|\b\d{1,2}\s*[x×]\s*$|\(\s*$/.test(
        before,
      ) &&
      !/(?:gara[zż]\w*|miejsc\w* (?:postojow\w*|parkingow\w*|w gara\w*)|komork\w* lokatorsk\w*|piwnic\w*)[^;:!?•]{0,85}[:=–—-]\s*$/.test(
        before,
      ) &&
      !/(?:garaz\w*(?:\s+podziemn\w*)?|miejsc\w*\s+(?:postojow\w*|parkingow\w*)(?:\s+przed\s+budynkiem)?|piwnic\w*|komork\w*(?:\s+lokatorsk\w*)?|ogrod\w*)\s*[:—–-]?\s*$/.test(
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
      const statedCount = multiplier ? Number(multiplier[1]) : extractParkingSpaceCount(before);
      const count =
        statedCount ?? (amount === result.parkingUnitPrice ? result.parkingCount : undefined);
      const perSpace =
        Boolean(multiplier) ||
        /\b(?:po|kazde w cenie)\s*$/.test(before) ||
        /^\s*(?:za\s+(?:jedno\s+)?miejsce|(?:za\s+)?kazde|\/\s*(?:miejsce|szt))/i.test(after);
      const parkingAmount = amount * (perSpace ? (count ?? 1) : 1);
      if (
        perSpace &&
        result.parkingUnitPrice === amount &&
        result.garage === parkingAmount &&
        !statedCount
      )
        continue;
      if (count && perSpace) {
        result.parkingCount = count;
        result.parkingUnitPrice = amount;
      }
      if (/\bboks garazowy\s*[-–—:]\s*$/.test(before) && indoorParking !== undefined)
        secondParking = parkingAmount;
      else if (/garaz\w*|podziemn\w*/.test(before)) indoorParking = parkingAmount;
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
