import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultFamilySettings, type ListingSummary } from "@mieszkania/shared";
import { ListingScorePanel } from "./ListingScorePanel";

test("evaluation opens with rule cards and the matched band in bold while raw data is collapsed", () => {
  const html = renderToStaticMarkup(
    <ListingScorePanel
      settings={createDefaultFamilySettings()}
      listing={
        {
          title: "Test",
          district: "Mokotów",
          priceLabel: "1 800 001 zł",
          badges: [],
          priceChangePercent: 0,
        } as unknown as ListingSummary
      }
    />,
  );
  assert.ok(html.indexOf('id="dream-score-rules"') < html.indexOf('class="score-expanded-data"'));
  assert.match(html, /<strong>Powyżej limitu, maksymalnie o 7%: -5 pkt<\/strong>/);
  assert.match(html, /<details class="score-expanded-data"><summary>Dane rozwinięte<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*\bopen/);
  assert.match(html, /aria-label="Rozbicie punktacji"/);
});
