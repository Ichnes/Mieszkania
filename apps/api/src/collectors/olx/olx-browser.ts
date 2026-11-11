import { chromium } from "playwright";
import type { FetchedListingDocument } from "../types";

// Queue workers share this limiter so fallback cannot launch many browsers at once.
let pending: Promise<unknown> = Promise.resolve();

export function fetchOlxBrowserDocument(url: string): Promise<FetchedListingDocument> {
  const result = pending.then(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      // OLX's CDN rejects the HeadlessChrome product token before serving HTML.
      // Use the installed Chromium version, not a stale hard-coded browser UA.
      const platform =
        process.platform === "win32"
          ? "Windows NT 10.0; Win64; x64"
          : process.platform === "darwin"
            ? "Macintosh; Intel Mac OS X 10_15_7"
            : "X11; Linux x86_64";
      const page = await browser.newPage({
        locale: "pl-PL",
        serviceWorkers: "block",
        userAgent: `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`,
      });
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
