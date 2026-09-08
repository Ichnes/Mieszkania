import test from "node:test";
import assert from "node:assert/strict";
import { getDreamDescriptionFacts } from "@mieszkania/shared";
const points = (text: string) =>
  getDreamDescriptionFacts(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l"),
  ).countertopPoints;
test("countertop material points distinguish granite, engineered stone and natural oak without stacking", () => {
  for (const [text, expected] of [
    ["Blat granitowy", 8],
    ["Granitowe blaty", 8],
    ["Blaty z konglomeratu", 7],
    ["Blat ze spieku kwarcowego", 7],
    ["Blaty z naturalnego dębu", 5],
    ["Drewniany blat", 5],
    ["Blat drewniany i blat granitowy", 8],
    ["Blat ze spieku i konglomeratu", 7],
    ["Laminowany blat imitujący drewno", 0],
    ["Blat drewnopodobny", 0],
    ["Brak granitowego blatu", 0],
    ["Możliwość montażu blatu z drewna", 0],
    ["Dębowa podłoga i laminowany blat", 0],
    ["Blat kamienny", 0],
  ] as const)
    assert.equal(points(text), expected, text);
});
