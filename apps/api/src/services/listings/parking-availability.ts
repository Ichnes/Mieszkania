import { normalizePolish } from "../geography/address-normalization";

/** An explicit lack of an assigned space overrides generic portal garage tags. */
export function hasNoAssignedParking(description: string) {
  const text = normalizePolish(description).replace(
    /nie\s+ma\s+mozliwosci\s+zakupu\s+[^.!?;]{0,40}bez\s+miejsca\s+postojowego/g,
    "",
  );
  return (
    hasOnlyRentalParking(description) ||
    /\b(?:bez|brak|nie\s+(?:ma|posiada))\s+parkingu\b/.test(text) ||
    /\bnie\s+(?:przynalez\w*|posiada\w*|ma)\s+(?:na\s+stale\s+)?(?:(?:wlasn\w*|przypisan\w*|przynalezn\w*|stale\w*|zadn\w*)\s+){0,3}miejsc\w*\s+(?:postojow|parkingow|garazow)\w*/.test(
      text,
    ) ||
    /\b(?:brak|bez)\s+(?:(?:wlasn\w*|przypisan\w*|przynalezn\w*|stale\w*)\s+){0,3}miejsc\w*\s+(?:postojow|parkingow|garazow)\w*/.test(
      text,
    ) ||
    /\bmiejsc\w*\s+(?:postojow|parkingow|garazow)\w*[^.!?;]{0,40}\bnie\s+przynalez\w*/.test(text)
  );
}

export function hasOnlyRentalParking(description: string) {
  const text = normalizePolish(description);
  const mentions = [
    ...text.matchAll(/\b(?:garaz\w*|miejsc\w*\s+(?:postojow|parkingow|garazow)\w*)/g),
  ].map((match) => {
    const boundary = /[.!?;\n|]|\s[-–—]\s(?=(?:istnieje|mozliwosc|dodatkowo)\b)/;
    const before =
      text
        .slice(Math.max(0, match.index! - 100), match.index)
        .split(boundary)
        .at(-1) ?? "";
    const after = text
      .slice(match.index! + match[0].length, match.index! + match[0].length + 100)
      .split(boundary)[0];
    const rental =
      /\b(?:wynajec\w*|wynajac|wynajmowan\w*|wynajmuje|najmu|dzierzaw\w*)\b[^.!?;]{0,65}$/.test(
        before,
      ) ||
      /^[^.!?;]{0,65}\b(?:do\s+wynajecia|na\s+wynajem|(?:mozliwosc|opcja)\s+wynaj\w*|wynajmowan\w*|dzierzaw\w*)\b/.test(
        after,
      );
    return { rental, context: before + match[0] + after };
  });
  const hasRental = mentions.some((mention) => mention.rental);
  const hasOwned = mentions.some(
    (mention) =>
      !mention.rental &&
      /\b(?:przynalez\w*|wlasn\w*|w\s+cenie|zakup\w*|dokup\w*|platn\w*|cena\s*:?\s*\d+|(?:mieszkanie|apartament)\b[^.!?;]{0,60}\bz)\b/.test(
        mention.context,
      ),
  );
  return hasRental && !hasOwned;
}
