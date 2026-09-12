import type { SearchContract } from "@mieszkania/shared";
import type { SourceDiscovery, SourceListingReference } from "../types";
import { gratkaMorizonWarsawDistrictIds, splitLocationGroups } from "../location-groups";

type GratkaFetcher = {
  fetchListing(
    url: string,
    options?: { timeoutMs?: number },
  ): Promise<{ html: string; statusCode?: number }>;
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

    for (const districts of splitLocationGroups(input.contract?.districts)) {
      for (let offset = 0; offset < pages; offset += 1) {
        const url = buildSearchUrl(
          citySlug,
          startPage + offset,
          input.contract ? { ...input.contract, districts } : undefined,
        );
        const document = await this.fetcher.fetchListing(url, { timeoutMs: 15_000 });
        if (document.statusCode && document.statusCode >= 400) {
          throw new Error(`HTTP ${document.statusCode}: ${url}`);
        }

        for (const listing of extractOfferLinks(document.html)) {
          deduped.set(listing.externalId, listing);
        }
      }
    }

    return Array.from(deduped.values());
  }
}

export function buildSearchUrl(citySlug: string, page: number, contract?: SearchContract) {
  const query = new URLSearchParams({ sort: "newest" });
  // Gratka rejects the explicit first page with HTTP 404.
  if (page > 1) query.set("page", String(page));
  const districts = [...new Set(contract?.districts ?? [])];
  if (districts.length > 3) throw new Error("Gratka: maksymalnie 3 dzielnice w jednym zapytaniu.");
  if (districts.length && citySlug !== "warszawa")
    throw new Error("Filtr dzielnic Gratki jest obecnie dostępny dla Warszawy.");
  districts.forEach((district, index) => {
    const id = gratkaMorizonWarsawDistrictIds[district];
    if (!id) throw new Error(`Nieznana dzielnica Gratki: ${district}`);
    query.set(`location[identifiers][${index}][id]`, id);
    query.set(`location[identifiers][${index}][name]`, district);
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
