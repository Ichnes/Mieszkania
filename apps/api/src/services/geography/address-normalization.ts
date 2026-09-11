export function normalizePolish(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
}

export function normalizeStreetName(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizePolish(value)
    .replace(/\b(?:ul|ulica|al|aleja|aleje|os|osiedle|pl|plac)\.?\s+/g, " ")
    .replace(/\b(?:im|gen|dr|ks|sw|sw\.)\.?\s+/g, " ")
    .replace(/\d+[a-zA-Z\/-]*/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 1 ? normalized : null;
}

const streetNarrativeBoundary =
  /\s+(?=(?:przedmiotem\s+(?:sprzedaży|oferty|najmu)\b|(?:mieszkanie|lokal|apartament|nieruchomość|dom|budynek|oferta)\s+(?:jest|znajduje|położon|usytuowan|składa|oferuje|stanowi|posiada)\w*\b|(?:znajduje|położon|usytuowan)\w*\s+(?:jest\s+)?(?:na|w)\b|(?:budynek|osiedle|nieruchomość|rozkład|lokalizacja|okolica)\b|(?:oferujemy|prezentujemy|zapraszamy|zapraszam|sprzedam|polecamy)\b|(?:na|do)\s+sprzedaży\b))/iu;

/** Removes prose accidentally captured after a street name by portal parsers. */
export function sanitizeStreetCandidate(value?: string | null) {
  const candidate = value
    ?.replace(/\s+/g, " ")
    .replace(/^(?:ul\.?|ulica|al\.?|aleja|aleje|pl\.?|plac)\s+/i, "")
    .trim();
  if (!candidate) return null;

  const clause = (candidate.split(/[,;|\n]|\s+[–—]\s+/, 1)[0]?.trim() ?? "").replace(
    /(\d+[a-z]?(?:[/-]\d+[a-z]?)?)\s+(?:na|w|we)\s+.*$/iu,
    "$1",
  );
  const locationBoundary =
    /\s+(?:na\s+(?:warszawsk\p{L}*|osiedlu\b)|w\s+(?:dzielnicy\b|Warszawie\b)|we\s+Wrocławiu\b)/iu;
  const narrativeIndex = clause.search(
    new RegExp(`${streetNarrativeBoundary.source}|${locationBoundary.source}`, "iu"),
  );
  const street = (narrativeIndex >= 0 ? clause.slice(0, narrativeIndex) : clause)
    .replace(/[.:-]+$/, "")
    .trim();

  if (street.length < 2 || street.length > 80 || street.split(/\s+/).length > 8) return null;
  return street;
}

const knownWarsawStreetNames = new Map<string, string>(
  [
    "Batalionów Chłopskich",
    "Bokserska",
    "Czerska",
    "Długa",
    "Cylichowska",
    "Gagarina",
    "Głębocka",
    "Górczewska",
    "Gumińska",
    "Gwiaździsta",
    "Inflancka",
    "Modzelewskiego",
    "Nowy Świat",
    "Panamska",
    "Piwna",
    "Rydygiera",
    "Słomińskiego",
    "Szolc-Rogozińskiego",
    "Śląska",
    "Tajemna",
    "Warecka",
    "Złota",
  ].flatMap((street) => {
    const normalized = normalizeStreetName(street);
    return normalized ? [[normalized, street] as const] : [];
  }),
);

const warsawDistrictNames = new Set([
  "bemowo",
  "bialoleka",
  "bielany",
  "mokotow",
  "ochota",
  "praga polnoc",
  "praga poludnie",
  "rembertow",
  "srodmiescie",
  "targowek",
  "ursus",
  "ursynow",
  "wawer",
  "wesola",
  "wilanow",
  "wlochy",
  "wola",
  "zoliborz",
]);

export function normalizeWarsawListingCity(
  city?: string | null,
  district?: string | null,
  locationText?: string | null,
) {
  const candidate = city?.trim() ?? "";
  const normalizedCity = normalizePolish(candidate);
  const normalizedDistrict = normalizePolish(district?.trim() ?? "");
  const normalizedLocation = normalizePolish(locationText ?? "");
  if (
    normalizedCity === "warszawa" ||
    warsawDistrictNames.has(normalizedDistrict) ||
    /(?:^|\s|,)warszawa(?:$|\s|,)/.test(normalizedLocation)
  ) {
    return "Warszawa";
  }
  return candidate;
}

export function normalizeWarsawStreetCandidate(value?: string | null) {
  const candidate = sanitizeStreetCandidate(value);
  if (!candidate) {
    return null;
  }

  const normalized = normalizeStreetName(candidate);
  if (!normalized || warsawDistrictNames.has(normalized) || isGarbageStreetCandidate(normalized)) {
    return null;
  }

  const exact = knownWarsawStreetNames.get(normalized);
  const houseNumber = candidate.match(/\s+(\d+[a-z]?(?:[/-]\d+[a-z]?)?)$/iu)?.[1];
  const withNumber = (name: string) => (houseNumber ? `${name} ${houseNumber}` : name);
  if (exact) return withNumber(exact);
  const declined = [...knownWarsawStreetNames.entries()].find(
    ([key]) => canonicalStreetForm(key) === canonicalStreetForm(normalized!),
  );
  return declined ? withNumber(declined[1]) : candidate;
}

export function normalizeWarsawStreetAddress(value?: string | null) {
  const candidate = value?.split(",", 1)[0]?.trim();
  if (!candidate) return null;
  return normalizeWarsawStreetCandidate(candidate);
}

export function sanitizeWarsawAddressText(
  value?: string | null,
  context?: { district?: string | null; neighborhood?: string | null; city?: string | null },
) {
  const candidate = value?.trim();
  if (!candidate) return null;
  const parts = candidate
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const firstPartIsLocation = [context?.neighborhood, context?.district]
    .filter(Boolean)
    .some((location) => sameNormalizedLocation(parts[0], location));
  const street = firstPartIsLocation ? null : normalizeWarsawStreetAddress(parts[0]);
  const fallbackLocation = context?.neighborhood ?? context?.district;
  const city = context?.city?.trim() || "Warszawa";
  if (!street) {
    const location = fallbackLocation?.trim();
    if (!location) return candidate;
    return normalizePolish(location) === normalizePolish(city) ? city : `${location}, ${city}`;
  }

  const cleanedParts = [street];
  for (const part of parts.slice(1)) {
    if (normalizePolish(part) === normalizePolish(city)) continue;
    if (isNarrativeAddressPart(part)) break;
    cleanedParts.push(part);
  }
  cleanedParts.push(city);
  return Array.from(
    new Map(cleanedParts.map((part) => [normalizePolish(part), part])).values(),
  ).join(", ");
}

function sameNormalizedLocation(left?: string | null, right?: string | null) {
  const leftNormalized = normalizeStreetName(left);
  const rightNormalized = normalizeStreetName(right);
  if (!leftNormalized || !rightNormalized) return false;
  return (
    leftNormalized === rightNormalized ||
    leftNormalized.endsWith(` ${rightNormalized}`) ||
    rightNormalized.endsWith(` ${leftNormalized}`)
  );
}

function canonicalStreetForm(value: string) {
  return value.replace(/iej\b/g, "a").replace(/ej\b/g, "a");
}

function isNarrativeAddressPart(value: string) {
  const normalized = normalizePolish(value).replace(/\s+/g, " ").trim();
  return (
    /^[–—-]/.test(value.trim()) ||
    /\bprzedmiotem (?:sprzedazy|oferty|najmu)\b/.test(normalized) ||
    /\b(?:mieszkanie|lokal|apartament|nieruchomosc|dom|budynek|oferta) (?:jest|znajduje|polozon|usytuowan|sklada|oferuje|stanowi|posiada)/.test(
      normalized,
    ) ||
    /\b(?:oferujemy|prezentujemy|zapraszamy|zapraszam|sprzedam|polecamy)\b/.test(normalized) ||
    value.includes("!") ||
    value.length > 60 ||
    value.split(/\s+/).length > 6
  );
}

export function isKnownWarsawStreetCandidate(value?: string | null) {
  const normalized = normalizeStreetName(value);
  return Boolean(normalized && knownWarsawStreetNames.has(normalized));
}

export function isNonAddressPhrase(value: string) {
  return /\b(?:(?:bez|brak|zero|0)\s*(?:pcc|prowizj\w*)|(?:pcc|vat)\s*\d*|opcja\s+wykonczenia)\b/.test(
    normalizePolish(value),
  );
}

function isGarbageStreetCandidate(normalized: string) {
  return (
    isNonAddressPhrase(normalized) ||
    normalized.includes("mieszkania na sprzedaz") ||
    normalized.includes("nieruchomosci") ||
    normalized.includes("wyjatkowe") ||
    normalized.includes("super lokalizacja") ||
    normalized.includes("bez dzielnicy") ||
    normalized.includes("przedmiotem sprzedazy") ||
    normalized.includes("mieszkanie znajduje") ||
    normalized.includes("nieruchomosc znajduje") ||
    normalized === "warszawa" ||
    normalized.length > 80
  );
}
