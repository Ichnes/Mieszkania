import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SampleSizeIndicator, SegmentedLinearGauge } from "./MarketIndicators";

test("sample labels follow the displayed cohort boundaries", () => {
  const cases: [number | undefined, string][] = [
    [undefined, "Nieznana liczebność"],
    [0, "Brak obserwacji"],
    [1, "bardzo mała"],
    [3, "bardzo mała"],
    [4, "mała próba"],
    [5, "mała próba"],
    [9, "mała próba"],
    [10, "ograniczona"],
    [29, "ograniczona"],
    [30, "średnia"],
    [99, "średnia"],
    [100, "duża"],
  ];
  for (const [count, expected] of cases) {
    const html = renderToStaticMarkup(createElement(SampleSizeIndicator, { count, unit: "ofert" }));
    assert.ok(html.includes(expected), html);
  }
});

test("only known pressure values place a marker on the scale", () => {
  const render = (score: number | null) =>
    renderToStaticMarkup(createElement(SegmentedLinearGauge, { score }));
  assert.match(render(null), /Brak wyniku/);
  assert.doesNotMatch(render(null), /left:/);
  for (const score of [0, 50, 100]) assert.ok(render(score).includes("left:" + score + "%"));
});
