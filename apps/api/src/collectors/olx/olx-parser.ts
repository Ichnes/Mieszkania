import type { FetchedListingDocument, ListingParser, ParsedListing } from "../types";
import { normalizeWarsawListingCity } from "../../services/address-normalization";

type JsonRecord = Record<string, unknown>;

export class OlxParser implements ListingParser {
  async parse(document: FetchedListingDocument): Promise<ParsedListing> {
    const fallbackId = extractExternalId(document.finalUrl ?? document.url);
    const jsonLd = extractJsonLd(document.html);
    const state = extractEmbeddedState(document.html);
    const pageText = stripHtml(document.html) ?? "";

    const title = firstString(
      readString(jsonLd, "name"),
      findStringByKey(state, "title"),
      extractMetaTag(document.html, "property", "og:title"),
      extractTitle(document.html),
      `OLX listing ${fallbackId}`
    )!;
    const description = firstString(
      readString(jsonLd, "description"),
      findStringByKey(state, "description"),
      extractMetaTag(document.html, "property", "og:description"),
      extractMetaDescription(document.html)
    );
    const combinedText = `${title}\n${description ?? ""}\n${pageText}`;
    const district = inferDistrictFromText(combinedText);
    const city = normalizeWarsawListingCity(
      firstString(inferCityFromUrl(document.finalUrl ?? document.url), findStringNearLabel(pageText, "Lokalizacja"), "Warszawa"),
      district,
      combinedText
    ) || "Warszawa";
    const street = extractStreetFromText(combinedText);
    const addressText = compactAddress(street, district, city);
    const priceAmount = firstNumber(
      readNumber(getRecordAtPath(jsonLd, ["offers"]), "price"),
      findNumberNearLabel(pageText, "Cena"),
      readNumberFromString(extractMetaTag(document.html, "property", "product:price:amount"))
    );
    const areaSqm = firstNumber(findNumberNearLabel(pageText, "Powierzchnia"), findAreaFromText(combinedText));
    const rooms = firstNumber(findRoomsFromText(combinedText), findNumberNearLabel(pageText, "Liczba pokoi"));
    const floorInfo = parseFloorInfo(firstString(findStringNearLabel(pageText, "Poziom"), findStringNearLabel(pageText, "Piętro")));
    const marketType = normalizePolish(combinedText).includes("rynek pierwotny") ? "primary" : "secondary";
    const publishedAt = firstValidIsoDate(
      readString(jsonLd, "datePublished"),
      readString(jsonLd, "datePosted"),
      readString(jsonLd, "dateCreated"),
      findStringByKey(state, "createdTime"),
      findStringByKey(state, "createdAt"),
      findStringByKey(state, "created_at"),
      findStringByKey(state, "displayDate"),
      extractMetaTag(document.html, "property", "article:published_time"),
      extractMetaTag(document.html, "name", "datePublished")
    );
    const images = collectImages(document.html, jsonLd, state, {
      externalId: fallbackId,
      title,
      url: document.finalUrl ?? document.url
    });

    return {
      externalId: fallbackId,
      canonicalUrl: document.finalUrl ?? document.url,
      title: normalizeTitle(title),
      description: description ?? undefined,
      city,
      district: district ?? undefined,
      street: street ?? undefined,
      addressText: addressText ?? undefined,
      priceAmount: priceAmount ?? undefined,
      areaSqm: areaSqm ?? undefined,
      rooms: rooms ?? undefined,
      floor: floorInfo.floor ?? undefined,
      totalFloors: floorInfo.totalFloors ?? undefined,
      publishedAt: publishedAt ?? undefined,
      marketType,
      offerType: "sale",
      status: "active",
      images: images.map((sourceUrl, index) => ({
        sourceUrl,
        position: index,
        isPrimary: index === 0
      })),
      rawPayload: {
        jsonLd,
        url: document.url,
        finalUrl: document.finalUrl,
        statusCode: document.statusCode
      }
    };
  }
}

function extractJsonLd(html: string) {
  const matches = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1]?.trim()
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

function extractEmbeddedState(html: string) {
  const match = html.match(/window\.__PRERENDERED_STATE__\s*=\s*"([\s\S]*?)";/i);

  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(JSON.parse(`"${match[1]}"`));
  } catch {
    return null;
  }
}

