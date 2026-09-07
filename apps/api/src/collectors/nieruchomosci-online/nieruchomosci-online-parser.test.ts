import assert from "node:assert/strict";
import test from "node:test";
import { extractNieruchomosciOnlineConstructionYear } from "./index";

test("reads the year from the current Nieruchomości-online attributes markup", () => {
  const html = `<div class="box__attributes--content"><span class="fheader body-sm">Rok budowy:</span><br><span class="fsize-a">2018</span></div>`;
  assert.equal(extractNieruchomosciOnlineConstructionYear(html), 2018);
});

test("keeps support for the legacy strong/span markup", () => {
  assert.equal(extractNieruchomosciOnlineConstructionYear(`<strong>Rok budowy:</strong><span>2007</span>`), 2007);
});
