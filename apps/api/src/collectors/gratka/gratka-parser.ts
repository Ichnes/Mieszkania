import { sanitizeStreetCandidate } from "../../services/geography/address-normalization";
import {
  canonicalWarsawNeighborhood,
  inferWarsawNeighborhood,
} from "../../services/geography/warsaw-neighborhoods";
import type { FetchedListingDocument, ListingParser, ParsedListing } from "../types";

type JsonRecord = Record<string, unknown>;

export class GratkaParser implements ListingParser {
  async parse(document: FetchedListingDocument): Promise<ParsedListing> {
    const primaryHtml = extractPrimaryContentWindow(document.html);
    const jsonLd = extractJsonLdDocuments(document.html);
    const productNode = findProductNode(jsonLd);
    const webPageNode = findWebPageNode(jsonLd);
    const offerNode = getRecordAtPath(productNode, ["offers"]);
    const addressNode = getRecordAtPath(productNode, ["address"]);
    const geoNode = getRecordAtPath(productNode, ["geo"]);
    const breadcrumbs = findBreadcrumbNames(jsonLd);
    const redirectedAwayFromOffer = isRedirectedAwayFromRequestedOffer(document);
    const listingUrl = redirectedAwayFromOffer ? document.url : (document.finalUrl ?? document.url);
    const fallbackId = extractExternalId(listingUrl);
    const title = normalizeTitle(
      firstString(
        readString(productNode, "name"),
        readString(productNode, "headline"),
        readString(webPageNode, "headline"),
        extractMetaTag(document.html, "property", "og:title"),
        extractTitle(primaryHtml),
        extractTitle(document.html),
        `Gratka listing ${fallbackId}`,
      ) ?? `Gratka listing ${fallbackId}`,
    );
    const description = firstString(
      stripHtml(readString(productNode, "description")),
      stripHtml(readString(webPageNode, "description")),
      extractMetaTag(document.html, "property", "og:description"),
      extractMetaDescription(primaryHtml),
      extractMetaDescription(document.html),
    );
    const additionalProperties = getArrayAtPath(productNode, ["additionalProperty"]) ?? [];
    const htmlAddress = extractAddressFromHtml(primaryHtml);
    const street = cleanLocationLabel(
      firstString(
        readString(addressNode, "streetAddress"),
        htmlAddress?.street,
        breadcrumbs.street,
        extractStreetFromText(description),
        extractStreetFromText(title),
      ),
    );
    const city = firstString(
      readString(addressNode, "addressLocality"),
      htmlAddress?.city,
      breadcrumbs.city,
      inferCityFromUrl(document.finalUrl ?? document.url),
      "Unknown",
    )!;
    const locationHaystack = [
      title,
      description,
      street,
      readString(addressNode, "streetAddress"),
      city,
    ]
      .filter(Boolean)
      .join(" ");
    const district =
      htmlAddress?.district ?? breadcrumbs.district ?? inferDistrictFromText(locationHaystack);
    const neighborhood =
      canonicalWarsawNeighborhood(htmlAddress?.neighborhood, district) ??
      canonicalWarsawNeighborhood(breadcrumbs.neighborhood, district) ??
      inferNeighborhoodFromText(locationHaystack, district);
    const priceAmount = firstNumber(
      readNumber(productNode, "price"),
      readNumber(offerNode, "price"),
      readAdditionalPropertyNumber(additionalProperties, "Cena"),
      extractPriceFromMeta(document.html),
      extractPriceFromText(primaryHtml),
      extractPriceFromText(description),
      extractPriceFromText(extractMetaDescription(document.html)),
      extractPriceFromText(title),
    );
    const areaSqm = firstNumber(
      readNumber(productNode, "floorSize"),
      readAdditionalPropertyNumber(additionalProperties, "Powierzchnia"),
      readAdditionalPropertyNumber(additionalProperties, "Powierzchnia w m2"),
      extractAreaFromText(primaryHtml),
      extractAreaFromText(description),
      extractAreaFromText(title),
      extractAreaFromText(extractMetaDescription(document.html)),
    );
    const rooms = sanitizeRoomsValue(
      firstNumber(
        sanitizeRoomsValue(readNumber(productNode, "numberOfRooms")),
        readAdditionalPropertyNumber(additionalProperties, "Liczba pokoi"),
        extractRoomsFromText(primaryHtml),
        extractRoomsFromText(description),
        extractRoomsFromText(title),
      ),
    );
    const floorInfo = firstString(
      readAdditionalPropertyValue(additionalProperties, "Piętro"),
      readAdditionalPropertyValue(additionalProperties, "Pietro"),
    );
    const { floor, totalFloors } = parseFloorInfo(floorInfo);
    const htmlCoordinates = extractCoordinatesFromHtml(document.html);
    const latitude = firstNumber(readNumber(geoNode, "latitude"), htmlCoordinates?.latitude);
    const longitude = firstNumber(readNumber(geoNode, "longitude"), htmlCoordinates?.longitude);
    const sourceContactPhone = extractSourceContactPhone(
      productNode,
      offerNode,
      additionalProperties,
      document.html,
      primaryHtml,
    );
    const marketType = inferMarketType(
      firstString(
        readAdditionalPropertyValue(additionalProperties, "Rynek"),
        document.finalUrl?.toLowerCase().includes("/pierwotny") ? "pierwotny" : "wtórny",
      ),
    );
    const addressText = firstString(
      compactAddress(street, neighborhood ?? district, city),
      htmlAddress?.addressText,
    );
    const imageUrls = collectListingImages(
      productNode,
      document.html,
      primaryHtml,
      title,
      fallbackId,
    );
    const publishedAt = extractPublishedAt(
      productNode,
      offerNode,
      webPageNode,
      document.html,
      primaryHtml,
    );

    return {
      externalId: fallbackId,
      canonicalUrl: listingUrl,
      title,
      description: description ?? undefined,
      city,
      district: district ?? undefined,
      neighborhood: neighborhood ?? undefined,
      street: street ?? undefined,
      addressText: addressText ?? undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      sourceContactPhone: sourceContactPhone ?? undefined,
      priceAmount: priceAmount ?? undefined,
      areaSqm: areaSqm ?? undefined,
      rooms: rooms ?? undefined,
      floor: floor ?? undefined,
      totalFloors: totalFloors ?? undefined,
      publishedAt: publishedAt ?? undefined,
      marketType,
      offerType: "sale",
      status:
        redirectedAwayFromOffer ||
        document.statusCode === 404 ||
        /to ogloszenie nie jest juz dostepne|pod tym adresem nic nie ma|oferta nie jest dostepna/i.test(
          `${document.html} ${title} ${description ?? ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[łŁ]/g, "l"),
        )
          ? "removed"
          : "active",
      images: imageUrls.map((sourceUrl, index) => ({
        sourceUrl,
        position: index,
        isPrimary: index === 0,
      })),
      rawPayload: {
        jsonLd,
        html: document.html,
        primaryHtml,
        url: document.url,
        statusCode: document.statusCode,
      },
    };
  }
}

function extractPublishedAt(
  productNode: JsonRecord | null,
  offerNode: JsonRecord | null,
  webPageNode: JsonRecord | null,
  html: string,
  primaryHtml: string,
) {
  return firstValidIsoDate(
    readString(productNode, "datePublished"),
    readString(productNode, "datePosted"),
    readString(productNode, "dateCreated"),
    readString(offerNode, "datePublished"),
    readString(offerNode, "datePosted"),
    readString(offerNode, "dateCreated"),
    readString(webPageNode, "datePublished"),
    readString(webPageNode, "dateCreated"),
    extractMetaContent(primaryHtml, "article:published_time"),
    extractMetaContent(html, "article:published_time"),
    extractMetaContent(primaryHtml, "og:published_time"),
    extractMetaContent(html, "og:published_time"),
    extractMetaContent(primaryHtml, "datePublished"),
    extractMetaContent(html, "datePublished"),
  );
}

function extractExternalId(url: string) {
  const match = url.match(/\/ob\/(\d+)/i);
  return match
    ? `gratka-${match[1]}`
    : `gratka-${Buffer.from(url).toString("base64url").slice(0, 12)}`;
}

function isRedirectedAwayFromRequestedOffer(document: FetchedListingDocument) {
  if (!document.finalUrl) return false;

  const requestedOfferId = document.url.match(/\/ob\/(\d+)/i)?.[1];
  if (!requestedOfferId) return false;

  const finalOfferId = document.finalUrl.match(/\/ob\/(\d+)/i)?.[1];
  return finalOfferId !== requestedOfferId;
}

function extractJsonLdDocuments(html: string) {
  const matches = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1]?.trim(),
  ).filter(Boolean);
  const documents: unknown[] = [];

  for (const value of matches) {
    try {
      documents.push(JSON.parse(value as string));
    } catch {
      continue;
    }
  }

  return documents;
}

function findProductNode(values: unknown[]) {
  for (const item of expandJsonLdCandidates(values)) {
    const record = getRecord(item);
    const type = record?.["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (
      types.some(
        (entry) =>
          typeof entry === "string" &&
          ["Product", "Apartment", "Offer", "SingleFamilyResidence", "Residence"].includes(entry),
      )
    ) {
      return record;
    }
  }

  return getRecord(values[0]);
}

function findWebPageNode(values: unknown[]) {
  for (const item of expandJsonLdCandidates(values)) {
    const record = getRecord(item);
    const type = record?.["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((entry) => entry === "WebPage")) {
      return record;
    }
  }

  return null;
}

function expandJsonLdCandidates(values: unknown[]) {
  const candidates: unknown[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      candidates.push(...value);
      continue;
    }

    const graph = getArrayAtPath(value, ["@graph"]);
    if (graph) {
      candidates.push(...graph);
      continue;
    }

    candidates.push(value);
  }

  return candidates;
}

function findBreadcrumbNames(values: unknown[]) {
  const result: { city?: string; district?: string; neighborhood?: string; street?: string } = {};
  let bestScore = -1;

  for (const item of expandJsonLdCandidates(values)) {
    const record = getRecord(item);
    const type = record?.["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((entry) => entry === "BreadcrumbList")) {
      continue;
    }

    const items = getArrayAtPath(record, ["itemListElement"]) ?? [];
    const names = items
      .map((entry) => {
        const listItem = getRecord(entry);
        return readString(listItem, "name");
      })
      .filter((value): value is string => Boolean(value));

    const city = names.find((value) => normalizeComparable(value) === "warszawa");
    const district = names.find((value) => isKnownDistrict(value));
    const districtIndex = names.findIndex((value) => isKnownDistrict(value));
    const locationTail = (districtIndex >= 0 ? names.slice(districtIndex + 1) : names).filter(
      (value) =>
        isUsefulLocationLabel(value) &&
        !isKnownDistrict(value) &&
        normalizeComparable(value) !== "warszawa" &&
        !normalizeComparable(value).includes("gratka.pl"),
    );
    const neighborhood = canonicalWarsawNeighborhood(locationTail[0], district);
    const street = neighborhood ? locationTail[1] : locationTail.at(-1);
    const score = (city ? 1 : 0) + (district ? 4 : 0) + (neighborhood ? 2 : 0) + (street ? 3 : 0);

    // A page has several breadcrumb lists. Keep the most complete geographic one
    // instead of allowing a generic navigation breadcrumb to overwrite it.
    if (score > bestScore) {
      bestScore = score;
      result.city = city;
      result.district = district;
      result.neighborhood = neighborhood;
      result.street = street;
    }
  }

  return result;
}

function collectListingImages(
  productNode: JsonRecord | null,
  html: string,
  primaryHtml: string,
  listingTitle: string,
  externalId: string,
) {
  const productImages = [
    ...toImageList(productNode?.image),
    ...extractPrimaryHtmlImages(primaryHtml, listingTitle),
    ...extractOpenGraphImages(html),
    ...extractHtmlListingImages(html, externalId),
  ];

  return dedupeImageVariants(productImages, externalId).slice(0, 50);
}

function toImageList(value: unknown): string[] {
  if (typeof value === "string") {
    return isImageUrl(value) ? [value] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return isImageUrl(item) ? [item] : [];
    }

    const record = getRecord(item);
    const candidate = firstString(readString(record, "url"), readString(record, "contentUrl"));
    return candidate && isImageUrl(candidate) ? [candidate] : [];
  });
}

function extractOpenGraphImages(html: string) {
  return Array.from(
    html.matchAll(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']\s*\/?>/gi),
    (match) => sanitizeMetaContent(match[1]),
  ).filter((value): value is string => typeof value === "string" && isImageUrl(value));
}

function extractPrimaryHtmlImages(primaryHtml: string, listingTitle: string) {
  const listingNeedle = normalizeComparable(listingTitle);
  const matches = extractImageTagCandidates(primaryHtml);

  const directMatches = matches.filter((candidate) => {
    return listingNeedle && normalizeComparable(candidate.alt ?? "").includes(listingNeedle);
  });

  return (directMatches.length > 0 ? directMatches : matches)
    .flatMap((candidate) => candidate.urls)
    .filter(isImageUrl)
    .slice(0, 30);
}

function extractHtmlListingImages(html: string, externalId: string) {
  const numericId = extractNumericExternalId(externalId);
  const normalizedHtml = decodeLooseHtml(html);
  const tagUrls = extractImageTagCandidates(normalizedHtml).flatMap((candidate) => candidate.urls);
  const rawUrls = Array.from(
    normalizedHtml.matchAll(
      /https?:\/\/(?:thumbs\.cdngr\.pl|img\d*\.staticmorizon\.com\.pl|d-gr\.cdngr\.pl)[^"'<>\s)\\]+/gi,
    ),
    (match) => cleanupImageUrl(match[0]),
  );

  return [...tagUrls, ...rawUrls]
    .map(cleanupImageUrl)
    .filter(isImageUrl)
    .filter((url) => !numericId || imageBelongsToListing(url, numericId));
}

function extractImageTagCandidates(html: string) {
  return Array.from(html.matchAll(/<img\b[^>]*>/gi), (match) => {
    const tag = match[0];
    return {
      alt: sanitizeMetaContent(readHtmlAttribute(tag, "alt")),
      urls: ["src", "data-src", "data-lazy-src", "srcset", "data-srcset"]
        .flatMap((attribute) => splitImageAttribute(readHtmlAttribute(tag, attribute)))
        .map(cleanupImageUrl)
        .filter(Boolean),
    };
  });
}

function readHtmlAttribute(tag: string, name: string) {
  const pattern = new RegExp(`${name}=["']([\\s\\S]*?)["']`, "i");
  return tag.match(pattern)?.[1] ?? null;
}

function splitImageAttribute(value: string | null) {
  if (!value) {
    return [];
  }

  return decodeLooseHtml(value)
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function cleanupImageUrl(value: string) {
  return decodeLooseHtml(value)
    .replace(/[,\].;]+$/g, "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .trim();
}

function decodeLooseHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

function extractNumericExternalId(externalId: string) {
  return externalId.match(/^gratka-(\d+)$/i)?.[1] ?? null;
}

function imageBelongsToListing(url: string, numericId: string) {
  if (url.includes(numericId)) {
    return true;
  }

  const decodedThumb = decodeThumbPayload(url);
  return decodedThumb?.includes(numericId) ?? false;
}

function decodeThumbPayload(url: string) {
  const match = url.match(/\/thumb\/([^/]+)/i);
  if (!match) {
    return null;
  }

  try {
    return Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
}

function dedupeImageVariants(values: string[], externalId: string) {
  const numericId = extractNumericExternalId(externalId);
  const byKey = new Map<string, string>();

  for (const value of values
    .map(cleanupImageUrl)
    .filter(isImageUrl)
    .map(preferLargestGratkaVariant)) {
    if (numericId && !imageBelongsToListing(value, numericId)) {
      continue;
    }

    const key = imageDedupeKey(value, numericId);
    const existing = byKey.get(key);
    if (!existing || imageQualityScore(value) > imageQualityScore(existing)) {
      byKey.set(key, value);
    }
  }

  return Array.from(byKey.values());
}

function preferLargestGratkaVariant(url: string) {
  const match = url.match(
    /^https?:\/\/(?:thumbs\.cdngr\.pl|img\d*\.staticmorizon\.com\.pl)\/thumb\/([^/]+)\/(?:3x2_[a-z]+(?::[^/]*)?|og_image(?::[^/]*)?)\/(.+)$/i,
  );
  if (!match) {
    return url;
  }

  // Every Gratka srcset exposes the same source image through this uncropped
  // 1350 px transform. Normalize all preview/OG variants to that endpoint so
  // saved offers and the shared photo downloader use the largest version.
  return `https://thumbs.cdngr.pl/thumb/${match[1]}/3x2_xl:fit/${match[2]}`;
}

function imageDedupeKey(url: string, numericId: string | null) {
  const decodedThumb = decodeThumbPayload(url);
  const keySource = decodedThumb ?? url;
  const listingImageKey = numericId
    ? keySource.match(new RegExp(`(${escapeRegExp(numericId)}_\\d+)`, "i"))?.[1]
    : keySource.match(/(\d{6,}_\d+)/)?.[1];

  if (listingImageKey) {
    return listingImageKey;
  }

  return keySource.replace(/\/(?:3x2_[a-z]+|og_image)(?::[^/]*)?\//i, "/");
}

function imageQualityScore(url: string) {
  const fitBonus = /:fit(?:\/|$)/i.test(url) ? 5 : 0;
  if (/3x2_xl/i.test(url)) {
    return 110 + fitBonus;
  }
  if (/og_image/i.test(url)) {
    return 100;
  }
  if (/3x2_l/i.test(url)) {
    return 90 + fitBonus;
  }
  if (/3x2_m/i.test(url)) {
    return 80 + fitBonus;
  }
  if (/3x2_s/i.test(url)) {
    return 60 + fitBonus;
  }
  if (/3x2_xs/i.test(url)) {
    return 40 + fitBonus;
  }
  return 50;
}

function inferMarketType(value?: string | null): "primary" | "secondary" {
  const normalized = normalizeComparable(value ?? "");
  return normalized.includes("pierw") ? "primary" : "secondary";
}

function parseFloorInfo(value?: string | null) {
  if (!value) {
    return { floor: undefined, totalFloors: undefined };
  }

  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return {
      floor: Number(match[1]),
      totalFloors: Number(match[2]),
    };
  }

  const single = value.match(/(\d+)/);
  return {
    floor: single ? Number(single[1]) : undefined,
    totalFloors: undefined,
  };
}

function readAdditionalPropertyValue(properties: unknown[], name: string) {
  for (const item of properties) {
    const record = getRecord(item);
    if (!record) {
      continue;
    }

    const propertyName = normalizeComparable(readString(record, "name") ?? "");
    if (propertyName === normalizeComparable(name)) {
      return readString(record, "value");
    }
  }

  return null;
}

function readAdditionalPropertyNumber(properties: unknown[], name: string) {
  return parseLooseNumber(readAdditionalPropertyValue(properties, name));
}

function extractPriceFromMeta(html: string) {
  return parseLooseNumber(
    extractMetaTag(html, "property", "product:price:amount") ??
      extractMetaTag(html, "name", "price"),
  );
}

function extractPriceFromText(value?: string | null) {
  if (!value) {
    return null;
  }

  const priceAfterZa = value.match(/\bza\s+(\d[\d\s.,]{4,})\s*zł/i);
  if (priceAfterZa?.[1]) {
    return parseLooseNumber(priceAfterZa[1]);
  }

  const genericPrice = value.match(/\b(\d[\d\s]{4,})\s*zł\b/i);
  return genericPrice?.[1] ? parseLooseNumber(genericPrice[1]) : null;
}

function extractAreaFromText(value?: string | null) {
  const match = value?.match(/(\d{2,3}(?:[.,]\d{1,2})?)\s*m(?:2|²)/i);
  return match?.[1] ? parseLooseNumber(match[1]) : null;
}

function extractRoomsFromText(value?: string | null) {
  if (!value) {
    return null;
  }

  const patterns = [
    /\b(\d{1,2})\s*[-/]?\s*pok(?:oje|oi|\.|ój)?\b/i,
    /\b(\d{1,2})-pokojowe\b/i,
    /\b(\d{1,2})\s*rooms?\b/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const rooms = Number(match[1]);
    if (Number.isFinite(rooms) && rooms >= 1 && rooms <= 15) {
      return rooms;
    }
  }

  return null;
}

function extractStreetFromText(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(
    /\b(?:na\s+ulicy|przy\s+ulicy|ul\.?|ulica)\s+([\p{L}0-9 .-]{2,80}?)(?=\s+(?:BUDYNEK|OSIEDLE|NIERUCHOMOŚĆ|ROZKŁAD|LOKALIZACJA|OKOLICA)\b|[,.;\n]|$)/iu,
  );
  return sanitizeStreetCandidate(match?.[1]);
}

function inferCityFromUrl(url: string) {
  return url.toLowerCase().includes("warszawa") ? "Warszawa" : null;
}

function inferDistrictFromText(value: string) {
  const normalized = normalizeComparable(value);
  const aliases: Array<[string, string]> = [
    ["bemowo", "Bemowo"],
    ["bialoleka", "Białołęka"],
    ["bielany", "Bielany"],
    ["mokotow", "Mokotów"],
    ["ochota", "Ochota"],
    ["praga polnoc", "Praga-Północ"],
    ["praga poludnie", "Praga-Południe"],
    ["srodmiescie", "Śródmieście"],
    ["targowek", "Targówek"],
    ["ursus", "Ursus"],
    ["ursynow", "Ursynów"],
    ["wawer", "Wawer"],
    ["wesola", "Wesoła"],
    ["wilanow", "Wilanów"],
    ["wlochy", "Włochy"],
    ["wola", "Wola"],
    ["zoliborz", "Żoliborz"],
    ["okecie", "Włochy"],
    ["goclaw", "Praga-Południe"],
    ["grochow", "Praga-Południe"],
    ["saska kepa", "Praga-Południe"],
    ["stara praga", "Praga-Północ"],
    ["nowa praga", "Praga-Północ"],
    ["kabaty", "Ursynów"],
    ["natolin", "Ursynów"],
    ["imielin", "Ursynów"],
    ["stoklosy", "Ursynów"],
    ["chrzanow", "Bemowo"],
  ];

  for (const [needle, district] of aliases) {
    if (normalized.includes(needle)) {
      return district;
    }
  }

  return null;
}

function inferNeighborhoodFromText(value: string, district: string | null) {
  return inferWarsawNeighborhood(value, district) ?? null;
}

function isKnownDistrict(value: string) {
  return [
    "Bemowo",
    "Białołęka",
    "Bielany",
    "Mokotów",
    "Ochota",
    "Praga-Północ",
    "Praga-Południe",
    "Śródmieście",
    "Targówek",
    "Ursus",
    "Ursynów",
    "Wawer",
    "Wesoła",
    "Wilanów",
    "Włochy",
    "Wola",
    "Żoliborz",
  ].some((district) => normalizeComparable(district) === normalizeComparable(value));
}

function normalizeTitle(value: string) {
  return value
    .replace(/\s*[-|•]\s*gratka.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compactAddress(...parts: Array<string | null | undefined>) {
  const filtered = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(", ") : null;
}

function cleanLocationLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return isUsefulLocationLabel(trimmed) ? trimmed : null;
}

function isUsefulLocationLabel(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalized = normalizeComparable(value);
  if (!normalized || normalized.length < 3) {
    return false;
  }

  return ![
    "mieszkania na sprzedaz",
    "mieszkanie na sprzedaz",
    "mazowieckie",
    "wojewodztwo mazowieckie",
    "nieruchomosci",
    "ogloszenia",
    "gratka pl",
    "sprzedaz",
    "mieszkania",
  ].some((generic) => normalized === generic || normalized.includes(generic));
}

function extractSourceContactPhone(
  productNode: JsonRecord | null,
  offerNode: JsonRecord | null,
  additionalProperties: unknown[],
  html: string,
  primaryHtml: string,
) {
  return firstString(
    extractTopContactPhoneFromHtml(primaryHtml),
    extractTopContactPhoneFromHtml(html),
    extractSerializedAgentPhoneFromHtml(html),
    normalizePhone(readString(productNode, "telephone")),
    normalizePhone(readString(getRecordAtPath(productNode, ["seller"]), "telephone")),
    normalizePhone(readString(getRecordAtPath(offerNode, ["seller"]), "telephone")),
    normalizePhone(readAdditionalPropertyValue(additionalProperties, "Telefon")),
    normalizePhone(readAdditionalPropertyValue(additionalProperties, "Nr telefonu")),
    extractPhoneFromHtml(primaryHtml),
    extractPhoneFromHtml(html),
    extractPhoneFromTelHref(primaryHtml),
    extractPhoneFromTelHref(html),
  );
}

function extractPhoneFromTelHref(html: string) {
  const match = html.match(/href=["']tel:([^"'?#]+)["']/i);
  return normalizePhone(match?.[1] ?? null);
}

function extractTopContactPhoneFromHtml(html: string) {
  const topContactMatch = html.match(
    /(?:topContactPersonName|details-contact__name)[\s\S]{0,2000}?(?:data-cy=["']phoneContactNumber["'][^>]*>|class=["'][^"']*phone-contact__number[^"']*["'][^>]*>)([\s\S]{5,80}?)<\//i,
  );
  return normalizePhone(stripHtml(topContactMatch?.[1] ?? null));
}

function extractSerializedAgentPhoneFromHtml(html: string) {
  const agentPayloadMatch = html.match(/"person"\s*:\s*\d+[\s\S]{0,3000}?"AGENT"/i);
  const phones = Array.from(agentPayloadMatch?.[0].matchAll(/"(\+?\d[\d\s-]{6,16})"/g) ?? [])
    .map((match) => normalizePhone(match[1]))
    .filter((value): value is string => Boolean(value));
  return phones.at(-1) ?? null;
}

function extractPhoneFromHtml(html: string) {
  const patterns = [/\+48[\s-]*\d{3}[\s-]*\d{3}[\s-]*\d{3}/, /\b\d{3}[\s-]*\d{3}[\s-]*\d{3}\b/];

  const normalizedHtml = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

  for (const pattern of patterns) {
    const match = normalizedHtml.match(pattern);
    if (match?.[0]) {
      const normalized = normalizePhone(match[0]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function extractCoordinatesFromHtml(html: string) {
  const patterns: Array<{ latitude: RegExp; longitude: RegExp }> = [
    {
      latitude: /["']latitude["']\s*:\s*["']?(-?\d{1,2}\.\d+)["']?/i,
      longitude: /["']longitude["']\s*:\s*["']?(-?\d{1,3}\.\d+)["']?/i,
    },
    {
      latitude: /data-lat(?:itude)?=["'](-?\d{1,2}\.\d+)["']/i,
      longitude: /data-lon(?:gitude)?|data-lng=["'](-?\d{1,3}\.\d+)["']/i,
    },
  ];

  for (const pattern of patterns) {
    const latitudeMatch = html.match(pattern.latitude);
    const longitudeMatch = html.match(pattern.longitude);
    if (!latitudeMatch?.[1] || !longitudeMatch?.[1]) {
      continue;
    }

    const latitude = Number(latitudeMatch[1]);
    const longitude = Number(longitudeMatch[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

function extractAddressFromHtml(html: string) {
  const plain = html
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const warsawAddressMatch = plain.match(
    /([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9 .-]{3,80}?,\s*(?:Warszawa|[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż -]{3,40}),\s*Warszawa)/i,
  );
  const addressText = warsawAddressMatch?.[1]?.trim() ?? null;
  if (!addressText) {
    return null;
  }

  const segments = addressText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const street = cleanLocationLabel(segments[0]) ?? undefined;
  const middle = segments[1] ?? undefined;
  const city = segments.at(-1) ?? undefined;
  const district =
    middle && isKnownDistrict(middle) ? middle : (inferDistrictFromText(addressText) ?? undefined);
  const neighborhood =
    middle && !isKnownDistrict(middle) ? (cleanLocationLabel(middle) ?? undefined) : undefined;
  const cleanedAddressText = compactAddress(street, neighborhood ?? district, city);

  return {
    addressText: cleanedAddressText ?? addressText,
    street,
    district,
    neighborhood,
    city,
  };
}

function extractTitle(html: string) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return sanitizeMetaContent(match?.[1] ?? null);
}

function extractPrimaryContentWindow(html: string) {
  const marker = html.indexOf("properties-in-slider-wrapper");
  return marker >= 0 ? html.slice(0, marker) : html;
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);
  return sanitizeMetaContent(match?.[1] ?? null);
}

function extractMetaTag(html: string, attribute: "property" | "name", value: string) {
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${escapeRegExp(value)}["']\\s+content=["']([\\s\\S]*?)["']\\s*\\/?>`,
    "i",
  );
  const match = html.match(pattern);
  return sanitizeMetaContent(match?.[1] ?? null);
}

function sanitizeMetaContent(value: string | null) {
  return (
    value
      ?.replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim() ?? null
  );
}

function stripHtml(value: string | null) {
  return (
    value
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? null
  );
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isImageUrl(value: string) {
  return /^https?:\/\/.+/i.test(value) && /(jpg|jpeg|png|webp|image)/i.test(value);
}

function parseLooseNumber(value?: string | null) {
  if (!value) {
    return null;
  }

  const numeric = Number(
    value
      .replace(/[^\d.,-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePhone(value?: string | null) {
  if (!value) {
    return null;
  }

  if (value.includes("...")) {
    return null;
  }

  const normalized = value
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\d+()\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 ? formatPhoneDigits(digits) : null;
}

function formatPhoneDigits(value: string) {
  const digits = value.startsWith("48") && value.length === 11 ? value.slice(2) : value;
  if (digits.length === 9 && isPolishMobileNumber(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  if (digits.length === 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return digits;
}

function isPolishMobileNumber(value: string) {
  return /^(?:4[5-9]|5\d|6\d|7[2389]|8[08])/.test(value);
}

function sanitizeRoomsValue(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value >= 1 && value <= 15 ? value : null;
}

function firstString(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function firstNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function readString(value: unknown, ...path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }
  return typeof current === "string" ? current.trim() : null;
}

function readNumber(value: unknown, ...path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }

  if (typeof current === "number" && Number.isFinite(current)) {
    return current;
  }

  if (typeof current === "string") {
    return parseLooseNumber(current);
  }

  return null;
}

function extractMetaContent(html: string, property: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegExp(property)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  return pattern.exec(html)?.[1]?.trim() ?? null;
}

function firstValidIsoDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const parsed = parseDateCandidate(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseDateCandidate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getRecordAtPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }
  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as JsonRecord)
    : null;
}

function getArrayAtPath(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }
  return Array.isArray(current) ? current : null;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