function collectImages(html: string, jsonLd: unknown, state: unknown, context: { externalId: string; title: string; url: string }) {
  const candidates = [
    ...collectJsonLdImages(jsonLd),
    ...collectCurrentAdImages(state, context),
    ...extractOpenGraphImages(html)
  ];
  const bestByKey = new Map<string, string>();

  for (const candidate of candidates) {
    if (!isListingPhotoUrl(candidate)) {
      continue;
    }

    const key = imageIdentity(candidate);
    const current = bestByKey.get(key);
    if (!current || imageQuality(candidate) > imageQuality(current)) {
      bestByKey.set(key, candidate);
    }
  }

  return Array.from(bestByKey.values());
}

function collectJsonLdImages(value: unknown): string[] {
  const record = getRecord(value);
  if (!record) {
    return [];
  }

  const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [record];
  return graph.flatMap((entry) => {
    const item = getRecord(entry);
    if (!item) {
      return [];
    }

    const type = item["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((candidate) => typeof candidate === "string" && ["Product", "Apartment", "Offer"].includes(candidate))) {
      return [];
    }

    return collectGalleryValue(item.image);
  });
}

function collectCurrentAdImages(value: unknown, context: { externalId: string; title: string; url: string }) {
  const records = collectRecords(value);
  const matchingRecords = records.filter((record) => isCurrentListingRecord(record, context));
  return matchingRecords.flatMap((record) => collectGalleryFields(record));
}

function collectRecords(value: unknown): JsonRecord[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRecords(entry));
  }

  const record = value as JsonRecord;
  return [record, ...Object.values(record).flatMap((entry) => collectRecords(entry))];
}

function isCurrentListingRecord(record: JsonRecord, context: { externalId: string; title: string; url: string }) {
  if (!hasGalleryFields(record)) {
    return false;
  }

  const rawId = context.externalId.replace(/^olx-/, "");
  const candidateId = firstString(
    readString(record, "id"),
    readString(record, "adId"),
    readString(record, "listId"),
    readString(record, "externalId")
  );
  const candidateUrl = firstString(readString(record, "url"), readString(record, "href"), readString(record, "canonicalUrl"));
  const candidateTitle = firstString(readString(record, "title"), readString(record, "subject"));

  if (candidateId && normalizeComparableId(candidateId).includes(normalizeComparableId(rawId))) {
    return true;
  }

  if (candidateUrl && extractExternalId(candidateUrl) === context.externalId) {
    return true;
  }

  return Boolean(candidateTitle && normalizeComparable(candidateTitle) === normalizeComparable(context.title));
}

function hasGalleryFields(record: JsonRecord) {
  return ["photos", "images", "gallery"].some((key) => key in record);
}

function collectGalleryFields(record: JsonRecord) {
  return [
    ...collectGalleryValue(record.photos),
    ...collectGalleryValue(record.images),
    ...collectGalleryValue(record.gallery),
    ...collectGalleryValue(record.image)
  ];
}

function collectGalleryValue(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return isImageUrl(value) ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectGalleryValue(entry));
  }

  if (typeof value === "object") {
    const record = value as JsonRecord;
    const direct = firstString(
      readString(record, "link"),
      readString(record, "url"),
      readString(record, "original"),
      readString(record, "large"),
      readString(record, "medium"),
      readString(record, "src")
    );

    if (direct) {
      return [direct];
    }

    return Object.entries(record)
      .filter(([key]) => /link|url|original|large|medium|src|image/i.test(key) && !/thumbnail|thumb|small|icon|avatar|logo/i.test(key))
      .flatMap(([, entry]) => collectGalleryValue(entry));
  }

  return [];
}

function imageIdentity(value: string) {
  try {
    const url = new URL(value);
    const fileMatch = url.pathname.match(/\/files\/([^/;?]+)/i);
    if (fileMatch?.[1]) {
      return `${url.hostname}/files/${fileMatch[1]}`;
    }

    const cleanPath = url.pathname
      .replace(/;\s*s=\d+x\d+/gi, "")
      .replace(/\/image;\s*s=\d+x\d+/gi, "/image")
      .replace(/-\d+x\d+(?=\.)/gi, "");
    return `${url.hostname}${cleanPath}`;
  } catch {
    return value;
  }
}

