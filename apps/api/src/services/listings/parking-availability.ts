import { normalizePolish } from "../geography/address-normalization";

/** An explicit lack of an assigned space overrides generic portal garage tags. */
export function hasNoAssignedParking(description: string) {
  const text = normalizePolish(description).replace(
    /nie\s+ma\s+mozliwosci\s+zakupu\s+[^.!?;]{0,40}bez\s+miejsca\s+postojowego/g,
    "",
  );
  return (
    hasVagueParkingOption(description) ||
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

function parkingClauses(description: string) {
  return normalizePolish(description)
    .split(/[.!?;\n|](?!\d)/)
    .filter((clause) => /garaz\w*|miejsc\w*\s+(?:postojow|parkingow)\w*/.test(clause));
}

/** A general advert for available spaces is not a specific space offered with this flat. */
export function hasVagueParkingOption(description: string) {
  const clauses = parkingClauses(description);
  const vague = (clause: string) =>
    /\bdostepn\w*\s+miejsc\w*/.test(clause) &&
    /\bopcj\w*\s+(?:wynajmu|najmu)\s+lub\s+zakupu\b/.test(clause) &&
    !/\d[\d\s.,]*(?:zl|pln|tys)/.test(clause);
  return (
    clauses.some(vague) &&
    !clauses.some(
      (clause) =>
        !vague(clause) &&
        /przynalez\w*|wlasn\w*|dokup\w*|odkup\w*|wynajmuje|wynajmowan\w*/.test(clause),
    )
  );
}

export function readAmenityAccess(description: string) {
  const clauses = parkingClauses(description);
  const purchaseOption = clauses.some(
    (clause) =>
      /\b(?:mozliwosc|mozna|opcja)\b[^.!?;]{0,100}\b(?:dokup\w*|odkup\w*)\b|\bmozliwosc\s+zakupu\b/.test(
        clause,
      ) && !/\b(?:brak|bez|nie\s+ma)\s+mozliwosci/.test(clause),
  );
  const rental =
    hasOnlyRentalParking(description) && !purchaseOption && !hasVagueParkingOption(description);
  const storageRental = normalizePolish(description)
    .split(/[.!?;\n|](?!\d)/)
    .some((clause) => {
      for (const match of clause.matchAll(/\b(?:komork\w*|piwnic\w*)/g)) {
        const before = clause.slice(Math.max(0, match.index! - 220), match.index);
        const after = clause.slice(
          match.index! + match[0].length,
          match.index! + match[0].length + 100,
        );
        if (/\bnie\s+(?:(?:jest|sa)\s+)?wynajmowan/.test(before + after)) continue;
        const rentalPrefix =
          /\b(?:wynajmowan\w*|wynajmuje|najmu|najem|wynajecia)\b[^.!?;]{0,190}$/.exec(before);
        const ownershipPrefix = /\b(?:przynalez\w*|wlasn\w*|w\s+cenie)\b[^.!?;]{0,100}$/.exec(
          before,
        );
        if (ownershipPrefix && ownershipPrefix.index > (rentalPrefix?.index ?? -1)) continue;
        if (/^\s*(?:lokatorsk\w*\s+)?(?:jest\s+)?(?:wlasn\w*|w\s+cenie)\b/.test(after)) continue;
        if (
          rentalPrefix ||
          (/^[^.!?;]{0,60}\b(?:wynajmowan\w*|na\s+wynajem|do\s+wynajecia|w\s+najmie)\b/.test(
            after,
          ) &&
            !/\b(?:garaz\w*|miejsc\w*)\b/.test(after.split(/wynaj|najmie/)[0]))
        )
          return true;
      }
      return false;
    });
  return {
    garageTenure: purchaseOption
      ? ("purchase_option" as const)
      : rental
        ? ("rental" as const)
        : undefined,
    storageTenure: storageRental ? ("rental" as const) : undefined,
    garageNearby: clauses.some((clause) =>
      /\bpoblisk\w*\s+garaz\w*|\bgaraz\w*[^.!?;]{0,65}\bw\s+(?:(?:innym|sasiedni\w*|sasiedujac\w*)\s+budynku|budynku\s+obok)|\bw\s+budynku\s+(?:sasiedujac\w*|obok)[^.!?;]{0,100}\bgaraz\w*|\bgaraz\w*\s+w\s+promieniu/.test(
        clause,
      ),
    ),
  };
}

export function hasStreetParking(description: string) {
  const text = normalizePolish(description);
  if (
    /\bw\s+(?:bezposrednim\s+)?sasiedztwie\s+budynku[^.!?;]{0,100}\bogolnodostepn\w*[^.!?;]{0,45}\bmiejsc\w*\s+postojow\w*/.test(
      text,
    )
  )
    return true;
  return /\bstref\w*\s+platnego\s+parkowania\b|\b(?:parkowanie|parking\w*)[^.!?;]{0,65}\bogolnodostepn\w*\s+miejsc\w*\s+w\s+poblizu\s+budynku\b|\b(?:parking|parkowanie|miejsc\w*\s+(?:postojow|parkingow)\w*)[^.!?;]{0,50}\b(?:przy\s+ulicy|na\s+ulicy|miejski\w*)\b|\bogolnodostepn\w*[^.!?;]{0,55}\bmiejsc\w*\s+(?:postojow|parkingow)\w*[^.!?;]{0,40}\b(?:przy|obok|w\s+poblizu)\s+budynku\b/.test(
    text,
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
