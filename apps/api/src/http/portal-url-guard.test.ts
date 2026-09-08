import test from "node:test";
import assert from "node:assert/strict";
import { isPortalUrl } from "./portal-url-guard";
test("manual portal imports reject local URLs, userinfo and lookalike domains", () => {
  for (const url of [
    "http://localhost:5432",
    "https://127.0.0.1",
    "file:///etc/passwd",
    "https://otodom.pl.evil.test/x",
    "https://user@otodom.pl/x",
    "https://otodom.pl:1234/x",
  ])
    assert.equal(isPortalUrl("otodom", url), false, url);
  assert.equal(isPortalUrl("otodom", "https://www.otodom.pl/pl/oferta/test"), true);
  assert.equal(
    isPortalUrl("nieruchomosci-online", "https://warszawa.nieruchomosci-online.pl/mieszkanie/test"),
    true,
  );
});
