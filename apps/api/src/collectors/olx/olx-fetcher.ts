import type { FetchedListingDocument, ListingFetcher } from "../types";
import { normalizeOlxListingUrl } from "./olx-url";
import { fetchOlxBrowserDocument } from "./olx-browser";

export class OlxFetcher implements ListingFetcher {
  constructor(private readonly browserFetch = fetchOlxBrowserDocument) {}

  async fetchListing(url: string): Promise<FetchedListingDocument> {
    url = normalizeOlxListingUrl(url);
    const request = () =>
      fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "pl-PL,pl;q=0.9,en;q=0.8",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        },
      });

    const response = await request();
    const html = await response.text();
    // OLX can also return transient server/gateway errors to the HTTP client.
    // One browser attempt is shared by discovery, queued and manual imports.
    if (response.status === 403 || response.status >= 500) {
      try {
        return await this.browserFetch(url);
      } catch (error) {
        console.warn(`[olx] Browser fallback failed; retaining HTTP ${response.status}.`, error);
      }
    }
    return {
      url,
      finalUrl: response.url,
      html,
      statusCode: response.status,
    };
  }
}
