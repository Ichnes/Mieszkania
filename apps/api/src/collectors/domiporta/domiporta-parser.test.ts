import assert from "node:assert/strict";
import test from "node:test";

import { extractDomiportaConstructionYear } from "../nieruchomosci-online";

test("reads the construction year from the labelled Domiporta feature", () => {
  const html = `
    <ul class="features__list-2">
      <li>
        <span class="features__item_name">Rok budowy </span>
        <span class="features__item_value">1999</span>
      </li>
    </ul>
  `;

  assert.equal(extractDomiportaConstructionYear(html), 1999);
});

test("does not confuse an unrelated Domiporta date with the construction year", () => {
  const html = `
    <span class="features__item_name">Data aktualizacji</span>
    <span class="features__item_value">2026</span>
  `;

  assert.equal(extractDomiportaConstructionYear(html), undefined);
});
