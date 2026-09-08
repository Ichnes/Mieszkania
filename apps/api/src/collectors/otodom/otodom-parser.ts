import { sanitizeStreetCandidate } from "../../services/geography/address-normalization";
import type { FetchedListingDocument, ListingParser, ParsedListing } from "../types";
import { extractOtodomExternalId } from "./otodom-url";

type JsonRecord = Record<string, unknown>;

export class OtodomParser implements ListingParser {
  async parse(document: FetchedListingDocument): Promise<ParsedListing> {
    const nextData = extractJsonScript(document.html, "__NEXT_DATA__");
    const jsonLd = extractJsonLd(document.html);
    const adNode = getRecordAtPath(nextData, ["props", "pageProps", "ad"]);
    const productNode = findProductNode(jsonLd);
    const fallbackId = extractExternalId(document.finalUrl ?? document.url);

    const title = normalizeTitle(
      firstString(
        readString(adNode, "title"),
        readString(productNode, "name"),
        readString(productNode, "headline"),
        readString(findWebPageNode(jsonLd), "headline"),
        extractMetaTag(document.html, "property", "og:title"),
        extractTitle(document.html),
        `Otodom listing ${fallbackId}`,
      ) ?? `Otodom listing ${fallbackId}`,
    );

    const description = firstString(
      stripHtml(readString(adNode, "description")),
      stripHtml(readString(productNode, "description")),
      extractMetaTag(document.html, "property", "og:description"),
      extractMetaDescription(document.html),
    );

    const addressNode = getRecordAtPath(productNode, ["address"]);
    const geoNode = getRecordAtPath(productNode, ["geo"]);
    const breadcrumbDistrict = inferDistrictFromBreadcrumb(jsonLd);
    const breadcrumbNeighborhood = inferNeighborhoodFromBreadcrumb(jsonLd, breadcrumbDistrict);
    const locationLabel = firstString(
      readString(adNode, "location", "pathName"),
      readString(addressNode, "streetAddress"),
      readString(addressNode, "addressLocality"),
    );
    const city = firstString(
      readString(addressNode, "addressLocality"),
      inferCityFromUrl(document.finalUrl ?? document.url),
      "Unknown",
    )!;
    const district = firstString(
      readString(adNode, "location", "district", "name"),
      breadcrumbDistrict,
      inferDistrictFromText(document.finalUrl ?? document.url),
    );
    const neighborhood = firstString(
      readString(adNode, "location", "pathName"),
      breadcrumbNeighborhood,
      inferDistrictFromText(title),
    );
    const street = firstString(
      readString(addressNode, "streetAddress"),
      extractStreetFromText(description),
      extractStreetFromText(locationLabel),
    );
    const priceAmount = firstNumber(
      readNumber(adNode, "target", "Price"),
      readNumber(getRecordAtPath(productNode, ["offers"]), "price"),
      readNumber(adNode, "price", "value"),
      readNumber(adNode, "totalPrice", "value"),
    );
    const areaSqm = firstNumber(
      readNumber(adNode, "attributes", "m"),
      readNumber(productNode, "floorSize", "value"),
      readNumber(productNode, "floorSize"),
    );
    const rooms = firstNumber(
      readNumber(adNode, "attributes", "rooms_num"),
      readNumber(productNode, "numberOfRooms"),
    );
    const floorInfo = parseFloorInfo(findAdditionalPropertyValue(productNode, "Piętro"));
    const floor = firstNumber(
      parseFloorNumber(readString(adNode, "attributes", "floor_no")),
      readNumber(adNode, "attributes", "floor"),
      floorInfo.floor,
    );
    const totalFloors = firstNumber(
      readNumber(adNode, "attributes", "building_floors_num"),
      floorInfo.totalFloors,
    );
    const yearBuilt = firstNumber(
      readNumber(adNode, "attributes", "build_year"),
      readNumber(adNode, "attributes", "construction_year"),
      readNumberFromString(findAdditionalPropertyValue(productNode, "Rok budowy")),
    );
    const marketType = inferMarketType(
      readString(adNode, "attributes", "market"),
      readString(productNode, "offers", "availability"),
      document.url,
    );
    const latitude = firstNumber(
      readNumber(geoNode, "latitude"),
      readNumber(adNode, "location", "coordinates", "latitude"),
    );
    const longitude = firstNumber(
      readNumber(geoNode, "longitude"),
      readNumber(adNode, "location", "coordinates", "longitude"),
    );
    const sourceContactPhone = extractSourceContactPhone(adNode, productNode);
    const addressText = compactAddress(street, district, city);
    const imageUrls = collectListingImages(adNode, productNode, document.html);
    const publishedAt = extractPublishedAt(
      adNode,
      productNode,
      findWebPageNode(jsonLd),
      document.html,
    );
    const portalFeatures = extractOtodomPortalFeatures(document.html, productNode);

    return {
      externalId: fallbackId,
      canonicalUrl: document.finalUrl ?? document.url,
      title,
      description: description ?? undefined,
      city,
      district: district ?? undefined,
      neighborhood: neighborhood ?? undefined,
      street: street ?? undefined,
      addressText: addressText ?? locationLabel ?? undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      sourceContactPhone: sourceContactPhone ?? undefined,
      priceAmount: priceAmount ?? undefined,
      areaSqm: areaSqm ?? undefined,
      rooms: rooms ?? undefined,
      floor: floor ?? undefined,
      totalFloors: totalFloors ?? undefined,
      yearBuilt: yearBuilt ?? undefined,
      publishedAt: publishedAt ?? undefined,
      marketType,
      offerType: "sale",
      status: isUnavailableOfferPage(`${document.html} ${title} ${description ?? ""}`)
        ? "removed"
        : "active",
      images: imageUrls.map((sourceUrl, index) => ({
        sourceUrl,
        position: index,
        isPrimary: index === 0,
      })),
      rawPayload: {
        nextData,
        jsonLd,
        portalFeatures,
        url: document.url,
        statusCode: document.statusCode,
      },
    };
  }
}

