import assert from "node:assert/strict";
import test from "node:test";
import { getHeatingEvidence } from "./heating";

test("heating sources retain their description evidence", () => {
  assert.equal(getHeatingEvidence("Ogrzewanie: miejskie.").label, "Ogrzewanie miejskie");
  assert.equal(
    getHeatingEvidence("Własna kotłownia, piec gazowy.").label,
    "Kotłownia budynku / osiedla",
  );
  assert.equal(getHeatingEvidence("Ogrzewanie gazowe").label, "Ogrzewanie gazowe");
  assert.equal(getHeatingEvidence("Pompa ciepła").label, "Pompa ciepła");
  assert.deepEqual(getHeatingEvidence("Ogrzewanie elektryczne.").evidence, [
    "Ogrzewanie elektryczne",
  ]);
});
test("ambiguous, negative and proposed heating remains unknown", () => {
  for (const text of [
    undefined,
    "Centralne ogrzewanie",
    "Gaz w kuchni",
    "Brak ogrzewania miejskiego",
    "Nie ma pompy ciepła",
    "Planowane ogrzewanie miejskie",
    "Możliwość podłączenia do sieci ciepłowniczej",
  ]) {
    assert.equal(getHeatingEvidence(text).label, "Ogrzewanie nieustalone", text);
  }
  assert.equal(
    getHeatingEvidence("Ogrzewanie miejskie. Ogrzewanie elektryczne.").label,
    "Różne źródła ogrzewania w opisie",
  );
  assert.equal(getHeatingEvidence("Ogrzewanie miejskie").uncertain, true);
});
