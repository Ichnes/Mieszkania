import { request as httpsRequest } from "node:https";
import type { Browser, BrowserContext, Page } from "playwright";
import { OtodomFetcher } from "../otodom/otodom-fetcher";
import type { FetchedListingDocument, ListingFetcher } from "../types";

type PlaywrightModule = typeof import("playwright");
let sharedBrowserPromise: Promise<Browser> | null = null;

export class GratkaFetcher implements ListingFetcher {
  private readonly fallbackFetcher = new OtodomFetcher();

  async fetchListing(
    url: string,
    options?: { includeGallery?: boolean; preferStaticHtml?: boolean },
  ): Promise<FetchedListingDocument> {
    if (options?.preferStaticHtml) {
      return this.fetchStaticListing(url);
    }

    const playwright = await loadPlaywright();
    if (!playwright) {
      console.warn(`[gratka] Playwright is unavailable for ${url}; falling back to static HTML.`);
      return this.fetchStaticListing(url);
    }

    let context: BrowserContext | null = null;
    try {
      const browser = await getSharedBrowser(playwright);
      context = await browser.newContext({ serviceWorkers: "block" });
      const page = await context.newPage();
      await blockHeavyBrowserResources(page);
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page
        .locator(".gallery-more__button, img[data-cy='thumbnail'], [data-cy='phoneContactButton']")
        .first()
        .waitFor({ state: "attached", timeout: 2_500 })
        .catch(() => page.waitForTimeout(450));
      await dismissBlockingOverlays(page);
      const primaryHtml = await page.content();

      if (options?.includeGallery === false) {
        return {
          url,
          html: primaryHtml,
          statusCode: response?.status() ?? 200,
          finalUrl: response?.url() ?? url,
        };
      }

      const galleryState = await openFullGallery(page);
      const galleryHtml = await page.content();
      const renderedImageUrls = await collectRenderedGalleryImageUrls(page);
      let contactHtml = primaryHtml;

      // Phone is best effort. Reusing the current page avoids a second full
      // Gratka navigation, which used to add up to 30 seconds per offer.
      try {
        await page.keyboard.press("Escape").catch(() => undefined);
        await clickFirstMatchingElement(
          page,
          "button[aria-label*='Zamknij'], .gallery__close",
          1_000,
        );
        await dismissBlockingOverlays(page);
        await clickFirstMatchingElement(
          page,
          "[data-cy='phoneContactButton'], .phone-contact__button",
          2_500,
        );
        await page
          .waitForFunction(
            () =>
              Array.from(document.querySelectorAll(".phone-contact__number")).some(
                (node) =>
                  node.textContent &&
                  /\d/.test(node.textContent) &&
                  !node.textContent.includes("..."),
              ),
            undefined,
            { timeout: 2_500 },
          )
          .catch(() => undefined);
        contactHtml = await page.content();
      } catch (cause) {
        console.warn(
          `[gratka] Contact rendering failed for ${url}; keeping the captured gallery.`,
          cause,
        );
      }

      return {
        url,
        html: `${contactHtml}\n${galleryHtml}\n<script type="application/json" data-gratka-gallery-state>${JSON.stringify(galleryState)}</script>\n<script type="application/json" data-gratka-rendered-images>${JSON.stringify(renderedImageUrls)}</script>`,
        statusCode: response?.status() ?? 200,
        finalUrl: response?.url() ?? url,
      };
    } catch (cause) {
      console.warn(
        `[gratka] Browser rendering failed for ${url}; falling back to static HTML.`,
        cause,
      );
      return this.fetchStaticListing(url);
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  private async fetchStaticListing(url: string) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const document = await this.fallbackFetcher.fetchListing(url, { timeoutMs: 15_000 });
        if (document.statusCode === 429 || document.statusCode >= 500) {
          throw new Error(`Gratka returned transient HTTP ${document.statusCode} for ${url}`);
        }
        return document;
      } catch (cause) {
        lastError = cause;
        if (attempt < 3) {
          await wait(attempt * 350);
        }
      }
    }

