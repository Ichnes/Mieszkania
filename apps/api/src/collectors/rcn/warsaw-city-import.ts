import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import proj4 from "proj4";
import { withDb } from "../../db";
import { ensureSource } from "../../services/collecting/source-registry";
import { normalizeStreetName } from "../../services/geography/address-normalization";
import type { RcnImportResponse } from "@mieszkania/shared";

const cityPage = "https://architektura.um.warszawa.pl/udostepniane-dane-rcn1";
const projection =
  "+proj=tmerc +lat_0=0 +lon_0=21 +k=0.999923 +x_0=7500000 +y_0=0 +ellps=GRS80 +units=m +no_defs";
type Link = { "@_href": string };
type Feature = {
  "@_id": string;
  IdRCN?: { RCN_IdentyfikatorIIP: { lokalnyId: string } };
  nieruchomosc?: Link[];
  podstawaPrawna?: Link;
  lokal?: Link[];
  rodzajRynku?: string;
  dataSporzadzeniaDokumentu?: string;
  adresBudynkuZLokalem?: Link;
  miejscowosc?: string;
  ulica?: string;
  funkcjaLokalu?: string;
  idLokalu?: string;
  powUzytkowaLokalu?: string | { "#text": string };
  cenaLokaluBrutto?: string;
  udzialWPrawieDoNieruchomosci?: string;
  georeferencja?: { Point?: { "@_srsName"?: string; pos?: string } };
};
export function parseCityFlats(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    isArray: (name) => name === "lokal" || name === "nieruchomosc",
  });
  const features = new Map<string, Feature>();
  const transactions: Feature[] = [];
  for (const match of xml.matchAll(
    /<rcn:(RCN_(?:Transakcja|Nieruchomosc|Dokument|Lokal|Adres))\s[^>]*>[\s\S]*?<\/rcn:\1>/g,
  )) {
    const feature: Feature = parser.parse(match[0])[match[1]];
    if (match[1] === "RCN_Transakcja") transactions.push(feature);
    else features.set(feature["@_id"], feature);
  }
  const find = (link?: Link) => link && features.get(link["@_href"]?.replace(/^#/, ""));
  const records = [];
  for (const transaction of transactions) {
    const date = find(transaction.podstawaPrawna)?.dataSporzadzeniaDokumentu;
    const transactionId = transaction.IdRCN?.RCN_IdentyfikatorIIP.lokalnyId;
    if (!date || !transactionId) continue;
    for (const link of transaction.nieruchomosc ?? []) {
      const property = find(link);
      if (
        !property ||
        (property.udzialWPrawieDoNieruchomosci &&
          !["1", "1/1"].includes(property.udzialWPrawieDoNieruchomosci))
      )
        continue;
      for (const unitLink of property.lokal ?? []) {
        const unit = find(unitLink);
        if (unit?.funkcjaLokalu !== "1" || !unit.idLokalu?.startsWith("1465")) continue;
        const area = Number(
          typeof unit.powUzytkowaLokalu === "object"
            ? unit.powUzytkowaLokalu["#text"]
            : unit.powUzytkowaLokalu,
        );
        const price = Number(unit.cenaLokaluBrutto);
        if (!(area >= 20 && area <= 250 && price / area >= 3000 && price / area <= 50000)) continue;
        const address = find(unit.adresBudynkuZLokalem);
        const street = address?.ulica?.replace(/^(?:ulica|ul\.)\s+/i, "") ?? null;
        const point = unit.georeferencja?.Point;
        const [north, east] = point?.pos?.trim().split(/\s+/).map(Number) ?? [];
        const [lon, lat] =
          point?.["@_srsName"]?.endsWith("2178") && Number.isFinite(north) && Number.isFinite(east)
            ? proj4(projection, "WGS84", [east, north])
            : [null, null];
        records.push({
          date,
          street,
          street_key: street ? normalizeStreetName(street) : null,
          area,
          price,
          lat,
          lon,
          market:
            transaction.rodzajRynku === "1"
              ? "primary"
              : transaction.rodzajRynku === "2"
                ? "secondary"
                : null,
          raw: { tran_lokalny_id_iip: transactionId, lok_id_lokalu: unit.idLokalu },
        });
      }
    }
  }
  if (!records.length)
    throw new Error("W pliku miasta nie znaleziono porównywalnych transakcji mieszkań.");
  return records;
}

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Miasto Warszawa zwróciło HTTP ${response.status}.`);
  return response;
}
export async function importCityFlats(): Promise<RcnImportResponse> {
  const html = await (await download(cityPage)).text();
  const archives = [
    ...html.matchAll(
      /href=["']([^"'<>]*?zbior_danych_rc(?:iwn|n)_(\d{4})_(\d{8})\.zip[^"'<>]*)["']/gi,
    ),
  ].sort((a, b) => b[3].localeCompare(a[3]));
  if (!archives.length)
    throw new Error("Nie znaleziono aktualnego archiwum ZIP na stronie miasta.");
  const url = new URL(archives[0][1].replaceAll("&amp;", "&"), cityPage);
  if (url.origin !== new URL(cityPage).origin) throw new Error("Nieoczekiwany adres pliku RCN.");
  const zip = new Uint8Array(await (await download(url.href)).arrayBuffer());
  const files = unzipSync(zip, {
    filter: (file) =>
      file.name.toLowerCase().endsWith(".gml") && file.originalSize < 512 * 1024 * 1024,
  });
  const file = Object.values(files)[0];
  if (!file) throw new Error("Archiwum miasta nie zawiera pliku GML.");
  const records = parseCityFlats(new TextDecoder().decode(file));
  const inserted = await withDb(async (pool) => {
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(735189242)");
      const source = await ensureSource(db, "deweloperuch_rcn");
      const result = await db.query(
        `with incoming as (
        select distinct on (raw->>'tran_lokalny_id_iip',raw->>'lok_id_lokalu') *
        from jsonb_to_recordset($2::jsonb) as r(date date,street text,street_key text,area numeric,price numeric,lat numeric,lon numeric,market text,raw jsonb)
      ) insert into transaction_rcn(source_id,transaction_date,city,city_normalized,street,street_normalized,area_sqm,price_amount,price_per_sqm,latitude,longitude,market_type,property_type,payload_raw)
      select $1,r.date,'Warszawa','warszawa',r.street,r.street_key,r.area,r.price,r.price/r.area,r.lat,r.lon,r.market::market_type,'lokal mieszkalny',r.raw from incoming r
      where not exists(select 1 from transaction_rcn t where t.source_id=$1 and t.payload_raw->>'tran_lokalny_id_iip'=r.raw->>'tran_lokalny_id_iip'
        and (t.payload_raw->>'lok_id_lokalu'=r.raw->>'lok_id_lokalu' or (nullif(t.payload_raw->>'lok_id_lokalu','') is null and t.area_sqm=r.area and t.price_amount=r.price)))`,
        [source, JSON.stringify(records)],
      );
      await db.query("commit");
      return result.rowCount ?? 0;
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  });
  return {
    scope: "m-st-warszawa",
    checkedPowiatCount: 1,
    importedTransactions: inserted,
    powiats: [
      {
        key: "m-st-warszawa",
        label: "Warszawa · miejski plik GML",
        wfsCapabilitiesUrl: url.href,
        status: inserted ? "imported" : "checked",
        importedCount: inserted,
      },
    ],
  };
}
