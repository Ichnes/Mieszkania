import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { fetchOlxBrowserDocument } from "./olx-browser";

test("OLX browser uses its installed Chrome version, preserves HTTP status and serializes requests", async (t) => {
  let active = 0;
  let maximumActive = 0;
  let closed = 0;
  const seenUserAgents: string[] = [];
  t.mock.method(chromium, "launch", async () => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    return {
      version: () => "146.0.7610.2",
      newPage: async (options: { userAgent: string }) => {
        seenUserAgents.push(options.userAgent);
        let url = "";
        return {
          route: async () => undefined,
          goto: async (value: string) => {
            url = value;
            await new Promise((resolve) => setTimeout(resolve, 5));
            if (url.endsWith("/timeout")) throw new Error("navigation timeout");
            return { ok: () => false, status: () => 403 };
          },
          url: () => url,
          content: async () => "Access denied",
        };
      },
      close: async () => {
        active--;
        closed++;
      },
    };
  });
  const responses = await Promise.all([
    fetchOlxBrowserDocument("https://www.olx.pl/d/oferta/first"),
    fetchOlxBrowserDocument("https://www.olx.pl/d/oferta/second"),
  ]);
  assert.equal(maximumActive, 1);
  assert.equal(closed, 2);
  for (const response of responses) {
    assert.equal(response.statusCode, 403, "a real denial must never become a successful response");
    assert.equal(response.html, "Access denied");
    assert.equal(response.finalUrl, response.url);
  }
  assert.ok(
    seenUserAgents.every(
      (ua) => ua.includes("Chrome/146.0.7610.2") && !ua.includes("HeadlessChrome"),
    ),
  );
  await assert.rejects(fetchOlxBrowserDocument("https://www.olx.pl/timeout"), /navigation timeout/);
  assert.equal(closed, 3);
  assert.equal(active, 0);
  assert.equal(
    (await fetchOlxBrowserDocument("https://www.olx.pl/d/oferta/after-timeout")).statusCode,
    403,
  );
});