    if (isCertificateError(lastError) || isGratkaFallbackHandoffError(lastError)) {
      return fetchTrustedGratkaPage(url);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Gratka static fetch failed for ${url}`);
  }
}

async function getSharedBrowser(playwright: PlaywrightModule) {
  if (!sharedBrowserPromise) {
    const browserPromise = playwright.chromium.launch({ headless: true });
    sharedBrowserPromise = browserPromise;
    browserPromise
      .then((browser) =>
        browser.once("disconnected", () => {
          if (sharedBrowserPromise === browserPromise) {
            sharedBrowserPromise = null;
          }
        }),
      )
      .catch(() => {
        if (sharedBrowserPromise === browserPromise) {
          sharedBrowserPromise = null;
        }
      });
  }

  return sharedBrowserPromise;
}

async function blockHeavyBrowserResources(page: Page) {
  await page.route("**/*", async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === "media" || resourceType === "font") {
      await route.abort().catch(() => undefined);
      return;
    }
    await route.continue().catch(() => undefined);
  });
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function loadPlaywright() {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<PlaywrightModule>;
    return await dynamicImport("playwright");
  } catch {
    return null;
  }
}

async function clickFirstMatchingElement(page: Page, selector: string, timeout: number) {
  const locator = page.locator(selector).first();
  if ((await locator.count().catch(() => 0)) === 0) {
    return false;
  }
  const clickedByLocator = await locator
    .click({ timeout })
    .then(() => true)
    .catch(() => false);

  if (clickedByLocator) {
    return true;
  }

  const forceClickedByLocator = await locator
    .click({ timeout: Math.min(timeout, 2_000), force: true })
    .then(() => true)
    .catch(() => false);

  if (forceClickedByLocator) {
    return true;
  }

  return page
    .evaluate((targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.click();
      return true;
    }, selector)
    .catch(() => false);
}

function fetchTrustedGratkaPage(url: string, redirectsLeft = 4): Promise<FetchedListingDocument> {
  const target = new URL(url);
  if (!isGratkaPageHost(target.hostname)) {
    return Promise.reject(new Error(`Refusing TLS fallback for untrusted host ${target.hostname}`));
  }

  return new Promise((resolveResponse, rejectResponse) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        rejectUnauthorized: false,
        timeout: 15_000,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 500;
        const location = response.headers.location;
        if (location && statusCode >= 300 && statusCode < 400 && redirectsLeft > 0) {
          response.resume();
          const redirectedUrl = new URL(location, url);
          if (!isGratkaPageHost(redirectedUrl.hostname)) {
            rejectResponse(
              new Error(`Refusing untrusted Gratka redirect to ${redirectedUrl.hostname}`),
            );
            return;
          }
          void fetchTrustedGratkaPage(redirectedUrl.toString(), redirectsLeft - 1).then(
            resolveResponse,
            rejectResponse,
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
        response.on("end", () =>
          resolveResponse({
            url,
            html: Buffer.concat(chunks).toString("utf8"),
            statusCode,
            finalUrl: url,
          }),
        );
      },
    );
    request.on("timeout", () => request.destroy(new Error(`Gratka request timed out for ${url}`)));
    request.on("error", rejectResponse);
    request.end();
  });
}

function isGratkaPageHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "gratka.pl" || normalized.endsWith(".gratka.pl");
}

function isGratkaFallbackHandoffError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "fetch failed" ||
    /Refusing TLS fallback for untrusted host (?:www\.)?gratka\.pl/i.test(error.message)
  );
}

function isCertificateError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  return /certificate|cert_|unable to verify/i.test(
    `${error.message} ${cause instanceof Error ? `${cause.message} ${(cause as NodeJS.ErrnoException).code ?? ""}` : ""}`,
  );
}

async function dismissBlockingOverlays(page: Page) {
  const consentButton = page
    .locator(".cmp-intro_acceptAll, button[aria-label='Przejdź do serwisu']")
    .first();
  if (await consentButton.count().catch(() => 0)) {
    await consentButton.click({ timeout: 4_000, force: true }).catch(() => undefined);
    await page
      .locator(".cmp-popup_popup")
      .waitFor({ state: "hidden", timeout: 4_000 })
      .catch(() => undefined);
  }

  // Remove only orphaned blocking layers. Removing `.cmp-app_gdpr` itself is
  // unsafe because Gratka mounts the consent component around live page state.
  await page
    .evaluate(() => {
      document
        .querySelectorAll(".cmp-popup_overlay, .cmp-popup_popup")
        .forEach((node) => node.remove());
    })
    .catch(() => undefined);
}

async function openFullGallery(page: Page) {
  await page
    .locator(".gallery-more__button, button.gallery-more__button")
    .first()
    .waitFor({ state: "attached", timeout: 3_500 })
    .catch(() => undefined);
  const clickedMore = await clickFirstMatchingElement(
    page,
    ".gallery-more__button, button.gallery-more__button",
    8_000,
  );

  if (clickedMore) {
    await page.waitForTimeout(600);
  }
  // Gratka can mount the consent layer again when the expanded gallery is
  // created, so clear it once more before clicking the first photo.
  await dismissBlockingOverlays(page);

  // Current Gratka uses a two-step flow. "Zobacz N zdjęć" first reveals the
  // gallery and clicking photo no. 1 then creates the full swiper containing
  // slides with aria-label="1 / N", "2 / N", etc.
  const clickedFirstPhoto =
    (await clickFirstMatchingElement(
      page,
      "button.gallery__photos-item:visible, button[aria-label='Zdjęcie nr 1']:visible, button[aria-label='Zdjecie nr 1']:visible",
      5_000,
    )) ||
    (await clickFirstMatchingElement(
      page,
      ".gallery__photos-item img[data-cy='thumbnail']:visible, [data-cy='detailsGalleryItemPhoto']:visible, img[data-cy='thumbnail']:visible",
      5_000,
    ));

  await page
    .waitForFunction(
      () => {
        const slides = document.querySelectorAll("swiper-slide[aria-label*=' / ']");
        const expandedPhotos = document.querySelectorAll(
          "button.gallery__photos-item img[data-cy='thumbnail']",
        );
        return slides.length > 3 || expandedPhotos.length > 3;
      },
      undefined,
      { timeout: 6_000 },
    )
    .catch(() => page.waitForTimeout(650));

  const slideCount = await page
    .locator("swiper-slide[aria-label*=' / ']")
    .count()
    .catch(() => 0);
  const photoCount = await page
    .locator("button.gallery__photos-item img[data-cy='thumbnail']")
    .count()
    .catch(() => 0);
  return { clickedMore, clickedFirstPhoto, slideCount, photoCount };
}

async function collectRenderedGalleryImageUrls(page: Page) {
  return page
    .evaluate(() => {
      const galleryImages = Array.from(
        document.querySelectorAll<HTMLImageElement>(
          "swiper-slide[aria-label*=' / '] img, button.gallery__photos-item img[data-cy='thumbnail']",
        ),
      );
      const images =
        galleryImages.length > 3
          ? galleryImages
          : Array.from(
              document.querySelectorAll<HTMLImageElement>("img[data-cy='thumbnail'], img"),
            );

      return images
        .flatMap((node) => [
          node.currentSrc,
          node.src,
          node.getAttribute("data-src"),
          node.getAttribute("srcset"),
          node.getAttribute("data-srcset"),
        ])
        .filter((value): value is string => Boolean(value && /cdngr|morizon/i.test(value)));
    })
    .catch(() => [] as string[]);
}
