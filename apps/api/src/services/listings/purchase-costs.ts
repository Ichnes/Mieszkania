export type PurchaseCosts = {
  garage?: number;
  storage?: number;
  garageAndStorage?: number;
  garageIncluded?: boolean;
  storageIncluded?: boolean;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .toLowerCase();
}
function amenities(text: string) {
  return {
    garage: /garaz\w*|miejsc\w*\s+(?:postojow\w*|parkingow\w*|w\s+garaz\w*|z\s+komork\w*)/.test(
      text,
    ),
    storage: /komork\w*|box\w*\s+lokatorsk\w*/.test(text),
  };
}

export function extractAdditionalPurchaseCosts(description: string): PurchaseCosts {
  const text = normalize(description.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
  const result: PurchaseCosts = {};
  let previousEnd = 0;
  for (const match of text.matchAll(
    /(\d{1,3}(?:[ .]\d{3})+|\d{1,7})(?:,(\d{1,2}))?\s*(tys(?:iecy|\.)?|pln|zl)\b/g,
  )) {
    const index = match.index!;
    const before = text
      .slice(Math.max(previousEnd, index - 400), index)
      .split(/[.!?](?!\d)/)
      .at(-1)!;
    const after = text.slice(index + match[0].length, index + match[0].length + 70);
    previousEnd = index + match[0].length;
    const mentioned = amenities(before);
    if (!mentioned.garage && !mentioned.storage) continue;
    if (
      !/dodatkow|platn|cen[ayie]|kosztuje|dokup/.test(before) &&
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
    else if (mentioned.garage) result.garage = amount;
    else result.storage = amount;
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
