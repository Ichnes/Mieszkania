import { extractOtodomExternalId } from "./otodom-url";
import { OtodomFetcher } from "./otodom-fetcher";
import type { SourceDiscovery, SourceListingReference } from "../types";
import type { SearchContract } from "@mieszkania/shared";

export class OtodomDiscovery implements SourceDiscovery {
  private readonly fetcher = new OtodomFetcher();

  async discoverListingUrls(input: {
    city: string;
    page?: number;
    pages?: number;
    startPage?: number;
    contract?: SearchContract;
  }): Promise<SourceListingReference[]> {
    const startPage = input.startPage ?? input.page ?? 1;
    const pages = Math.max(1, Math.min(50, input.pages ?? 1));
    const citySlug = input.city.toLowerCase().replace(/\s+/g, "-");
    const deduped = new Map<string, SourceListingReference>();
    const pageResults = await Promise.all(
      Array.from({ length: pages }, (_value, offset) => this.discoverSinglePage(citySlug, startPage + offset, input.contract))
    );

    for (const links of pageResults) {
      for (const link of links) {
        deduped.set(link.externalId, link);
      }
    }

    return Array.from(deduped.values());
  }

  async discoverSinglePage(citySlug: string, page: number, contract?: SearchContract): Promise<SourceListingReference[]> {
    const urls = buildSearchUrls(citySlug, page, contract);
    let lastError: unknown;

    for (const url of urls) {
      try {
        const document = await this.fetcher.fetchListing(url);
        const links = extractOfferLinks(document.html);

        if (links.length > 0) {
          return links;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }
    return [];
  }
}

function buildSearchUrls(citySlug: string, page: number, contract?: SearchContract) {
  const query = new URLSearchParams({
    page: String(page),
    limit: "36",
    ownerTypeSingleSelect: "ALL",
    by: "LATEST",
    direction: "DESC"
  });

  if (contract?.minArea) {
    query.set("areaMin", String(contract.minArea));
  }

  if (contract?.minPrice) {
    query.set("priceMin", String(contract.minPrice));
  }

  if (contract?.maxPrice) {
    query.set("priceMax", String(contract.maxPrice));
  }

  const roomOptions = toOtodomRooms(contract?.roomsMin);
  if (roomOptions.length > 0) {
    query.set("roomsNumber", JSON.stringify(roomOptions));
  }

  const queryString = query.toString();

  return [
    `https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie,rynek-wtorny/mazowieckie/${citySlug}/${citySlug}/${citySlug}?${queryString}`,
    `https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie,rynek-wtorny/mazowieckie/${citySlug}/${citySlug}?${queryString}`,
    `https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie,rynek-wtorny/${citySlug}?${queryString}`
  ];
}

function toOtodomRooms(roomsMin?: number) {
  if (!roomsMin || roomsMin <= 1) {
    return [];
  }

  if (roomsMin <= 2) {
    return ["TWO", "THREE", "FOUR", "FIVE", "SIX_OR_MORE"];
  }

  if (roomsMin === 3) {
    return ["THREE", "FOUR", "FIVE", "SIX_OR_MORE"];
  }

  if (roomsMin === 4) {
    return ["FOUR", "FIVE", "SIX_OR_MORE"];
  }

  if (roomsMin === 5) {
    return ["FIVE", "SIX_OR_MORE"];
  }

  return ["SIX_OR_MORE"];
}

export function extractOfferLinks(html: string): SourceListingReference[] {
  const candidates = new Set<string>();

  for (const match of html.matchAll(/https:\/\/www\.otodom\.pl\/pl\/oferta\/[^"' ]+ID[a-zA-Z0-9]+[^"' ]*/g)) {
    candidates.add(normalizeOfferUrl(match[0]));
  }

  for (const match of html.matchAll(/href=["'](\/pl\/oferta\/[^"' ]+ID[a-zA-Z0-9]+[^"' ]*)["']/g)) {
    candidates.add(normalizeOfferUrl(`https://www.otodom.pl${decodeHtml(match[1])}`));
  }

  for (const match of html.matchAll(/"url"\s*:\s*"(https:\\\/\\\/www\.otodom\.pl\\\/pl\\\/oferta\\\/[^"]+ID[a-zA-Z0-9]+[^"]*)"/g)) {
    candidates.add(normalizeOfferUrl(match[1].replaceAll("\\/", "/")));
  }

  for (const match of html.matchAll(/"(\/pl\/oferta\/[^"]+ID[a-zA-Z0-9]+[^"]*)"/g)) {
    candidates.add(normalizeOfferUrl(`https://www.otodom.pl${decodeHtml(match[1]).replaceAll("\\/", "/")}`));
  }

  const deduped = new Map<string, SourceListingReference>();
  for (const url of candidates) {
    const externalId = extractOtodomExternalId(url);
    if (!externalId) {
      continue;
    }
    deduped.set(externalId, { externalId, url });
  }

  return Array.from(deduped.values());
}

function normalizeOfferUrl(url: string) {
  return url
    .replace(/&amp;/gi, "&")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"");
}
