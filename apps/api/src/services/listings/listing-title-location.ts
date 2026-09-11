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

// Match the same location suffix as inferWarsawDistrictFromLocationTitle before
// consulting the persisted district. Filtering must agree with displayed facts.
export function effectiveDistrictSql() {
  const segments = "regexp_split_to_array(l.title, '[:,]')";
  const suffix = `array_to_string((${segments})[greatest(cardinality(${segments}) - 1, 1):cardinality(${segments})], ' ')`;
  const normalized = `regexp_replace(translate(lower(${suffix}), 'ąćęłńóśźż', 'acelnoszz'), '[^a-z0-9]+', ' ', 'g')`;
  const description = `regexp_replace(translate(lower(coalesce(l.description, '')), 'ąćęłńóśźż', 'acelnoszz'), '[^a-z0-9]+', ' ', 'g')`;
  return `(case ${explicitDistrictPatterns.map(([pattern, district]) => `when ${description} ~ '${pattern}' then '${district}'`).join(" ")} ${warsawDistrictAliases.map(([alias, district]) => `when ${normalized} ~ '(^| )${alias}( |$)' then '${district}'`).join(" ")} else l.district end)`;
}

const explicitDistrictPatterns: Array<[string, string]> = warsawDistrictAliases.map(
  ([alias, district]) => {
    const inflected: Record<string, string> = {
      wesola: "wesol(a|ej)",
      mokotow: "mokotow(ie)?",
      ursynow: "ursynow(ie)?",
      wilanow: "wilanow(ie)?",
      rembertow: "rembertow(ie)?",
      zoliborz: "zoliborz(u)?",
      srodmiescie: "srodmiesci(e|u)",
      ochota: "ochot(a|y|cie)",
      wola: "wol(a|i)",
      wawer: "waw(er|rze)",
      bialoleka: "bialole(ka|ce)",
      targowek: "targow(ek|ku)",
      bemowo: "bemow(o|ie)",
      bielany: "bielan(y|ach)",
      ursus: "ursus(ie)?",
      wlochy: "wloch(y|ach)",
    };
    return [
      `(^| )(znajduje sie|polozon[a-z]*|zlokalizowan[a-z]*|usytuowan[a-z]*) w warszawie ${inflected[alias] ?? alias} przy ul( |$)`,
      district,
    ];
  },
);

/** Only an explicit apartment location adjoining a street, not nearby transport. */
export function inferWarsawDistrictFromAddressDescription(value?: string | null) {
  const normalized = normalizePolish(value ?? "").replace(/[^a-z0-9]+/g, " ");
  return explicitDistrictPatterns.find(([pattern]) => new RegExp(pattern).test(normalized))?.[1];
}

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
