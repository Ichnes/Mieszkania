import { normalizePolish } from "../geography/address-normalization";

/** An explicit lack of an assigned space overrides generic portal garage tags. */
export function hasNoAssignedParking(description: string) {
  const text = normalizePolish(description).replace(
    /nie\s+ma\s+mozliwosci\s+zakupu\s+[^.!?;]{0,40}bez\s+miejsca\s+postojowego/g,
    "",
  );
  return (
    /\bnie\s+(?:przynalez\w*|posiada\w*|ma)\s+(?:na\s+stale\s+)?(?:(?:wlasn\w*|przypisan\w*|przynalezn\w*|stale\w*|zadn\w*)\s+){0,3}miejsc\w*\s+(?:postojow|parkingow|garazow)\w*/.test(
      text,
    ) ||
    /\b(?:brak|bez)\s+(?:(?:wlasn\w*|przypisan\w*|przynalezn\w*|stale\w*)\s+){0,3}miejsc\w*\s+(?:postojow|parkingow|garazow)\w*/.test(
      text,
    ) ||
    /\bmiejsc\w*\s+(?:postojow|parkingow|garazow)\w*[^.!?;]{0,40}\bnie\s+przynalez\w*/.test(text)
  );
}
