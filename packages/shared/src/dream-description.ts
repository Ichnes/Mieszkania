// Input is lowercase Polish text with diacritics removed.
export function hasPositiveDescriptionFact(text: string, pattern: RegExp) {
  return Array.from(text.matchAll(new RegExp(pattern.source, "g"))).some((match) => {
    const prefix = text.slice(Math.max(0, match.index! - 70), match.index);
    const clause = prefix.split(/[.!?;\n]/).at(-1) ?? "";
    return (
      !/\b(?:bez|brak|nie ma|nie posiada|nie sa|nie jest|nie zostal\w*|nie wykonano|imitacj\w*|imituj\w*|mozliwosc|planowan\w*)\b[^,]{0,60}$/.test(
        clause,
      ) && !/\b(?:imitacj\w*|imituj\w*|laminowan\w*|planowan\w*|nie)\b/.test(match[0])
    );
  });
}

export function getDreamDescriptionFacts(text: string) {
  const multipleParkingPattern =
    /\b(?:(?:[2-9]|[1-9]\d+|dwa|dwie|dwoch|dwoma|trzy|trzech|cztery|czterech|piec|pieciu|szesc|szesciu)\s+(?:(?:prywatn\w*|wlasn\w*|niezalezn\w*|naziemn\w*|zewnetrzn\w*|przynalezn\w*|dodatkow\w*)\s+){0,3}(?:miejsc\w*|stanowisk\w*)\s+(?:parkingow\w*|postojow\w*|garazow\w*|w\s+(?:garaz\w*|hali\w*))|(?:miejsc\w*|stanowisk\w*)\s+(?:parkingow\w*|postojow\w*|garazow\w*)\s*[:–-]?\s*(?:[2-9]|[1-9]\d+)|garaz\w*\s+(?:dwustanowiskow\w*|na\s+(?:[2-9]|dwa|trzy|cztery)\s+(?:aut\w*|samochod\w*))|dwustanowiskow\w*\s+garaz\w*)\b/;
  const multipleParking = hasPositiveDescriptionFact(text, multipleParkingPattern);
  // Keep the recurring cost tied to parking, not a rent mentioned elsewhere.
  const rentalPattern =
    /\b(?:(?:wynajm\w*|najm\w*|najem|dzierzaw\w*)\b[^.!?;\n]{0,90}?\bmiejsc\w*\s+(?:postojow\w*|parkingow\w*|garazow\w*)|miejsc\w*\s+(?:postojow\w*|parkingow\w*|garazow\w*)\b[^.!?;\n]{0,100}?\b(?:wynajm\w*|najm\w*|najem|dzierzaw\w*|miesieczn\w*|co\s+miesiac|za\s+miesiac|zl\s*\/\s*mies\w*))\b/;
  const rentedMultipleParking =
    multipleParking &&
    text
      .split(/[.!?;\n]/)
      .some(
        (clause) =>
          hasPositiveDescriptionFact(clause, multipleParkingPattern) &&
          hasPositiveDescriptionFact(clause, rentalPattern) &&
          !/\b(?:nie\s+(?:sa\s+)?(?:wynajm\w*|dzierzaw\w*)|bez\s+(?:oplat\s+miesieczn\w*|czynszu\s+najmu))\b/.test(
            clause,
          ),
      );
  return {
    shower: hasPositiveDescriptionFact(text, /\b(?:prysznic\w*|natrysk\w*)\b/),
    topFloor: hasPositiveDescriptionFact(
      text,
      /\b(?:(?:najwyzsz\w*|ostatni\w*)\b[^.!?;\n]{0,55}?\bpietr\w*|pietr\w*\s+(?:jest\s+)?(?:najwyzsz\w*|ostatni\w*))\b/,
    ),
    maintenanceFee:
      /\bbezczynszow\w*\b|\bbez\s+czynszu\b/.test(text) ||
      hasPositiveDescriptionFact(
        text,
        /\b(?:czynsz\w*|oplat\w*\s+administracyjn\w*)\b[^.!?;\n]{0,45}?\d[\d\s.,]*(?:zl|pln)\b|\b\d[\d\s.,]*(?:zl|pln)\s+(?:czynsz\w*|oplat\w*\s+administracyjn\w*)\b/,
      ),
    stoneCountertop: hasPositiveDescriptionFact(
      text,
      /\b(?:blat\w*\b[^.!?;\n]{0,90}?\b(?:spiek\w*|granit\w*|konglomerat\w*|kamienn\w*|kamien(?:ia|iu|iem)?)|(?:spiek\w*|granit\w*|konglomerat\w*|kamienn\w*|kamien(?:ia|iu|iem)?)\b[^.!?;\n]{0,50}?\bblat\w*)\b/,
    ),
    woodenFloor: hasPositiveDescriptionFact(
      text,
      /\b(?:drewnian\w*\s+(?:podlog\w*|parkiet\w*)|podlog\w*[^.!?;\n]{0,70}?(?:drewn\w*|dab\w*\s+wedzon\w*)|egzotyczn\w*\s+drewn\w*|debow\w*\s+des(?:k|ek)\w*|des(?:k|ek)\w*\s+(?:debow\w*|drewnian\w*|podlogow\w*)|merbau\w*|parkiet\w*)\b/,
    ),
    customCarpentry: hasPositiveDescriptionFact(
      text,
      /\b(?:(?:robion\w*|zrobion\w*|wykonan\w*|mebl\w*|zabudow\w*|szaf\w*|kuchni\w*)\b[^.!?;\n]{0,65}?\b(?:pod|na)\s+wymiar\b[^.!?;\n]{0,50}?\bstolar\w*|stolar\w*\b[^.!?;\n]{0,70}?\b(?:pod|na)\s+wymiar|(?:pod|na)\s+wymiar\b[^.!?;\n]{0,50}?\bstolar\w*)\b/,
    ),
    multipleParking,
    rentedMultipleParking,
    unfinished: hasPositiveDescriptionFact(
      text,
      /\b(?:do\s+wykonczenia|stan\w*\s+dewelopersk\w*)\b/,
    ),
  };
}

export function getUnfinishedPricePoints(pricePerSqm?: number) {
  // Retain the previous penalty when there is no usable price.
  if (pricePerSqm === undefined || !Number.isFinite(pricePerSqm) || pricePerSqm <= 0) return -10;
  if (pricePerSqm < 17000) return 5;
  if (pricePerSqm <= 18000) return 1;
  if (pricePerSqm <= 19000) return -4;
  if (pricePerSqm <= 20000) return -8;
  if (pricePerSqm <= 21000) return -12;
  return -18;
}
