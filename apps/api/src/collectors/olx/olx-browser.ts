import { chromium } from "playwright";
import type { FetchedListingDocument } from "../types";

// Queue workers share this limiter so fallback cannot launch many browsers at once.
let pending: Promise<unknown> = Promise.resolve();

export function fetchOlxBrowserDocument(url: string): Promise<FetchedListingDocument> {
  const result = pending.then(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ locale: "pl-PL", serviceWorkers: "block" });
      await page.route("**/*", (route) =>
        ["image", "media", "font"].includes(route.request().resourceType())
          ? route.abort()
          : route.continue(),
      );
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response) throw new Error("OLX browser navigation returned no response");
      if (response.ok()) {
        await page
          .locator('[data-testid="ad-inactive-msg"], h1')
          .first()
          .waitFor({ state: "visible", timeout: 3_000 })
          .catch(() => undefined);
      }
      return {
        url,
        finalUrl: page.url(),
        html: await page.content(),
        statusCode: response.status(),
      };
    } finally {
      await browser.close();
    }
  });
  pending = result.catch(() => undefined);
  return result;
}
