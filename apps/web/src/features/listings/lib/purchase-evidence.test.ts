import assert from "node:assert/strict";
import test from "node:test";
import { cashPurchaseEvidence, mandatoryAddons } from "./purchase-evidence";

test("cash purchase requires an affirmative seller statement", () => {
  assert.equal(cashPurchaseEvidence("Brak KW – zakup za gotówkę!"), "zakup za gotówkę");
  for (const text of ["Brak KW", "Zakup za gotówkę lub na kredyt", "Nie tylko gotówka"])
    assert.equal(cashPurchaseEvidence(text), undefined);
});

test("an obligatory addition must cover the priced items", () => {
  assert.equal(mandatoryAddons("Zakup miejsca obowiązkowy.", { garage: 39000 }), true);
  assert.equal(
    mandatoryAddons("Zakup miejsca obowiązkowy.", { garage: 39000, storage: 5000 }),
    false,
  );
  assert.equal(mandatoryAddons("Miejsce naziemne płatne dodatkowo.", { garage: 39000 }), false);
});
