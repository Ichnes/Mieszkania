import { createDefaultSearchContract, type SearchContract } from "@mieszkania/shared";
import type { ParsedListing, SourceListingReference } from "../types";
import { gratkaMorizonWarsawDistrictIds } from "../location-groups";

type JsonRecord = Record<string, unknown>;

export function buildMorizonSearchUrl(
  city: string,
  page: number,
  contract: SearchContract = createDefaultSearchContract(),
) {
  const normalizedCity =
    city
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase() || "warszawa";
  const url = new URL(`https://www.morizon.pl/mieszkania/najnowsze/${normalizedCity}/`);
  const districts = [...new Set(contract.districts ?? [])];
  if (districts.length > 3) throw new Error("Morizon: maksymalnie 3 dzielnice w jednym zapytaniu.");
  if (districts.length && normalizedCity !== "warszawa")
    throw new Error("Filtr dzielnic Morizona jest obecnie dostępny dla Warszawy.");
  districts.forEach((district, index) => {
    const id = gratkaMorizonWarsawDistrictIds[district];
    if (!id) throw new Error(`Nieznana dzielnica Morizona: ${district}`);
    url.searchParams.set(`ps[location][identifiers][${index}][id]`, id);
    url.searchParams.set(`ps[location][identifiers][${index}][name]`, district);
  });
  url.searchParams.set("ps[living_area_from]", String(contract.minArea));
  url.searchParams.set("ps[market_type]", "2");
  url.searchParams.set("ps[number_of_rooms_from]", String(contract.roomsMin));
  url.searchParams.set("ps[price_from]", String(contract.minPrice));
  url.searchParams.set("ps[price_to]", String(contract.maxPrice));
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

export function extractMorizonReferences(html: string): SourceListingReference[] {
  const references = Array.from(
    html.matchAll(/href=["']([^"']*\/oferta\/[^"'?#]+-mzn(\d+)(?:[?#][^"']*)?)["']/gi),
    (match) => ({
      externalId: `morizon-${match[2]}`,
      url: new URL(decodeHtml(match[1]), "https://www.morizon.pl").toString().split("#")[0],
    }),
  );
  return Array.from(
    new Map(references.map((reference) => [reference.externalId, reference])).values(),
  );
}

export function externalIdFromMorizonUrl(url: string) {
  const target = new URL(url);
  if (target.hostname !== "morizon.pl" && target.hostname !== "www.morizon.pl") {
    throw new Error(`INVALID_MORIZON_HOST: ${target.hostname}`);
  }
  const id = url.match(/-mzn(\d+)(?:[/?#]|$)/i)?.[1];
  if (!id) throw new Error(`INVALID_MORIZON_URL: ${url}`);
  return `morizon-${id}`;
}

export function parseMorizonListing(
  url: string,
  html: string,
  visibleText = stripHtml(html),
): ParsedListing {
  const jsonLd = extractJsonLd(html);
  const offer = findOffer(jsonLd);
  const information = extractInformationRows(html);
  const highlighted = extractHighlightedParameters(html);
  const title =
    stripHtml(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) ||
    stringValue(offer?.name) ||
    meta(html, "og:title") ||
    "Oferta Morizon";
  const description = stripHtml(stringValue(offer?.description) || extractDescriptionHtml(html));
  const text = `${title}\n${description}\n${visibleText}`;
  const floorValue = information[normalizeLabel("Piętro")] ?? highlighted[normalizeLabel("Piętro")];
  const floorParts = floorValue?.match(/(parter|\d+)\s*(?:\/|z)\s*(\d+)/i);
  const areaSqm =
    numberValue(information[normalizeLabel("Pow. całkowita")]) ??
    numberValue(highlighted[normalizeLabel("Powierzchnia")]) ??
    numberValue(text.match(/(?:Powierzchnia|powierzchni)\s*[:\n]?\s*([\d,.]+)\s*m(?:²|2)/i)?.[1]);
  const rooms =
    numberValue(information[normalizeLabel("Liczba pokoi")]) ??
    numberValue(highlighted[normalizeLabel("Pokoje")]) ??
    numberValue(text.match(/(?:Pokoje|Liczba pokoi)\s*[:\n]?\s*(\d+)/i)?.[1]);
  const floor =
    floorParts?.[1]?.toLowerCase() === "parter" ? 0 : numberValue(floorParts?.[1] ?? floorValue);
  const totalFloors =
    numberValue(floorParts?.[2]) ?? numberValue(information[normalizeLabel("Liczba pięter")]);
  const yearBuilt = numberValue(information[normalizeLabel("Rok budowy")]);
  const publishedAt = parsePolishDate(information[normalizeLabel("Data dodania")]);
  const seller = recordValue(offer?.seller);
  const phone =
    normalizePhone(extractVisiblePhone(html)) ?? normalizePhone(stringValue(seller?.telephone));
  const priceAmount =
    numberValue(stringValue(offer?.price)) ?? numberValue(text.match(/([\d\s.]+)\s*zł/i)?.[1]);
  const coordinates = extractCoordinates(html);
  // The dedicated location row belongs to the current advert. Prefer it over
  // marketing copy, navigation and similar offers, which can contain unrelated
  // Warsaw street or district names.
  const portalLocation = extractMorizonLocation(html);
  const district =
    portalLocation.district ??
    extractDistrict(`${title}\n${stringValue(offer?.name) ?? ""}\n${description}`);
  const street = extractStreetFromDescription(description) ?? portalLocation.street;
  const city = /warszaw/i.test(text) || /\/warszawa(?:-|\/)/i.test(url) ? "Warszawa" : "Warszawa";
  const images = extractMorizonImages(html);
  const additionalProperty = Object.entries(information).map(([normalizedName, value]) => ({
    "@type": "PropertyValue",
    name: displayLabel(normalizedName),
    value,
  }));
  const enrichedJsonLd = offer
    ? { ...offer, additionalProperty }
    : { "@type": "Offer", additionalProperty };
  const marketLabel = information[normalizeLabel("Rynek")] ?? "";
  const archivedNotice = /To ogłoszenie nie jest już dostępne/i.test(text);
  const removed =
    /oferta (?:jest )?nieaktualna|ogłoszenie (?:jest )?nieaktualne|oferta archiwalna|ogłoszenie archiwalne/i.test(
      text,
    );

  return {
    externalId: externalIdFromMorizonUrl(url),
    canonicalUrl: stringValue(offer?.url) || url,
    title,
    description: description || undefined,
    city,
    district,
    street,
    addressText: [street, district, city].filter(Boolean).join(", ") || city,
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    sourceContactPhone: phone,
    priceAmount,
    areaSqm,
    rooms,
    floor,
    totalFloors,
    yearBuilt,
    publishedAt,
    marketType: /pierwotn/i.test(marketLabel) ? "primary" : "secondary",
    offerType: "sale",
    status: removed || archivedNotice ? "removed" : "active",
    images,
    rawPayload: {
      url,
      jsonLd: enrichedJsonLd,
      informationTables: information,
      updatedAt: parsePolishDate(information[normalizeLabel("Aktualizacja")]),
      boostedAt: parsePolishDate(information[normalizeLabel("Podbicie")]),
      propertyNumber: information[normalizeLabel("Numer ogłoszenia")],
      viewCount: numberValue(information[normalizeLabel("Liczba odsłon")]),
      galleryExpectedCount: extractGalleryCount(html) ?? images.length,
      galleryVerified: images.length > 1,
    },
  };
}

function extractJsonLd(html: string) {
  const values: JsonRecord[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      if (Array.isArray(parsed)) values.push(...parsed.filter(isRecord));
      else if (isRecord(parsed)) values.push(parsed);
    } catch {
      // A malformed optional schema block must not discard the SSR fallback.
    }
  }
  return values;
}

function findOffer(nodes: JsonRecord[]) {
  for (const node of nodes) {
    const graph = Array.isArray(node["@graph"]) ? node["@graph"].filter(isRecord) : [node];
    const offer = graph.find((candidate) => typeIncludes(candidate["@type"], "Offer"));
    if (offer) return offer;
  }
  return undefined;
}

function extractInformationRows(html: string) {
  const rows: Record<string, string> = {};
  const starts = Array.from(html.matchAll(/<div[^>]*data-cy=["']informationTableRow["'][^>]*>/gi));
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index ?? 0;
    const end = starts[index + 1]?.index ?? Math.min(html.length, start + 5000);
    const row = html.slice(start, end);
    const label = stripHtml(
      row.match(/<span[^>]*data-cy=["']informationTableLabel["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
        "",
    );
    const value = stripHtml(
      row.match(
        /<(?:div|span)[^>]*data-cy=["'](?:itemValue|propertyNumber)["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i,
      )?.[1] ?? "",
    );
    const key = normalizeLabel(label);
    if (key && value && rows[key] === undefined) rows[key] = value;
  }
  return rows;
}

function extractHighlightedParameters(html: string) {
  const values: Record<string, string> = {};
  const labels = Array.from(
    html.matchAll(
      /<div[^>]*data-cy=["']detailsHighlightedParametersLabel["'][^>]*>([\s\S]*?)<\/div>/gi,
    ),
  );
  for (let index = 0; index < labels.length; index += 1) {
    const start = labels[index].index ?? 0;
    const end = labels[index + 1]?.index ?? Math.min(html.length, start + 2500);
    const item = html.slice(start, end);
    const label = stripHtml(labels[index][1]);
    const value = stripHtml(
      item.match(
        /<div[^>]*data-cy=["']detailsHighlightedParametersValue["'][^>]*>([\s\S]*?)<\/div>/i,
      )?.[1] ?? "",
    );
    const key = normalizeLabel(label);
    if (key && value && values[key] === undefined) values[key] = value;
  }
  return values;
}

function extractDescriptionHtml(html: string) {
  const match = html.match(
    /<div[^>]*class=["'][^"']*details-description__content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  return match?.[1] ?? "";
}

function extractVisiblePhone(html: string) {
  const revealed = html.match(
    /<[^>]+data-cy=["']phoneContactNumber["'][^>]*>([\s\S]{0,100}?)<\//i,
  )?.[1];
  if (revealed) return stripHtml(revealed);
  const visible = html.match(
    /<[^>]+class=["'][^"']*phone-contact__number[^"']*["'][^>]*>([\s\S]{0,100}?)<\//i,
  )?.[1];
  return stripHtml(visible ?? "");
}

function extractCoordinates(html: string) {
  for (const match of html.matchAll(
    /["']latitude["']\s*:\s*(-?\d+(?:\.\d+)?)[\s,]+["']longitude["']\s*:\s*(-?\d+(?:\.\d+)?)/gi,
  )) {
    const point = validPolishPoint(Number(match[1]), Number(match[2]));
    if (point) return point;
  }
  for (const match of html.matchAll(
    /["']latitude["']\s*:\s*\d+\s*,\s*["']longitude["']\s*:\s*\d+\s*}\s*,\s*(\d{2}\.\d+)\s*,\s*(\d{2}\.\d+)/gi,
  )) {
    const point = validPolishPoint(Number(match[1]), Number(match[2]));
    if (point) return point;
  }
  return undefined;
}

function validPolishPoint(latitude: number, longitude: number) {
  return latitude >= 49 && latitude <= 55 && longitude >= 14 && longitude <= 25
    ? { latitude, longitude }
    : undefined;
}

function extractDistrict(text: string) {
  const districts = [
    "Praga-Północ",
    "Praga-Południe",
    "Śródmieście",
    "Białołęka",
    "Targówek",
    "Żoliborz",
    "Mokotów",
    "Wilanów",
    "Ursynów",
    "Bemowo",
    "Bielany",
    "Ochota",
    "Ursus",
    "Wawer",
    "Wesoła",
    "Włochy",
    "Wola",
    "Rembertów",
  ];
  const normalizedText = normalizeLabel(text);
  const exact = districts.find((district) => normalizedText.includes(normalizeLabel(district)));
  if (exact) return exact;
  const inflections: Array<[RegExp, string]> = [
    [/\bbialolec(?:e|y|ą)\b/, "Białołęka"],
    [/\bmokotow(?:ie|u|em)\b/, "Mokotów"],
    [/\bzoliborz(?:u|a|em)\b/, "Żoliborz"],
    [/\bursynow(?:ie|u|em)\b/, "Ursynów"],
    [/\bwoli|wole\b/, "Wola"],
    [/\bsrodmiesci(?:u|a|em)\b/, "Śródmieście"],
    [/\bwilanow(?:ie|u|em)\b/, "Wilanów"],
    [/\btargowk(?:u|iem)\b/, "Targówek"],
  ];
  return inflections.find(([pattern]) => pattern.test(normalizedText))?.[1];
}

function extractStreetFromDescription(description: string) {
  const pattern =
    /(?:(?:przy|na|od)\s+ulic(?:y|\u0119)|(?:przy\s+)?ul\.?|ulica|(?:przy|na|od)\s+alei|al\.?|aleja|(?:przy|na|od)\s+placu|pl\.?|plac)\s+([^,.;\n]{2,90}?)(?=\s+(?:na|w)\s+(?:warszaw|dzielnic)|[,.;\n]|$)/gi;
  for (const match of description.matchAll(pattern)) {
    const candidate = match[1]?.trim();
    if (!candidate || candidate.split(/\s+/).length > 8) continue;
    // Phrases such as "od ulicy pierwsze piÄ™tro" describe the side of the
    // building and are not street names. Proper street names normally start
    // with a capital letter, a number, or a common lowercase title.
    if (/^(?:[\p{Lu}\d]|(?:gen|ks|\u015bw|prof|dr)\.)/u.test(candidate)) return candidate;
  }
  return undefined;
}

function extractMorizonLocation(html: string) {
  const headingHtml = html.match(
    /<h2\b[^>]*data-cy=["']locationRowTitle["'][^>]*>([\s\S]*?)<\/h2>/i,
  )?.[1];
  if (!headingHtml) return {};

  const mainLocationMatch =
    /<div\b[^>]*class=["'][^"']*location-row__main-location[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
      headingHtml,
    );
  const streetSection = mainLocationMatch
    ? headingHtml.slice(0, mainLocationMatch.index)
    : headingHtml;
  const street = Array.from(streetSection.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi), (match) =>
    stripHtml(match[1]),
  ).find(Boolean);
  const locationLabels = mainLocationMatch
    ? Array.from(mainLocationMatch[1].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi), (match) =>
        stripHtml(match[1]),
      ).filter(Boolean)
    : [];
  const district = extractDistrict(locationLabels.join("\n"));

  return { street: street || undefined, district };
}

function extractMorizonImages(html: string) {
  const candidates = new Map<number, { url: string; caption?: string; width: number }>();
  const cover = stringValue(findOffer(extractJsonLd(html))?.image) || meta(html, "og:image");
  let primaryPrefix: string | undefined;
  for (const tagMatch of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = tagMatch[0];
    const alt = attribute(tag, "alt");
    const positionMatch = alt?.match(/^(.*?)\s*-\s*zdjęcie\s+(\d+)\s*$/i);
    if (!positionMatch) continue;
    const prefix = normalizeLabel(positionMatch[1]);
    if (!primaryPrefix) primaryPrefix = prefix;
    if (prefix !== primaryPrefix) continue;
    const selected = bestImageFromTag(tag);
    if (!selected || !isMorizonImage(selected.url)) continue;
    const position = Math.max(0, Number(positionMatch[2]) - 1);
    const existing = candidates.get(position);
    if (!existing || selected.width >= existing.width)
      candidates.set(position, { ...selected, caption: alt });
  }

  for (const [position, serialized] of extractSerializedGalleryImages(html, cover).entries()) {
    const existing = candidates.get(position);
    if (!existing || serialized.width >= existing.width) candidates.set(position, serialized);
  }
  if (cover && isMorizonImage(cover) && !candidates.has(0))
    candidates.set(0, { url: decodeHtml(cover), width: 0 });

  const seen = new Set<string>();
  return [...candidates.entries()]
    .sort(([left], [right]) => left - right)
    .filter(([, image]) => {
      const key = imageIdentity(image.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(([position, image], index) => ({
      sourceUrl: largestMorizonVariant(image.url),
      position,
      caption: image.caption,
      isPrimary: index === 0,
    }));
}

function largestMorizonVariant(url: string) {
  return url.replace(/\/3x2_(?:xs|s|m|l|xl):[^/]+\//i, "/3x2_xl:fit/");
}

function extractSerializedGalleryImages(html: string, cover?: string) {
  const result = new Map<number, { url: string; width: number }>();
  const coverToken = cover?.match(/\/thumb\/([^/]+)\//i)?.[1];
  const galleryGroup = coverToken ? decodedGalleryGroup(coverToken) : undefined;
  if (!galleryGroup) return result;

  const byToken = new Map<string, { url: string; width: number }>();
  for (const match of html.matchAll(
    /https:\/\/img\d*\.staticmorizon\.com\.pl\/thumb\/([A-Za-z0-9_=-]+)\/[^"'\\<>\s]+/gi,
  )) {
    const token = match[1];
    if (decodedGalleryGroup(token) !== galleryGroup) continue;
    const url = decodeHtml(match[0]).replace(/[),;]+$/, "");
    const width = imageVariantWidth(url);
    const existing = byToken.get(token);
    if (!existing || width >= existing.width) byToken.set(token, { url, width });
  }
  [...byToken.values()].forEach((image, position) => result.set(position, image));
  return result;
}

function decodedGalleryGroup(token: string) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    return decoded.match(/\/(\d+)_\d+_[^/]+$/)?.[1];
  } catch {
    return undefined;
  }
}

function imageVariantWidth(url: string) {
  if (/(?:^|_)xl:|3x2_xl:/i.test(url)) return 1350;
  if (/(?:^|_)l:|3x2_l:/i.test(url)) return 900;
  if (/(?:^|_)m:|3x2_m:/i.test(url)) return 600;
  if (/(?:^|_)s:|3x2_s:/i.test(url)) return 450;
  return 300;
}

function bestImageFromTag(tag: string) {
  const options: Array<{ url: string; width: number }> = [];
  const src = attribute(tag, "src");
  if (src) options.push({ url: decodeHtml(src), width: 0 });
  const srcset = attribute(tag, "srcset");
  for (const part of srcset?.split(",") ?? []) {
    const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
    if (match) options.push({ url: decodeHtml(match[1]), width: Number(match[2]) });
  }
  return options
    .filter((option) => isMorizonImage(option.url))
    .sort((left, right) => right.width - left.width)[0];
}

function extractGalleryCount(html: string) {
  const values = Array.from(html.matchAll(/aria-label=["']\d+\s*\/\s*(\d+)["']/gi), (match) =>
    Number(match[1]),
  );
  return values.length > 0 ? Math.max(...values) : undefined;
}

function imageIdentity(url: string) {
  return (
    url.match(/\/thumb\/([^/]+)\//i)?.[1] ??
    url.replace(/\/(?:3x2_)?(?:xs|s|m|l|xl):[^/]+\//i, "/size/").split("?")[0]
  );
}

function isMorizonImage(value: string) {
  try {
    return /^img\d*\.staticmorizon\.com\.pl$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    decodeHtml(
      html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)`, "i"),
      )?.[1] ??
        html.match(
          new RegExp(
            `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
            "i",
          ),
        )?.[1] ??
        "",
    ) || undefined
  );
}

function attribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    decodeHtml(tag.match(new RegExp(`\\b${escaped}=["']([^"']*)["']`, "i"))?.[1] ?? "") || undefined
  );
}

function parsePolishDate(value?: string) {
  const match = value?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return undefined;
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))).toISOString();
}

function normalizePhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 9) return undefined;
  return digits.startsWith("48") && digits.length >= 11 ? digits.slice(-9) : digits;
}

function numberValue(value?: string) {
  if (!value) return undefined;
  const normalized = value
    .replace(/[\s\u00a0]/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function stripHtml(value: string) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(?:p|li|ul|ol|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeLabel(value: string) {
  return decodeHtml(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function displayLabel(normalized: string) {
  const known: Record<string, string> = {
    "rok budowy": "Rok budowy",
    "typ budynku": "Rodzaj zabudowy",
    pietro: "Piętro",
    balkon: "Balkon",
    "stan nieruchomosci": "Stan nieruchomości",
    "typ kuchni": "Typ kuchni",
    "liczba lazienek": "Liczba łazienek",
  };
  return known[normalized] ?? normalized.charAt(0).toLocaleUpperCase("pl-PL") + normalized.slice(1);
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? "";
}
function stringValue(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}
function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined;
}
function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function typeIncludes(value: unknown, expected: string) {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}
