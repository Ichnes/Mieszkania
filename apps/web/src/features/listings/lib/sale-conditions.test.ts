import assert from "node:assert/strict";
import test from "node:test";
import { saleConditions } from "./sale-conditions";
import { getDescriptionHighlightParts } from "./listing-language";

test("sale conditions preserve the words in the description and mark them red", () => {
  for (const [phrase, badge] of [
    ["Brak KW", "Brak KW"],
    ["brak księgi wieczystej", "Brak KW"],
    ["nie posiadam ksiegi wieczystej", "Brak KW"],
    ["bez założonej księgi wieczystej", "Brak KW"],
    ["zakup za gotowke", "Tylko gotówka"],
    ["zakup tylko za gotówkę", "Tylko gotówka"],
    ["tylko gotowka", "Tylko gotówka"],
    ["przyjmuje gotowke tylko", "Tylko gotówka"],
    ["akceptuję wyłącznie gotówkę", "Tylko gotówka"],
  ]) {
    assert.deepEqual(
      saleConditions(phrase).map((m) => m.badge),
      [badge],
    );
    assert.deepEqual(getDescriptionHighlightParts(phrase), [{ text: phrase, tone: "negative" }]);
  }
  assert.deepEqual(
    saleConditions("Brak KW – zakup za gotówkę!").map((m) => m.badge),
    ["Brak KW", "Tylko gotówka"],
  );
  for (const text of [
    "Posiada KW",
    "Brak kwoty",
    "Zakup za gotówkę lub na kredyt",
    "Nie tylko gotówka",
    "Preferowany zakup za gotówkę",
    "Przyjmuję gotówkę i przelewy",
  ])
    assert.equal(saleConditions(text).length, 0, text);
});
