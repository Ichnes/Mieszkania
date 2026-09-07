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
