import assert from "node:assert/strict";
import test from "node:test";
import { extractAdresowoConstructionYear } from "./index";

test("reads the construction year from the current Adresowo summary", () => {
  const html = `<span class="block text-sm text-neutral-500 lg:text-neutral-600">z windą, rok budowy&nbsp;2006</span>`;
  assert.equal(extractAdresowoConstructionYear(html), 2006);
});

test("reads the construction year from visible text without a colon", () => {
  assert.equal(extractAdresowoConstructionYear("", "z windą, rok budowy 2006"), 2006);
});

test("does not confuse an arbitrary four-digit number with the construction year", () => {
  assert.equal(extractAdresowoConstructionYear("<p>Telefon 2018</p>"), undefined);
});
