import type { ImmediateSurroundingsFinding } from "@mieszkania/shared";
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDescription, groupSurroundings } from "./analysis-insights";

test("rail segments collapse by type, keep nearest distance and do not hide waste", () => {
  const rails: ImmediateSurroundingsFinding[] = Array.from({ length: 20 }, (_, id) => ({
    osmKey: `way:${id}`,
    category: "railway",
    name: "Tory",
    label: "Tory",
    distanceMeters: id + 1,
    severity: "information",
    detail: "railway=rail",
    osmUrl: `https://www.openstreetmap.org/way/${id}`,
  }));
  const waste: ImmediateSurroundingsFinding = {
    ...rails[0],
    osmKey: "node:200",
    category: "waste",
    label: "Odpady",
    name: "Recykling",
    distanceMeters: 40,
  };
  const groups = groupSurroundings([...rails, rails[0], waste]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].nearest, 1);
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].items[0].members.length, 20);
  assert.equal(groups[1].label, "Odpady i ścieki");
});
test("description questions retain original evidence and avoid simple negations", () => {
  const text = "Lokal nie wymaga remontu. Miejsce dodatkowo płatne 50 000 zł. Bez najemców.";
  const insights = analyzeDescription(text);
  assert.deepEqual(
    insights.map((item) => item.key),
    ["extras"],
  );
  assert.equal(insights[0].evidence, "Miejsce dodatkowo płatne 50 000 zł.");
  assert.equal(analyzeDescription("").length, 0);
});

test("does not manufacture questions from clear positive or resolved statements", () => {
  assert.deepEqual(
    analyzeDescription(
      "Pełna własność z księgą wieczystą. Dostępne od 1 maja. Zakup bez prowizji. Nie wymaga remontu.",
    ),
    [],
  );
  assert.deepEqual(analyzeDescription("Brak windy.", 0), []);
});

test("questions explain consequences and preserve source evidence", () => {
  const items = analyzeDescription(
    "Lokal wynajęty do grudnia. Garaż: zakup obowiązkowy, dodatkowo płatny 50 000 zł.",
  );
  assert.deepEqual(
    items.map((i) => i.key),
    ["availability", "extras"],
  );
  assert.match(items[0].question, /umowa najmu/);
  assert.match(items[1].question, /łączną cenę/);
  assert.ok(items.every((i) => i.reason.length > 30 && i.evidence.length > 0));
});

test("storage rooms do not imply tenants", () => {
  assert.deepEqual(
    analyzeDescription("Dwa miejsca w garażu i 2 komórki lokatorskie. Mieszkanie na parterze."),
    [],
  );
});

test("prospective tenants and zero commission are not unresolved conditions", () => {
  assert.deepEqual(analyzeDescription("Idealne dla najemców. Brak prowizji."), []);
});
