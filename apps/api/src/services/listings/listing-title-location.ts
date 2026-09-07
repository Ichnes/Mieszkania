import { normalizePolish, isNonAddressPhrase } from "../geography/address-normalization";

const warsawDistrictAliases: Array<[string, string]> = [
  ["praga polnoc", "Praga-Północ"],
  ["praga poludnie", "Praga-Południe"],
  ["srodmiescie", "Śródmieście"],
  ["bialoleka", "Białołęka"],
  ["targowek", "Targówek"],
  ["rembertow", "Rembertów"],
  ["zoliborz", "Żoliborz"],
  ["mokotow", "Mokotów"],
  ["ursynow", "Ursynów"],
  ["wilanow", "Wilanów"],
  ["bemowo", "Bemowo"],
  ["bielany", "Bielany"],
  ["ochota", "Ochota"],
  ["ursus", "Ursus"],
  ["wawer", "Wawer"],
  ["wesola", "Wesoła"],
  ["wlochy", "Włochy"],
  ["wola", "Wola"],
];

export function inferWarsawDistrictFromText(value?: string | null) {
  const normalized = normalizePolish(value ?? "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return warsawDistrictAliases.find(([alias]) =>
    new RegExp(`(?:^|\\s)${alias.replace(/ /g, "\\s+")}(?=$|\\s)`, "i").test(normalized),
  )?.[1];
}

export function inferWarsawDistrictFromLocationTitle(title: string) {
  const segments = title
    .split(/[:,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const locationSuffix = segments.length >= 2 ? segments.slice(-2).join(" ") : title;
  return inferWarsawDistrictFromText(locationSuffix);
}

export function extractStreetFromLocationTitle(title: string, district?: string, city?: string) {
  const segments = title
    .split(/[:,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length < 2) {
    const inline = title.match(
      /\b(?:przy|ul\.?|ulica|al\.?|aleja|pl\.?|placu|plac)\s+([A-ZŻŹĆĄŚĘŁÓŃ][\p{L}-]*(?:\s+[A-ZŻŹĆĄŚĘŁÓŃ][\p{L}-]*)?)/u,
    );
    return inline?.[1]?.trim();
  }

  const candidate = segments
    .at(-1)
    ?.replace(/^(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac)\s+/i, "")
    .trim();
  if (
    !candidate ||
    isNonAddressPhrase(candidate) ||
    candidate.length < 2 ||
    candidate.length > 70 ||
    candidate.split(/\s+/).length > 7
  )
    return undefined;

  const normalizedCandidate = normalizePolish(candidate);
  const excludedLocations = [district, city, "Warszawa", "Polska"]
    .filter((value): value is string => Boolean(value))
    .map(normalizePolish);
  if (excludedLocations.includes(normalizedCandidate) || inferWarsawDistrictFromText(candidate))
    return undefined;
  if (/\b(?:mieszkanie|apartament|dom|sprzedaż|wynajem|pokojowe|pokoje)\b/i.test(candidate))
    return undefined;

  return candidate;
}
