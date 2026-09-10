import assert from "node:assert/strict";
import test from "node:test";
import { isUnavailableListingDocument } from "./listing-archive";

test("active ad ignores archive translations in scripts, attributes and comments", () => {
  assert.equal(
    isUnavailableListingDocument({
      url: "https://www.olx.pl/d/oferta/test.html",
      statusCode: 200,
      html: '<h1>Mieszkanie Wilanów Zawady 85m</h1><script>window.state={"inactive":"To ogłoszenie nie jest już dostępne"}</script><!-- ogłoszenie archiwalne --><div data-label="oferta nie jest już dostępna">1 300 000 zł</div>',
    }),
    false,
  );
});
test("real archive text and HTTP gone responses remain unavailable", () => {
  for (const [statusCode, html] of [
    [200, "<h1>To ogłoszenie <span>nie jest już dostępne</span></h1>"],
    [404, ""],
    [410, ""],
  ] as const)
    assert.equal(
      isUnavailableListingDocument({
        url: "https://www.olx.pl/d/oferta/test.html",
        statusCode,
        html,
      }),
      true,
    );
});
