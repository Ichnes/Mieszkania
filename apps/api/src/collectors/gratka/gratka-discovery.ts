import type { SearchContract } from "@mieszkania/shared";
import type { SourceDiscovery, SourceListingReference } from "../types";

type GratkaFetcher = {
  fetchListing(url: string): Promise<{ html: string }>;
};

export class GratkaDiscovery implements SourceDiscovery {
  constructor(private readonly fetcher: GratkaFetcher) {}

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

    for (let offset = 0; offset < pages; offset += 1) {
      const url = buildSearchUrl(citySlug, startPage + offset, input.contract);
      const document = await this.fetcher.fetchListing(url);

      for (const listing of extractOfferLinks(document.html)) {
        deduped.set(listing.externalId, listing);
      }
    }

    return Array.from(deduped.values());
  }
}

function buildSearchUrl(citySlug: string, page: number, contract?: SearchContract) {
  const query = new URLSearchParams({
    page: String(page),
  });

  if (contract?.minPrice) {
    query.set("cena-calkowita:min", String(contract.minPrice));
  }

  if (contract?.maxPrice) {
    query.set("cena-calkowita:max", String(contract.maxPrice));
  }

  if (contract?.minArea) {
    query.set("powierzchnia-w-m2:min", String(contract.minArea));
  }

  if (contract?.roomsMin) {
    query.set("liczba-pokoi:min", String(contract.roomsMin));
    query.set("liczba-pokoi:max", "6");
  }

  return `https://gratka.pl/nieruchomosci/mieszkania/${citySlug}/wtorny?${query.toString()}`;
}

function extractOfferLinks(html: string): SourceListingReference[] {
  const candidates = new Set<string>();

  for (const match of html.matchAll(/https:\/\/gratka\.pl\/nieruchomosci\/[^"' ]+\/ob\/\d+/g)) {
    candidates.add(normalizeOfferUrl(match[0]));
  }

  for (const match of html.matchAll(/href=["'](\/nieruchomosci\/[^"' ]+\/ob\/\d+)["']/g)) {
    candidates.add(normalizeOfferUrl(`https://gratka.pl${decodeHtml(match[1])}`));
  }

  const deduped = new Map<string, SourceListingReference>();
  for (const url of candidates) {
    const externalId = extractExternalId(url);
    if (!externalId) {
      continue;
    }

    deduped.set(externalId, {
      externalId,
      url,
    });
  }

  return Array.from(deduped.values());
}

function normalizeOfferUrl(url: string) {
  return url
    .replace(/&amp;/gi, "&")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function extractExternalId(url: string) {
  const match = url.match(/\/ob\/(\d+)/i);
  return match ? `gratka-${match[1]}` : null;
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"');
}
