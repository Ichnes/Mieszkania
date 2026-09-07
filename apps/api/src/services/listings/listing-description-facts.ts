import type { ParsedListing } from "../../collectors/types";

export function enrichListingFromDescription(listing: ParsedListing): ParsedListing {
  const description = cleanListingDescription(listing.description);
  const floorFacts = inferFloorFacts(description);
  const yearBuilt = listing.yearBuilt ?? inferConstructionYear(description);
  const streetFromTitle = extractStreetFromTitle(listing.title);
  const suppliedStreet = isPlausibleStreet(listing.street) ? listing.street?.trim() : undefined;
  const street = streetFromTitle ?? suppliedStreet ?? extractStreet(description);
  const shouldNormalizeAddress = Boolean(street && (streetFromTitle || !suppliedStreet));

  return {
    ...listing,
    description,
    street,
    // Portal address blocks occasionally contain a sentence mentioning a road.
    // Persist a compact address only from the verified street plus district/city.
    addressText: shouldNormalizeAddress
      ? [street, listing.district, listing.city].filter(Boolean).join(", ")
      : listing.addressText,
    floor: listing.floor ?? floorFacts.floor,
    totalFloors: listing.totalFloors ?? floorFacts.totalFloors,
    yearBuilt,
  };
}

/**
 * Extracts only years explicitly tied to construction or completion of the
 * building. A bare "z 2020 roku" is deliberately ignored because it often
 * describes a renovation, furniture or an installation instead.
 */
export function inferConstructionYear(value?: string, currentYear = new Date().getFullYear()) {
  if (!value) return undefined;
  const text = normalize(value);
  const year = "((?:18|19|20)\\d{2})";
  const patterns = [
    new RegExp(`\\b(?:rok|data)\\s+(?:budowy|wybudowania)\\s*[:,-]?\\s*${year}\\b`),
    new RegExp(
      `\\b(?:budyn|blok|kamienic|apartamentow|dom|osiedl|will|inwestyc)\\w*(?:\\s+\\w+){0,4}\\s+z\\s+${year}\\s*(?:rok\\w*|r\\.)`,
    ),
    new RegExp(
      `\\b(?:budyn|blok|kamienic|apartamentow|dom|osiedl|will)\\w*(?:\\s+\\w+){0,4}\\s+z\\s+\\w+\\s+z\\s+${year}\\s*(?:rok\\w*|r\\.)`,
    ),
    new RegExp(
      `\\b(?:budyn|blok|kamienic|apartamentow|dom|osiedl|will)\\w*\\s+${year}\\s+rok\\w*\\s+budow\\w*`,
    ),
    new RegExp(
      `\\b(?:wybudowan|zbudowan|wzniesion|powstal)\\w*(?:\\s+\\w+){0,5}\\s+(?:w\\s+)?${year}\\s*(?:r\\.?|rok\\w*)?\\b`,
    ),
    new RegExp(
      `\\b(?:budyn|blok|kamienic|apartamentow|dom|osiedl|will|inwestyc)\\w*(?:\\s+\\w+){0,6}\\s+odd(?:an|ano|any|ana|ane)\\w*\\s+do\\s+(?:uzytku|uzytkowania)(?:\\s+\\w+){0,5}\\s+(?:w\\s+)?${year}\\b`,
    ),
    new RegExp(
      `\\b(?:termin\\s+)?zakonczeni\\w*\\s+(?:budowy|inwestycji)[^\\d]{0,50}(?:\\d{1,2}[.\\s/-]+){0,2}${year}\\s*(?:r\\.?|rok\\w*)?\\b`,
    ),
    new RegExp(
      `\\b(?:yearbuilt|buildingyear|build_year|construction_year|constructionyear)\\b\\D{0,30}${year}\\b`,
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1] ? Number(match[1]) : undefined;
    if (candidate !== undefined && candidate >= 1800 && candidate <= currentYear + 1) {
      return candidate;
    }
  }
  return undefined;
}

export function inferStructuredConstructionYear(
  value: unknown,
  currentYear = new Date().getFullYear(),
): number | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = inferStructuredConstructionYear(child, currentYear);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;

  for (const [key, child] of Object.entries(value)) {
    if (/^(?:yearBuilt|buildingYear|build_year|construction_year|constructionYear)$/i.test(key)) {
      const candidate = Number(child);
      if (Number.isInteger(candidate) && candidate >= 1800 && candidate <= currentYear + 1)
        return candidate;
    }
  }
  for (const child of Object.values(value)) {
    const found = inferStructuredConstructionYear(child, currentYear);
    if (found !== undefined) return found;
  }
  return undefined;
}

function extractStreetFromTitle(title: string) {
  const match = title.match(
    /(?:^|,)\s*((?:ul\.?|ulica|al\.?|aleja|pl\.?|plac)\s+[\p{L}0-9.' -]{2,80})\s*$/iu,
  );
  return match?.[1]?.trim();
}

function isPlausibleStreet(value?: string) {
  if (!value) return false;
  const words = value.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 0 &&
    words.length <= 7 &&
    value.length <= 70 &&
    !/\b(?:tramwaj|komunikacja|centrum|pozwala|dojazd|minut)\b/i.test(value)
  );
}

function extractStreet(description?: string) {
  if (!description) return undefined;
  const match = description.match(
    /\b(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac)\s+([A-ZĄĆĘŁŃÓŚŹŻ][\p{L}0-9.' -]{1,70}?)(?=,|\.|;|\n|\s{2,}|$)/u,
  );
  return match?.[1]?.trim();
}

export function cleanListingDescription(value?: string) {
  if (!value) return value;

  return (
    value
      .replace(/\s*Zgłoś\s+błąd\s+lub\s+naruszenie\s+Drukuj\s+Udostępnij(?:\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || undefined
  );
}

function inferFloorFacts(description?: string): { floor?: number; totalFloors?: number } {
  if (!description) return {};
  const text = normalize(description);
  const pairPatterns = [
    /\b(?:pietro|poziom)\s*[:\-]?\s*(parter|\d+)\s*\/\s*(\d+)\b/,
    /\b(?:na|polozon\w*\s+na|usytuowan\w*\s+na)\s+(parter|\d+)\.?\s*pietr\w*\s+(?:z|w)\s+(\d+)\b/,
    /\b(?:na|polozon\w*\s+na|usytuowan\w*\s+na)\s+(parter|\d+)\.?\s*pietr\w*\s+w\s+(\d+)\.?\s*pietr\w*\s+budynk\w*/,
    /\b(parter|\d+)\.?\s*pietr\w*\s+(?:z|w)\s+(\d+)\.?\s*pietr\w*\s+budynk\w*/,
  ];

  for (const pattern of pairPatterns) {
    const match = text.match(pattern);
    if (match) return { floor: floorValue(match[1]), totalFloors: Number(match[2]) || undefined };
  }

  const single = text.match(
    /\b(?:na|polozon\w*\s+na|usytuowan\w*\s+na)\s+(parter|\d+)\.?\s*pietr\w*/,
  );
  return single ? { floor: floorValue(single[1]) } : {};
}

function floorValue(value: string) {
  return value === "parter" ? 0 : Number(value) || undefined;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l");
}