function imageQuality(value: string) {
  const sizeMatch = value.match(/(?:s=|[-_])(\d{2,4})x(\d{2,4})/i);
  if (!sizeMatch) {
    return value.length;
  }

  return Number(sizeMatch[1]) * Number(sizeMatch[2]);
}

function extractOpenGraphImages(html: string) {
  return Array.from(
    html.matchAll(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']\s*\/?>/gi),
    (match) => sanitizeMetaContent(match[1])
  ).filter((value): value is string => typeof value === "string" && isListingPhotoUrl(value));
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
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${escapeRegExp(value)}["']\\s+content=["']([\\s\\S]*?)["']\\s*\\/?>`, "i");
  const match = html.match(pattern);
  return sanitizeMetaContent(match?.[1] ?? null);
}

function findStringByKey(value: unknown, targetKey: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, targetKey);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const [key, entry] of Object.entries(value as JsonRecord)) {
    if (key === targetKey && typeof entry === "string" && entry.trim()) {
      return entry.trim();
    }

    const found = findStringByKey(entry, targetKey);
    if (found) {
      return found;
    }
  }

  return null;
}

function findStringNearLabel(text: string, label: string) {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*([^\\n]{1,80})`, "i");
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function findNumberNearLabel(text: string, label: string) {
  return readNumberFromString(findStringNearLabel(text, label));
}

function findAreaFromText(text: string) {
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*m(?:2|²|\b)/i);
  return match ? readNumberFromString(match[1]) : null;
}

function findRoomsFromText(text: string) {
  const match = text.match(/(\d+)\s*(?:pokoje|pokoi|pokój)/i);
  return match ? Number(match[1]) : null;
}

function parseFloorInfo(value: string | null) {
  if (!value) {
    return { floor: null, totalFloors: null };
  }

  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return { floor: Number(match[1]), totalFloors: Number(match[2]) };
  }

  const floor = readNumberFromString(value);
  return { floor, totalFloors: null };
}

function extractStreetFromText(text: string) {
  const match = text.match(/\b(?:ul\.?|ulica|przy ulicy)\s+([A-ZĄĆĘŁŃÓŚŹŻ0-9][^,.;\n]{1,60})/i);
  return match?.[1]?.trim() ?? null;
}

function inferDistrictFromText(text: string) {
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
    "srodmiescie"
  ];
  const found = knownDistricts.find((district) => normalized.includes(district));
  return found ? titleCase(found) : null;
}

function inferCityFromUrl(url: string) {
  return normalizePolish(url).includes("warszawa") ? "Warszawa" : null;
}

function compactAddress(street: string | null, district: string | null, city: string | null) {
  const parts = [street, district, city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function getRecordAtPath(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as JsonRecord)[segment];
  }

  return current && typeof current === "object" && !Array.isArray(current) ? (current as JsonRecord) : null;
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

  return typeof node === "string" ? readNumberFromString(node) : null;
}

function readNumberFromString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\s+/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstValidIsoDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const date = new Date(value.trim());
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
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

  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function sanitizeMetaContent(value: string | null) {
  return value ? decodeHtml(value).trim() : null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeTitle(value: string) {
  return value.replace(/\s*-\s*OLX\.pl.*$/i, "").trim();
}

function normalizePolish(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeComparable(value: string) {
  return normalizePolish(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeComparableId(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function firstString(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function firstNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function isImageUrl(value: string) {
  return /^https?:\/\/.+(?:jpg|jpeg|png|webp|image)(?:[;?].*)?$/i.test(value);
}

function isListingPhotoUrl(value: string) {
  if (!isImageUrl(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    return hostname.includes("olxcdn.com") && pathname.includes("/files/") && pathname.includes("/image");
  } catch {
    return false;
  }
}

function extractExternalId(url: string) {
  const match = url.match(/-ID([a-zA-Z0-9]+)\.html/i) ?? url.match(/\/(\d+)(?:[/?#]|$)/);
  return match ? `olx-${match[1]}` : `olx-${toSlug(url)}`;
}

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
