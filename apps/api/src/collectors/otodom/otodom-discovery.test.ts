import assert from "node:assert/strict";
import test from "node:test";
import { OtodomDiscovery, buildSearchUrls } from "./otodom-discovery";
import { createDefaultSearchContract } from "@mieszkania/shared";
import type { logOtodomSearchFailure } from "./otodom-diagnostics";

for (const statusCode of [405, 202]) {
  test(`CAPTCHA with HTTP ${statusCode} is logged and stops without trying another URL`, async () => {
    const records: Parameters<typeof logOtodomSearchFailure>[0][] = [];
    let calls = 0;
    const discovery = new OtodomDiscovery(
      {
        fetchListing: async (url) => {
          calls++;
          return {
            url,
            html: "captcha-body",
            statusCode,
            responseHeaders: { "x-amzn-waf-action": "captcha" },
          };
        },
      },
      async (record) => {
        records.push(record);
      },
    );
    await assert.rejects(
      discovery.discoverListingUrls({ city: "warszawa", startPage: 53 }),
      /Strona 53: Otodom wymaga CAPTCHA/,
    );
    assert.equal(calls, 1);
    assert.equal(records.length, 1);
    assert.equal(records[0].document?.html, "captcha-body");
    assert.equal(records[0].document?.statusCode, statusCode);
    assert.equal(records[0].page, 53);
  });
}

test("discovery captures failed bodies, exact page and run context, and preserves the first error", async () => {
  const records: Parameters<typeof logOtodomSearchFailure>[0][] = [];
  let calls = 0;
  const discovery = new OtodomDiscovery(
    {
      fetchListing: async (url) => ({
        url,
        html: `response-${++calls}`,
        statusCode: calls === 1 ? 405 : 404,
      }),
    },
    async (record) => {
      records.push(record);
    },
  );
  await assert.rejects(
    discovery.discoverListingUrls({
      city: "warszawa",
      startPage: 137,
      pages: 1,
      context: { maxPages: 600, runId: "test" },
    }),
    /strona 137, HTTP 405/,
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].document?.html, "response-1");
  assert.equal(records[0].page, 137);
  assert.equal(records[0].context?.maxPages, 600);
  assert.equal(new URL(records[0].url).searchParams.get("page"), "137");
});

test("Warsaw without districts matches the whole-city reference URL", () => {
  const reference = new URL(
    "https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie,rynek-wtorny/mazowieckie/warszawa/warszawa/warszawa?limit=36&ownerTypeSingleSelect=ALL&priceMin=895000&priceMax=2000000&areaMin=53&roomsNumber=%5BTHREE%2CFOUR%2CFIVE%2CSIX_OR_MORE%5D&by=LATEST&direction=DESC",
  );
  for (const districts of [[], undefined]) {
    const contract = {
      ...createDefaultSearchContract(),
      minPrice: 895000,
      maxPrice: 2000000,
      minArea: 53,
      roomsMin: 3,
      districts,
    };
    const urls = buildSearchUrls("warszawa", 1, contract);
    assert.equal(urls.length, 1);
    const actual = new URL(urls[0]);
    assert.equal(actual.origin + actual.pathname, reference.origin + reference.pathname);
    assert.deepEqual(
      Object.fromEntries(actual.searchParams),
      Object.fromEntries(reference.searchParams),
    );
    const next = new URL(buildSearchUrls("warszawa", 2, contract)[0]);
    assert.equal(next.searchParams.get("page"), "2");
    next.searchParams.delete("page");
    assert.equal(next.href, actual.href);
  }
});

test("an empty Warsaw page does not switch to a shorter location path", async () => {
  const urls: string[] = [];
  const discovery = new OtodomDiscovery({
    fetchListing: async (url) => {
      urls.push(url);
      return { url, html: "no offers", statusCode: 200 };
    },
  });
  assert.deepEqual(await discovery.discoverListingUrls({ city: "Warszawa" }), []);
  assert.equal(urls.length, 1);
  assert.equal(
    new URL(urls[0]).pathname,
    "/pl/wyniki/sprzedaz/mieszkanie,rynek-wtorny/mazowieckie/warszawa/warszawa/warszawa",
  );
});
