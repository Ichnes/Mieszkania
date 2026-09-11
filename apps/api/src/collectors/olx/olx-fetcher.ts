import type { FetchedListingDocument, ListingFetcher } from "../types";
import { normalizeOlxListingUrl } from "./olx-url";

export class OlxFetcher implements ListingFetcher {
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

    let response = await request();
    // OLX can intermittently reject an identical request. Retry only once;
    // persistent denial must still reach the queue as an error.
    if (response.status === 403) {
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      response = await request();
    }
    const html = await response.text();
    return {
      url,
      finalUrl: response.url,
      html,
      statusCode: response.status,
    };
  }
}