function extractOtodomPortalFeatures(html: string, productNode: JsonRecord | null) {
  const liftFromDetails = html.match(
    /<div[^>]*>\s*Winda\s*(?:<!--[\s\S]*?-->)?\s*:?\s*<\/div>\s*<div[^>]*>\s*(tak|nie)\s*<\/div>/i,
  )?.[1];
  const lift = firstString(liftFromDetails, findAdditionalPropertyValue(productNode, "Winda"));
  const detailValue = (label: string) =>
    html
      .match(
        new RegExp(
          "<div[^>]*>\\s*" +
            label +
            "\\s*(?:<!--[\\s\\S]*?-->)?\\s*:?\\s*</div>\\s*<div[^>]*>\\s*([^<]+)\\s*</div>",
          "i",
        ),
      )?.[1]
      ?.trim();
  const finishQuality = firstString(
    detailValue("Stan wykończenia"),
    findAdditionalPropertyValue(productNode, "Stan wykończenia"),
  );
  const fees = firstString(
    detailValue("Czynsz"),
    findAdditionalPropertyValue(productNode, "Czynsz"),
  );
  return lift || finishQuality || fees
    ? {
        ...(lift ? { lift } : {}),
        ...(finishQuality ? { finishQuality } : {}),
        ...(fees ? { fees } : {}),
      }
    : undefined;
}

function isUnavailableOfferPage(value: string) {
  return /oferta (?:nie jest|jest juz) dostepna|to ogloszenie nie jest juz dostepne|pod tym adresem nic nie ma|nieruchomosc ma juz nowego wlasciciela/i.test(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l"),
  );
}

function extractPublishedAt(
  adNode: JsonRecord | null,
  productNode: JsonRecord | null,
  webPageNode: JsonRecord | null,
  html: string,
) {
  return firstValidIsoDate(
    readString(adNode, "createdAt"),
    readString(adNode, "created_at"),
    readString(adNode, "dateCreated"),
    readString(adNode, "datePublished"),
    readString(adNode, "publishedAt"),
    readString(adNode, "published_at"),
    readString(productNode, "datePublished"),
    readString(productNode, "datePosted"),
    readString(productNode, "dateCreated"),
    readString(webPageNode, "datePublished"),
    readString(webPageNode, "dateCreated"),
    extractMetaContent(html, "article:published_time"),
    extractMetaContent(html, "og:published_time"),
    extractMetaContent(html, "datePublished"),
  );
}

