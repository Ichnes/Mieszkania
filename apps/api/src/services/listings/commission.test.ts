import test from "node:test";
import assert from "node:assert/strict";
import { inferCommercialInfo } from "./listing-repository";

test("owner statement BRAK PROWIZJI wins over the mere occurrence of prowizji", () => {
  const badges = inferCommercialInfo("BEZPOŚREDNIO OD WŁAŚCICIELI – BRAK PROWIZJI").badges;
  assert.ok(badges.includes("Bez prowizji"));
  assert.ok(badges.includes("Oferta bezpośrednia"));
  assert.ok(!badges.includes("Z prowizją"));
});
test("commission synonyms, explicit fees and negations stay distinct", () => {
  for (const text of [
    "Brak prowizji",
    "0 % prowizji",
    "Prowizja: 0%",
    "Zerowa prowizja",
    "Kupujący nie ponosi kosztów prowizji",
    "Nie pobieramy prowizji",
  ]) {
    const badges = inferCommercialInfo(text).badges;
    assert.ok(badges.includes("Bez prowizji"), text);
    assert.ok(!badges.includes("Z prowizją"), text);
  }
  for (const text of ["Kupujący płaci prowizję 2%.", "Oferta nie jest bez prowizji."])
    assert.ok(inferCommercialInfo(text).badges.includes("Z prowizją"), text);
  assert.ok(!inferCommercialInfo("Bezpośrednio od właścicieli").badges.includes("Z prowizją"));
});
