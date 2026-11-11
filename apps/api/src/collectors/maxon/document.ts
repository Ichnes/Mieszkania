import { publicFetch } from "../../services/http/public-fetch";

type RecordValue = Record<string, any>;

export function maxonStructuredListing(html: string): RecordValue | undefined {
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld(?:\+|&#x2b;|&#43;)json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(match[1]);
      const nodes = Array.isArray(data) ? data : [data, ...(data["@graph"] ?? [])];
      const listing = nodes.find((node: RecordValue) => node?.["@type"] === "RealEstateListing");
      if (listing) return listing;
    } catch {
      /* Ignore unrelated malformed metadata. */
    }
  }
}

export function maxonCurrentReferences(html: string) {
  const references = new Map<string, { externalId: string; url: string }>();
  for (const match of html.matchAll(
    /(?:href=["']|"url"\s*:\s*"|<loc>)([^"'<>\s]*\/oferta\/[^"'<>\s]+-([0-9]+))(?=["'<])/gi,
  )) {
    const url = new URL(match[1], "https://www.maxon.pl");
    if (url.hostname !== "www.maxon.pl" || !url.pathname.startsWith("/oferta/")) continue;
    const externalId = `maxon-${match[2]}`;
    references.set(externalId, { externalId, url: url.toString() });
  }
  return [...references.values()];
}

let sitemap: { expires: number; urls: Map<string, string> } | undefined;
let loading: Promise<Map<string, string>> | undefined;
export async function resolveMaxonLegacyUrl(url: string, externalId: string) {
  if (!new URL(url).pathname.startsWith("/mieszkania/oferta/")) return url;
  if (!sitemap || sitemap.expires < Date.now()) {
    loading ??= (async () => {
      const response = await publicFetch("https://www.maxon.pl/sitemap-offers.xml", {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`MAXON_SITEMAP_HTTP_${response.status}`);
      const references = maxonCurrentReferences(await response.text());
      if (!references.length) throw new Error("MAXON_SITEMAP_EMPTY: brak aktualnych adresów ofert");
      const urls = new Map(references.map((reference) => [reference.externalId, reference.url]));
      sitemap = { expires: Date.now() + 60 * 60_000, urls };
      return urls;
    })().finally(() => {
      loading = undefined;
    });
    await loading;
  }
  const current = sitemap!.urls.get(externalId);
  if (!current)
    throw new Error(
      `MAXON_LEGACY_URL: stary adres oferty ${externalId}; brak potwierdzonego odpowiednika w aktualnej mapie Maxona. ${url}`,
    );
  return current;
}

export function assertMaxonDetailPage(html: string) {
  if (/data-gtm-page=["']listing["']/i.test(html))
    throw new Error(
      "MAXON_LISTING_REDIRECT: portal zwrócił listę ofert zamiast szczegółów mieszkania; ceny nie zostały zapisane.",
    );
}