function extractJsonScript(html: string, scriptId: string) {
  const pattern = new RegExp(
    `<script[^>]+id=["']${escapeRegExp(scriptId)}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i",
  );
  const match = html.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractJsonLd(html: string) {
  const matches = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1]?.trim(),
  ).filter(Boolean);

  for (const value of matches) {
    try {
      return JSON.parse(value as string);
    } catch {
      continue;
    }
  }

  return null;
}

function findProductNode(value: unknown) {
  const graph = getArrayAtPath(value, ["@graph"]);

  if (graph) {
    for (const item of graph) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = (item as JsonRecord)["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (
        types.some((entry) => typeof entry === "string" && ["Product", "Apartment"].includes(entry))
      ) {
        return item as JsonRecord;
      }
    }
  }

  return getRecord(value);
}

function findWebPageNode(value: unknown) {
  const graph = getArrayAtPath(value, ["@graph"]);

  if (graph) {
    for (const item of graph) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = (item as JsonRecord)["@type"];
      if (type === "WebPage") {
        return item as JsonRecord;
      }
    }
  }

  return null;
}

function collectListingImages(
  adNode: JsonRecord | null,
  productNode: JsonRecord | null,
  html: string,
) {
  const imageUrls = [
    ...collectImagesFromAd(adNode),
    ...collectImagesFromProduct(productNode),
    ...extractOpenGraphImages(html),
  ];

  return dedupe(imageUrls);
}

function collectImagesFromAd(adNode: JsonRecord | null) {
  const images = getArrayAtPath(adNode, ["images"]) ?? [];
  const results: string[] = [];

  for (const image of images) {
    if (!image || typeof image !== "object") {
      continue;
    }

    const record = image as JsonRecord;
    const candidate = firstString(
      readString(record, "large"),
      readString(record, "original"),
      readString(record, "medium"),
      readString(record, "small"),
      readString(record, "thumbnail"),
      readString(record, "url"),
    );

    if (candidate && isImageUrl(candidate)) {
      results.push(candidate);
    }
  }

  return results;
}

function collectImagesFromProduct(productNode: JsonRecord | null) {
  const results: string[] = [];
  const imageValue = productNode?.image;

  if (typeof imageValue === "string" && isImageUrl(imageValue)) {
    results.push(imageValue);
  }

  if (Array.isArray(imageValue)) {
    for (const entry of imageValue) {
      if (typeof entry === "string" && isImageUrl(entry)) {
        results.push(entry);
      }
    }
  }

  return results;
}

function extractOpenGraphImages(html: string) {
  return Array.from(
    html.matchAll(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']\s*\/?>/gi),
    (match) => sanitizeMetaContent(match[1]),
  ).filter((value): value is string => typeof value === "string" && isImageUrl(value));
}

function extractTitle(html: string) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return sanitizeMetaContent(match?.[1] ?? null);
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
  if (!value) {
    return null;
  }

  return value
    .replace(/"[^"]*data-next-head[^"]*$/i, "")
    .replace(/\s+data-next-head=.*$/i, "")
    .trim();
}

function compactAddress(street: string | null, district: string | null, city: string | null) {
  const parts = [street, district, city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function extractSourceContactPhone(adNode: JsonRecord | null, productNode: JsonRecord | null) {
  return firstString(
    normalizePhone(readString(adNode, "contact", "phone")),
    normalizePhone(readString(adNode, "contact", "telephone")),
    normalizePhone(readString(adNode, "advertiser", "phone")),
    normalizePhone(readString(adNode, "advertiser", "telephone")),
    normalizePhone(readFirstPhoneNumber(adNode, ["advertiser", "phones"])),
    normalizePhone(readFirstPhoneNumber(adNode, ["contact", "phones"])),
    normalizePhone(readString(getRecordAtPath(productNode, ["seller"]), "telephone")),
    normalizePhone(readString(getRecordAtPath(productNode, ["offers", "seller"]), "telephone")),
    normalizePhone(readString(productNode, "telephone")),
  );
}

function inferCityFromUrl(url: string) {
  return url.toLowerCase().includes("warszawa") ? "Warszawa" : null;
}

function inferDistrictFromBreadcrumb(jsonLd: unknown) {
  const graph = getArrayAtPath(jsonLd, ["@graph"]) ?? [];
  const webPage = graph.find((item) => getRecord(item)?.["@type"] === "WebPage");
  const breadcrumbItems = getArrayAtPath(webPage, ["breadcrumb", "itemListElement"]) ?? [];
  const names = breadcrumbItems
    .map((item) => readString(getRecordAtPath(item, ["item"]), "name"))
    .filter((value): value is string => Boolean(value));

  for (const name of names) {
    const district = inferDistrictFromText(name);
    if (district) {
      return district;
    }
  }

  return null;
}

function inferNeighborhoodFromBreadcrumb(jsonLd: unknown, district: string | null) {
  const graph = getArrayAtPath(jsonLd, ["@graph"]) ?? [];
  const webPage = graph.find((item) => getRecord(item)?.["@type"] === "WebPage");
  const breadcrumbItems = getArrayAtPath(webPage, ["breadcrumb", "itemListElement"]) ?? [];
  const names = breadcrumbItems
    .map((item) => readString(getRecordAtPath(item, ["item"]), "name"))
    .filter((value): value is string => Boolean(value));
  const lastArea = names.at(-2) ?? null;

  if (!lastArea) {
    return null;
  }

  return district && normalizePolish(lastArea) === normalizePolish(district) ? null : lastArea;
}

function inferDistrictFromText(text: string | null | undefined) {
  if (!text) {
    return null;
  }

  const normalized = normalizePolish(text);
  const knownDistricts = [
    "goclaw",
    "mokotow",
    "wola",
    "ursynow",
    "bemowo",
    "bialoleka",
    "praga poludnie",
    "ochota",
    "zoliborz",
    "wilanow",
    "ursus",
    "targowek",
    "wlochy",
    "wawer",
  ];

  const found = knownDistricts.find((district) => normalized.includes(district));
  return found ? titleCase(found) : null;
}

function inferMarketType(market: string | null, availability: string | null, url: string) {
  const normalizedMarket = normalizePolish(market ?? "");

  if (normalizedMarket.includes("primary") || normalizedMarket.includes("pierw")) {
    return "primary" as const;
  }

  if (normalizedMarket.includes("secondary") || normalizedMarket.includes("wtor")) {
    return "secondary" as const;
  }

  if (availability?.includes("InStock") && url.includes("rynek-pierwotny")) {
    return "primary" as const;
  }

  return "secondary" as const;
}

function extractStreetFromText(text: string | null | undefined) {
  if (!text) {
    return null;
  }

  const stripped = stripHtml(text) ?? text;
  const match = stripped.match(/\b(?:ul\.?|ulica)\s+([A-ZĄĆĘŁŃÓŚŹŻ0-9][^,.;<\n]{1,80})/i);
  return sanitizeStreetCandidate(match?.[1]);
}

function parseFloorNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseFloorInfo(value: string | null) {
  if (!value) {
    return { floor: null, totalFloors: null };
  }

  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    floor: match ? Number(match[1]) : null,
    totalFloors: match ? Number(match[2]) : null,
  };
}

function findAdditionalPropertyValue(productNode: JsonRecord | null, name: string) {
  const properties = getArrayAtPath(productNode, ["additionalProperty"]) ?? [];

  for (const property of properties) {
    const record = getRecord(property);
    if (!record) {
      continue;
    }

    if (readString(record, "name") === name) {
      return readString(record, "value");
    }
  }

  return null;
}

function getRecordAtPath(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as JsonRecord)[segment];
  }

  return getRecord(current);
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

function readFirstPhoneNumber(value: unknown, path: string[]) {
  const items = getArrayAtPath(value, path) ?? [];
  for (const item of items) {
    const record = getRecord(item);
    const candidate = firstString(
      readString(record, "number"),
      readString(record, "phone"),
      readString(record, "telephone"),
    );
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function readString(value: unknown, ...path: string[]) {
  const node = path.length > 0 ? getValueAtPath(value, path) : value;
  return typeof node === "string" ? node.trim() : null;
}

function readNumber(value: unknown, ...path: string[]) {
  const node = path.length > 0 ? getValueAtPath(value, path) : value;

  if (typeof node === "number") {
    return node;
  }

  if (typeof node === "string") {
    return readNumberFromString(node);
  }

  return null;
}

function readNumberFromString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
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

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePhone(value: string | null | undefined) {
  if (!value) {
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

function getValueAtPath(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as JsonRecord)[segment];
  }

  return current;
}

function stripHtml(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstString(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function firstNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function normalizeTitle(value: string) {
  return value
    .replace(/\s*-\s*Otodom.*$/i, "")
    .replace(/\s*\|\s*Otodom.*$/i, "")
    .trim();
}

function normalizePolish(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function isImageUrl(value: string) {
  return /^https?:\/\/.+(?:image|jpg|jpeg|png|webp)(?:[;?].*)?$/i.test(value);
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractExternalId(url: string) {
  const externalId = extractOtodomExternalId(url);
  if (!externalId) throw new Error("INVALID_OTODOM_LISTING_URL");
  return externalId;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
