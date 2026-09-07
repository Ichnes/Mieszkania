import type { FetchedListingDocument, ListingFetcher } from "../types";

export class OlxFetcher implements ListingFetcher {
  async fetchListing(url: string): Promise<FetchedListingDocument> {
    const response = await fetch(url, {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pl-PL,pl;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      }
    });

    const html = await response.text();
    return {
      url,
      finalUrl: response.url,
      html,
      statusCode: response.status
    };
  }
}
