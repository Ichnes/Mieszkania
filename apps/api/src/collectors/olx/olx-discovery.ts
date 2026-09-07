import type { SourceListingReference } from "../types";
import { OlxFetcher } from "./olx-fetcher";

export class OlxDiscovery {
  constructor(private readonly fetcher = new OlxFetcher()) {}

  async discoverListingUrls(input: {
    city: string;
    page?: number;
    pages?: number;
    startPage?: number;
    contract?: {
      minPrice?: number;
      maxPrice?: number;
      minArea?: number;
      rooms?: number[];
    };
  }): Promise<SourceListingReference[]> {
    const startPage = Math.max(1, input.startPage ?? input.page ?? 1);
    const pages = Math.max(1, Math.min(50, input.pages ?? 1));
    const results: SourceListingReference[] = [];

    for (let offset = 0; offset < pages; offset += 1) {
      const page = startPage + offset;
      const url = buildSearchUrl(input.city, page, input.contract);
      const document = await this.fetcher.fetchListing(url);
      results.push(...extractListingReferences(document.html));
    }

    return dedupeReferences(results);
  }
}

function buildSearchUrl(city: string, page: number, contract?: { minPrice?: number; maxPrice?: number; minArea?: number; rooms?: number[] }) {
  const normalizedCity = normalizeCitySlug(city);
  const url = new URL(`https://www.olx.pl/nieruchomosci/mieszkania/sprzedaz/${normalizedCity}/`);

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  if (contract?.minPrice) {
    url.searchParams.set("search[filter_float_price:from]", String(contract.minPrice));
  }

  if (contract?.maxPrice) {
    url.searchParams.set("search[filter_float_price:to]", String(contract.maxPrice));
  }

  if (contract?.minArea) {
    url.searchParams.set("search[filter_float_m:from]", String(contract.minArea));
  }

  let roomIndex = 0;
  for (const rooms of contract?.rooms ?? []) {
    const value = rooms === 3 ? "three" : rooms === 4 ? "four" : null;
    if (value) {
      url.searchParams.set(`search[filter_enum_rooms][${roomIndex}]`, value);
      roomIndex += 1;
    }
  }

  url.searchParams.append("search[filter_enum_market][]", "secondary");
  return url.toString();
}

function extractListingReferences(html: string) {
  const refs: SourceListingReference[] = [];
  const matches = html.matchAll(/href=["']([^"']*\/d\/oferta\/[^"']+)["']/gi);

  for (const match of matches) {
    const rawUrl = decodeHtml(match[1] ?? "");
    const url = toAbsoluteUrl(rawUrl);

    if (!url || !isDirectOlxListingUrl(url)) {
      continue;
    }

    refs.push({
      externalId: extractExternalId(url),
      url
    });
  }

  return refs;
}

function isDirectOlxListingUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("olx.pl") && url.pathname.includes("/d/oferta/") && !value.includes("otodom");
  } catch {
    return false;
  }
}

function toAbsoluteUrl(value: string) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http")) {
    return value.split("#")[0];
  }

  if (value.startsWith("/")) {
    return `https://www.olx.pl${value}`.split("#")[0];
  }

  return null;
}

function dedupeReferences(values: SourceListingReference[]) {
  const seen = new Set<string>();
  const results: SourceListingReference[] = [];

  for (const value of values) {
    if (seen.has(value.externalId)) {
      continue;
    }

    seen.add(value.externalId);
    results.push(value);
  }

  return results;
}

function extractExternalId(url: string) {
  const match = url.match(/-ID([a-zA-Z0-9]+)\.html/i) ?? url.match(/\/(\d+)(?:[/?#]|$)/);
  return match ? `olx-${match[1]}` : `olx-${toSlug(url)}`;
}

function normalizeCitySlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "warszawa";
}

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/\\u002F/g, "/");
}
