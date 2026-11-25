import assert from "node:assert/strict";
import test from "node:test";
import { parseCityFlats } from "./warsaw-city-import";

test("joins each full residential unit to its document and uses the unit price", () => {
  const xml = `
  <rcn:RCN_Transakcja gml:id="t"><rcn:IdRCN><rcn:RCN_IdentyfikatorIIP><rcn:lokalnyId>tx</rcn:lokalnyId></rcn:RCN_IdentyfikatorIIP></rcn:IdRCN><rcn:podstawaPrawna xlink:href="d"/><rcn:nieruchomosc xlink:href="n"/><rcn:cenaTransakcjiBrutto>10000000</rcn:cenaTransakcjiBrutto></rcn:RCN_Transakcja>
  <rcn:RCN_Dokument gml:id="d"><rcn:dataSporzadzeniaDokumentu>2026-08-14</rcn:dataSporzadzeniaDokumentu></rcn:RCN_Dokument>
  <rcn:RCN_Nieruchomosc gml:id="n"><rcn:udzialWPrawieDoNieruchomosci>1/1</rcn:udzialWPrawieDoNieruchomosci><rcn:lokal xlink:href="l"/></rcn:RCN_Nieruchomosc>
  <rcn:RCN_Lokal gml:id="l"><rcn:idLokalu>1465-test</rcn:idLokalu><rcn:funkcjaLokalu>1</rcn:funkcjaLokalu><rcn:powUzytkowaLokalu uom="m2">50</rcn:powUzytkowaLokalu><rcn:cenaLokaluBrutto>750000</rcn:cenaLokaluBrutto></rcn:RCN_Lokal>`;
  const [flat] = parseCityFlats(xml);
  assert.equal(flat.price, 750000);
  assert.equal(flat.date, "2026-08-14");
  assert.equal(flat.market, null);
  assert.throws(() => parseCityFlats(xml.replace("1/1", "1/2")));
  assert.throws(() =>
    parseCityFlats(xml.replace(">1</rcn:funkcjaLokalu>", ">5</rcn:funkcjaLokalu>")),
  );
});
