import assert from "node:assert/strict";
import test from "node:test";
import { OlxFetcher } from "./olx-fetcher";
import { OlxDiscovery } from "./olx-discovery";
import { normalizeOlxListingUrl } from "./olx-url";
import { isUnavailableListingDocument } from "../../services/listings/listing-archive";

const offer = "https://www.olx.pl/d/oferta/mieszkanie-CID3-ID18LG4K.html";

test("old queued and manual OLX URLs are fetched without search attribution", async (t) => {
  const requested: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    requested.push(url);
    assert.ok(options.signal);
    return new Response("offer", { status: url.includes("search_reason") ? 403 : 200 });
  });
  for (const reason of ["organic", "promoted"]) {
    const document = await new OlxFetcher().fetchListing(
      `${offer}?search_reason=search%7C${reason}#photos`,
    );
    assert.equal(document.statusCode, 200);
    assert.equal(document.url, offer);
    assert.equal(document.html, "offer");
  }
  assert.deepEqual(requested, [offer, offer]);
});

test("OLX normalization preserves search filters and other query parameters", () => {
  const search =
    "https://www.olx.pl/nieruchomosci/mieszkania/sprzedaz/warszawa/?page=2&search%5Bdistrict_id%5D=1";
  assert.equal(normalizeOlxListingUrl(search), search);
  assert.equal(
    normalizeOlxListingUrl(`${offer}?foo=bar&search_reason=search%7Corganic`),
    `${offer}?foo=bar`,
  );
  const other = "https://notolx.pl/d/oferta/test?search_reason=keep#photo";
  assert.equal(normalizeOlxListingUrl(other), other);
  assert.equal(normalizeOlxListingUrl(offer), offer);
});

test("actual access denial remains an HTTP error response", async (t) => {
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("blocked", { status: 403 }),
  );
  const fetcher = new OlxFetcher(async (url) => ({ url, html: "blocked", statusCode: 403 }));
  const document = await fetcher.fetchListing(offer);
  assert.equal(document.statusCode, 403);
  assert.equal(isUnavailableListingDocument(document), false);
  assert.equal(mocked.mock.callCount(), 1);
});

test("403 uses browser; successful and gone HTTP responses do not launch it", async (t) => {
  const statuses = [403, 200, 410];
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("body", { status: statuses.shift()! }),
  );
  let browserCalls = 0;
  const fetcher = new OlxFetcher(async (url) => {
    browserCalls++;
    assert.equal(url, offer);
    return { url, finalUrl: url, html: "rendered offer", statusCode: 200 };
  });
  assert.equal(
    (await fetcher.fetchListing(`${offer}?search_reason=search%7Cpromoted`)).html,
    "rendered offer",
  );
  assert.equal((await fetcher.fetchListing(offer)).statusCode, 200);
  assert.equal((await fetcher.fetchListing(offer)).statusCode, 410);
  assert.equal(browserCalls, 1);
  assert.equal(mocked.mock.callCount(), 3);
});

test("browser inactive OLX message is unavailable even with HTTP 200", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("blocked", { status: 403 }));
  const fetcher = new OlxFetcher(async (url) => ({
    url,
    statusCode: 200,
    html: '<div data-testid="ad-inactive-msg" class="css-ljpkfr"><img src="/app/static/media/illustration-error-time-out.d0f5c4edc.svg" alt=""><h4 data-nx-name="H4" data-nx-legacy="true" class="css-1g1ktcr">To ogłoszenie nie jest już dostępne</h4><a href="/" data-nx-name="Button"><span>Przejdź na stronę główną</span></a></div>',
  }));
  assert.equal(isUnavailableListingDocument(await fetcher.fetchListing(offer)), true);
});

test("browser failure preserves the original denial", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("blocked", { status: 403 }));
  t.mock.method(console, "warn", () => undefined);
  const fetcher = new OlxFetcher(async () => {
    throw new Error("browser unavailable");
  });
  const document = await fetcher.fetchListing(offer);
  assert.equal(document.statusCode, 403);
  assert.equal(document.html, "blocked");
});

test("discovery queues one clean URL for organic and promoted copies", async () => {
  const discovery = new OlxDiscovery({
    fetchListing: async (url) => ({
      url,
      statusCode: 200,
      html: `<a href="${offer}?search_reason=search%7Corganic">Offer</a><a href="${offer}?search_reason=search%7Cpromoted">Offer</a>`,
    }),
  });
  assert.deepEqual(await discovery.discoverListingUrls({ city: "warszawa" }), [
    { externalId: "olx-18LG4K", url: offer },
  ]);
});
