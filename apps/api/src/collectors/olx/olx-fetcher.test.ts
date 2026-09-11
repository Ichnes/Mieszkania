import assert from "node:assert/strict";
import test from "node:test";
import { OlxFetcher } from "./olx-fetcher";
import { OlxDiscovery } from "./olx-discovery";
import { normalizeOlxListingUrl } from "./olx-url";

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
  assert.equal((await new OlxFetcher().fetchListing(offer)).statusCode, 403);
  assert.equal(mocked.mock.callCount(), 2);
});

test("temporary 403 is retried once, removed offers are not retried", async (t) => {
  let statuses = [403, 200];
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("body", { status: statuses.shift()! }),
  );
  assert.equal((await new OlxFetcher().fetchListing(offer)).statusCode, 200);
  assert.equal(mocked.mock.callCount(), 2);
  statuses = [410];
  assert.equal((await new OlxFetcher().fetchListing(offer)).statusCode, 410);
  assert.equal(mocked.mock.callCount(), 3);
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
