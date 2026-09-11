import { decodeListingText } from "./listing-text";
import {
  isNonAddressPhrase,
  sanitizeStreetCandidate,
  normalizeWarsawStreetCandidate,
} from "../geography/address-normalization";
import { inferWarsawDistrictFromAddressDescription } from "./listing-title-location";
import type { ParsedListing } from "../../collectors/types";

export function enrichListingFromDescription(listing: ParsedListing): ParsedListing {
  const description = cleanListingDescription(listing.description);
  const floorFacts = inferBuildingDetails(description ?? "");
  const yearBuilt = listing.yearBuilt ?? inferConstructionYear(description);
  const explicitDistrict = inferWarsawDistrictFromAddressDescription(description);
  const district = explicitDistrict ?? listing.district;
  const streetFromTitle = sanitizeStreetCandidate(extractStreetFromTitle(listing.title));
  const cleanedSuppliedStreet = sanitizeStreetCandidate(listing.street) ?? undefined;
  const suppliedStreet = isPlausibleStreet(cleanedSuppliedStreet)
    ? cleanedSuppliedStreet
    : undefined;
  const street =
    (explicitDistrict ? normalizeWarsawStreetCandidate(extractStreet(description)) : undefined) ??
    streetFromTitle ??
    suppliedStreet ??
    sanitizeStreetCandidate(extractStreet(description)) ??
    undefined;
  const shouldNormalizeAddress = Boolean(
    street &&
    (explicitDistrict || streetFromTitle || !suppliedStreet || suppliedStreet !== listing.street),
  );

  return {
    ...listing,
    title: decodeListingText(listing.title),
    description,
    street,
    district,
    neighborhood:
      explicitDistrict && explicitDistrict !== listing.district ? undefined : listing.neighborhood,
    // Portal address blocks occasionally contain a sentence mentioning a road.
    // Persist a compact address only from the verified street plus district/city.
    addressText: shouldNormalizeAddress
      ? [street, district, listing.city].filter(Boolean).join(", ")
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
  const approximate = "(?:(?:ok\\.?|okolo|circa)\\s+)?";
  const patterns = [
    new RegExp(`\\b(?:rok|data)\\s+(?:budowy|wybudowania)\\s*[:,-]?\\s*${year}\\b`),
    new RegExp(
      `\\b(?:budyn|blok|kamienic|apartamentow|dom|osiedl|will|inwestyc)\\w*(?:\\s+\\w+){0,4}\\s+z\\s+${approximate}${year}\\s*(?:rok\\w*|r\\.)`,
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
    if (match && /remon|moderniz|renow|instalac|okn|elewac/.test(match[0])) continue;
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
    !isNonAddressPhrase(value) &&
    !/\b(?:tramwaj|komunikacja|centrum|pozwala|dojazd|minut)\b/i.test(value)
  );
}

function extractStreet(description?: string) {
  if (!description) return undefined;
  const match = description.match(
    /\b(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac)\s+([A-ZĄĆĘŁŃÓŚŹŻ][\p{L}0-9.' -]{1,70}?)(?=,|\.|;|\n|\s{2,}|\s+na\s+(?:\d|pierwsz|drug|trzec|czwart|piąt|szóst|ostatni)|$)/u,
  );
  return match?.[1]?.trim();
}

export function cleanListingDescription(value?: string) {
  if (!value) return value;

  return (
    decodeListingText(value)
      .replace(/\s*Zgłoś\s+błąd\s+lub\s+naruszenie\s+Drukuj\s+Udostępnij(?:\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || undefined
  );
}

export function inferBuildingDetails(description: string) {
  const text = normalize(description);
  const explicitFraction =
    text.match(/\b(?:pietr(?:o|ze)?|poziom)\s*[:,-]?\s*(parter|\d{1,2})\s*\/\s*(\d{1,2})\b/) ??
    text.match(/\b(?:na\s+)?(\d{1,2})\.?\s*pietr(?:ze|o)\s+(?:z|w)\s+(\d{1,2})\b/);
  const ordinalFloors: Array<[string, number]> = [
    ["pierwsz", 1],
    ["drug", 2],
    ["trzec", 3],
    ["czwart", 4],
    ["piat", 5],
    ["szost", 6],
    ["siodm", 7],
    ["osm", 8],
    ["dziewiat", 9],
    ["dziesiat", 10],
  ];
  const hasGroundFloor = hasApartmentGroundFloor(text);
  const floorFromOrdinal = ordinalFloors.find(([stem]) =>
    new RegExp(`\\b${stem}\\w*\\s+pietr(?:ze|o)\\b`).test(text),
  )?.[1];
  const floorFromNumber = text.match(/\b(?:na\s+)?(\d{1,2})(?:\.|-\w+)?\s+pietr(?:ze|o)\b/)?.[1];
  const totalFloorWords: Array<[string, number]> = [
    ["jedno", 1],
    ["dwu", 2],
    ["trzy", 3],
    ["cztero", 4],
    ["piecio", 5],
    ["szescio", 6],
    ["siedmio", 7],
    ["osmio", 8],
    ["dziewiecio", 9],
    ["dziesiecio", 10],
  ];
  const totalFromWord = totalFloorWords.find(([prefix]) =>
    new RegExp(`\\b${prefix}pietrow\\w*(?:\\s+(?:blok|budyn)\\w*)?`).test(text),
  )?.[1];
  const totalFromNumber = text.match(/\b(\d{1,2})\s*[- ]?pietrow\w*(?:\s+(?:blok|budyn)\w*)?/)?.[1];
  const floorsInSentence = text.match(
    /\bpietrze\s+w\s+(\d{1,2})\s*[- ]?kondygnacyjn\w*\s+budyn\w*/,
  )?.[1];
  const ordinal = ordinalFloors.map(([stem]) => `${stem}\\w*`).join("|");
  const floorToken = `(\\d{1,2}\\.?|${ordinal})`;
  const lastFloorPattern = new RegExp(
    `\\bostatni\\w*\\s*[,(-]?\\s*${floorToken}\\s*\\)?\\s*pietr(?:ze|o)\\b|\\b${floorToken}\\s*(?:[,(-]\\s*)?(?:czyli\\s+)?ostatni\\w*\\s*\\)?\\s*pietr(?:ze|o)\\b|\\b${floorToken}\\s+pietr(?:ze|o)\\s*[,(-]\\s*(?:czyli\\s+)?ostatni\\w*\\b`,
    "g",
  );
  const lastFloorMatch = [...text.matchAll(lastFloorPattern)].find(
    (match) =>
      !/\bnie\s+(?:(?:jest|na|to|jednak)\s+){0,3}$/.test(
        text.slice(Math.max(0, match.index! - 40), match.index),
      ),
  );
  const lastFloorToken = lastFloorMatch?.slice(1).find(Boolean);
  const lastFloor = lastFloorToken
    ? /^\d/.test(lastFloorToken)
      ? Number.parseInt(lastFloorToken, 10)
      : ordinalFloors.find(([stem]) => lastFloorToken.startsWith(stem))?.[1]
    : undefined;
  const yearBuilt = inferConstructionYear(description);

  return {
    floor: explicitFraction
      ? explicitFraction[1] === "parter"
        ? 0
        : Number(explicitFraction[1])
      : (lastFloor ??
        floorFromOrdinal ??
        (floorFromNumber ? Number(floorFromNumber) : hasGroundFloor ? 0 : undefined)),
    totalFloors: explicitFraction
      ? Number(explicitFraction[2])
      : (totalFromWord ??
        (totalFromNumber
          ? Number(totalFromNumber)
          : floorsInSentence
            ? Number(floorsInSentence)
            : lastFloor)),
    yearBuilt,
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l");
}
import { hasApartmentGroundFloor } from "@mieszkania/shared";
