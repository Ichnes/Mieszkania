import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingDescription } from "./ListingDescription";

test("sentences and street abbreviations stay together while source paragraphs remain", () => {
  const html = renderToStaticMarkup(
    <ListingDescription
      value={"Mieszkanie przy ul.\n\nIgańskiej. Drugie zdanie.\n\nOsobny akapit."}
    />,
  );
  assert.equal((html.match(/<p\b/g) ?? []).length, 2);
  assert.ok(html.includes("ul. Igańskiej. Drugie zdanie."));
});
