import type { RcnImportResponse } from "@mieszkania/shared";
import proj4 from "proj4";
import type { RcnPowiatConfig } from "./types";
import { warsawAreaRcnPowiatConfigs } from "./warsaw-region-config";
import { withDb } from "../../db";
import { normalizePolish, normalizeStreetName } from "../../services/address-normalization";
import { ensureSource } from "../../services/source-registry";

type ParsedFeature = {
  raw: Record<string, string>;
  latitude: number | null;
  longitude: number | null;
};

const LOCAL_FEATURE_TYPE = "ms:lokale";
const PAGE_SIZE = 250;
const MAX_FEATURES_PER_SCOPE = 20_000;

proj4.defs("EPSG:2180", "+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs");

export async function importRcnTransactions(scope?: string): Promise<RcnImportResponse> {
  const configs = selectConfigs(scope);
  let importedTransactions = 0;

  const powiats = await Promise.all(
    configs.map(async (powiat) => {
      try {
        const capabilitiesXml = await fetchText(powiat.wfsCapabilitiesUrl);
        const featureTypes = parseFeatureTypes(capabilitiesXml).filter((name) => name === LOCAL_FEATURE_TYPE);
        if (featureTypes.length === 0) {
          throw new Error(`WFS RCN nie udostępnia warstwy ${LOCAL_FEATURE_TYPE}.`);
        }

        let powiatImportedCount = 0;

        for (let startIndex = 0; startIndex < MAX_FEATURES_PER_SCOPE; startIndex += PAGE_SIZE) {
          const featureUrl = buildGetFeatureUrl(powiat.wfsCapabilitiesUrl, LOCAL_FEATURE_TYPE, powiat, startIndex);
          const features = parseFeatureMembers(await fetchText(featureUrl));
          for (const feature of features) {
            const record = mapFeatureToTransaction(feature, powiat);
            if (!record) continue;
            if (await upsertTransaction(record)) {
              powiatImportedCount += 1;
              importedTransactions += 1;
            }
          }
          if (features.length < PAGE_SIZE) break;
        }

        return {
          key: powiat.key,
          label: powiat.label,
          wfsCapabilitiesUrl: powiat.wfsCapabilitiesUrl,
          status: powiatImportedCount > 0 ? ("imported" as const) : ("checked" as const),
          featureTypes,
          importedCount: powiatImportedCount
        };
      } catch (error) {
        return {
          key: powiat.key,
          label: powiat.label,
          wfsCapabilitiesUrl: powiat.wfsCapabilitiesUrl,
          status: "failed" as const,
          error: error instanceof Error ? error.message : "unknown error"
        };
      }
    })
  );

  return {
    scope: scope ?? "warsaw-metropolitan",
    checkedPowiatCount: configs.length,
    importedTransactions,
    powiats
  };
}

function selectConfigs(scope?: string) {
  if (!scope || scope === "warsaw-metropolitan") {
    return warsawAreaRcnPowiatConfigs;
  }

  return warsawAreaRcnPowiatConfigs.filter((powiat) => powiat.key === scope);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/xml,text/xml"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function parseFeatureTypes(xml: string) {
  const featureBlocks = xml.match(/<FeatureType>[\s\S]*?<\/FeatureType>/g) ?? [];
  return featureBlocks
    .map((block) => block.match(/<Name>([^<]+)<\/Name>/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function buildGetFeatureUrl(capabilitiesUrl: string, typeName: string, powiat: RcnPowiatConfig, startIndex: number) {
  const url = new URL(capabilitiesUrl);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("typeNames", typeName);
  url.searchParams.set("count", String(PAGE_SIZE));
  url.searchParams.set("STARTINDEX", String(startIndex));
  url.searchParams.set("srsName", "EPSG:2180");
  url.searchParams.set("bbox", `${powiat.bbox2180.join(",")},EPSG:2180`);
  return url.toString();
}

function parseFeatureMembers(xml: string): ParsedFeature[] {
  const memberBlocks =
    xml.match(/<(?:wfs:member|gml:featureMember)>[\s\S]*?<\/(?:wfs:member|gml:featureMember)>/g) ?? [];

  return memberBlocks.map((block) => {
    const tags = Array.from(
      block.matchAll(/<[\w.-]+:([\w.-]+)>([^<]*)<\/[\w.-]+:[\w.-]+>/g),
      (match) => [match[1], decodeXml(match[2].trim())] as const
    );

    return { raw: Object.fromEntries(tags), ...parseRcnCoordinates(block) };
  });
}

function mapFeatureToTransaction(feature: ParsedFeature, powiat: RcnPowiatConfig) {
  const raw = feature.raw;
  if (!firstValue(raw, ["teryt"])?.startsWith(powiat.terytPrefix)) return null;
  const transactionDate = firstExactValue(raw, ["dok_data", "transactionDate", "dataTransakcji", "date", "data"]);
  const priceAmount = parseNumber(firstExactValue(raw, ["lok_cena_brutto", "tran_cena_brutto", "price", "cena", "wartosc"]));
  const areaSqm = parseNumber(firstExactValue(raw, ["lok_pow_uzyt", "powierzchniaUzytkowa", "powierzchnia", "area"]));
  const address = parseRcnAddress(firstExactValue(raw, ["lok_adres"]));
  const district = firstValue(raw, ["district", "dzielnica", "obreb"]) ?? null;
  const city = address.city ?? firstValue(raw, ["city", "miasto", "gmina"]) ?? powiat.cityFocus;
  const street = address.street ?? firstExactValue(raw, ["street", "ulica", "adres", "adresNieruchomosci", "nazwaUlicy", "streetName"]);
  const marketType = inferMarketType(firstExactValue(raw, ["tran_rodzaj_rynku", "marketType", "rynek", "typRynku"]));
  const propertyType = firstExactValue(raw, ["lok_funkcja", "propertyType", "rodzaj", "typNieruchomosci"]) ?? "flat";
  if (!transactionDate || !priceAmount || !areaSqm) {
    return null;
  }

  const pricePerSqm = priceAmount / areaSqm;
  if (!isComparableFlat(raw, areaSqm, pricePerSqm)) {
    return null;
  }

  return {
    sourceKey: "deweloperuch_rcn",
    transactionDate,
    city,
    cityNormalized: normalizePolish(city),
    district,
    districtNormalized: district ? normalizePolish(district) : null,
    street: street ?? null,
    streetNormalized: normalizeStreetName(street),
    latitude: feature.latitude,
    longitude: feature.longitude,
    propertyType,
    marketType,
    areaSqm,
    priceAmount,
    pricePerSqm,
    payloadRaw: raw
  };
}

function parseRcnCoordinates(block: string) {
  const position = block.match(/<gml:pos>([^<]+)<\/gml:pos>/)?.[1]?.trim().split(/\s+/).map(Number);
  if (!position || position.length < 2 || !position.every(Number.isFinite)) return { latitude: null, longitude: null };
  const [longitude, latitude] = proj4("EPSG:2180", "WGS84", [position[1], position[0]]);
  return latitude >= 49 && latitude <= 55 && longitude >= 14 && longitude <= 25 ? { latitude, longitude } : { latitude: null, longitude: null };
}

function parseRcnAddress(value: string | null) {
  if (!value) return {};
  const city = value.match(/(?:^|;)MSC:([^;]+)/i)?.[1]?.trim();
  const street = value.match(/(?:^|;)UL:(?:ulica\s+)?([^;]+)/i)?.[1]?.trim();
  return { city, street };
}

function isComparableFlat(raw: Record<string, string>, areaSqm: number, pricePerSqm: number | null) {
  const functionName = normalizePolish(firstValue(raw, ["lok_funkcja"]) ?? "");
  return !functionName.includes("garaz")
    && !functionName.includes("parking")
    && areaSqm >= 20
    && areaSqm <= 250
    && pricePerSqm !== null
    && pricePerSqm >= 3_000
    && pricePerSqm <= 50_000;
}

async function upsertTransaction(record: {
  sourceKey: string;
  transactionDate: string;
  city: string;
  cityNormalized: string;
  district: string | null;
  districtNormalized: string | null;
  street: string | null;
  streetNormalized: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string;
  marketType: "primary" | "secondary";
  areaSqm: number | null;
  priceAmount: number;
  pricePerSqm: number | null;
  payloadRaw: Record<string, string>;
}) {
  return withDb(async (db) => {
    try {
      const sourceId = await ensureSource(db, record.sourceKey);
      const externalTransactionId = firstExactValue(record.payloadRaw, ["tran_lokalny_id_iip"]);
      const exists = await db.query<{ id: string }>(
        `
        select id
        from transaction_rcn
        where source_id = $1
          and (
            ($2::text is not null and payload_raw->>'tran_lokalny_id_iip' = $2::text)
            or (
              $2::text is null
              and transaction_date = $3
              and city = $4
              and coalesce(district, '') = coalesce($5, '')
              and price_amount = $6::numeric
              and coalesce(area_sqm, 0) = coalesce($7::numeric, 0)
            )
          )
        limit 1
      `,
        [sourceId, externalTransactionId, record.transactionDate, record.city, record.district, record.priceAmount, record.areaSqm]
      );

      if (exists.rows[0]?.id) {
        await db.query(
          `
          update transaction_rcn
          set city_normalized = $2,
              district_normalized = $3,
              street = coalesce($4, street),
              street_normalized = coalesce($5, street_normalized),
              latitude = coalesce($6, latitude),
              longitude = coalesce($7, longitude),
              payload_raw = $8
          where id = $1
          `,
          [
          exists.rows[0].id,
          record.cityNormalized,
          record.districtNormalized,
          record.street,
          record.streetNormalized,
          record.latitude,
          record.longitude,
          JSON.stringify(record.payloadRaw)
          ]
        );
        return false;
      }

      await db.query(
        `
        insert into transaction_rcn (
          source_id,
          transaction_date,
          city,
          city_normalized,
          district,
          district_normalized,
          street,
          street_normalized,
          latitude,
          longitude,
          property_type,
          market_type,
          area_sqm,
          price_amount,
          price_per_sqm,
          payload_raw
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `,
        [
        sourceId,
        record.transactionDate,
        record.city,
        record.cityNormalized,
        record.district,
        record.districtNormalized,
        record.street,
        record.streetNormalized,
        record.latitude,
        record.longitude,
        record.propertyType,
        record.marketType,
        record.areaSqm,
        record.priceAmount,
        record.pricePerSqm,
        JSON.stringify(record.payloadRaw)
        ]
      );
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown database error";
      throw new Error(`${reason}; RCN values: ${JSON.stringify({ transactionDate: record.transactionDate, areaSqm: record.areaSqm, priceAmount: record.priceAmount, pricePerSqm: record.pricePerSqm, sourceKey: record.sourceKey })}`);
    }
  });
}

function firstValue(raw: Record<string, string>, keys: string[]) {
  const entries = Object.entries(raw);
  for (const key of keys) {
    const found = entries.find(([entryKey]) => entryKey.toLowerCase() === key.toLowerCase());
    if (found?.[1]) {
      return found[1];
    }
  }

  for (const key of keys) {
    const found = entries.find(([entryKey]) => entryKey.toLowerCase().includes(key.toLowerCase()));
    if (found?.[1]) {
      return found[1];
    }
  }

  return null;
}

function firstExactValue(raw: Record<string, string>, keys: string[]) {
  const entries = Object.entries(raw);
  for (const key of keys) {
    const found = entries.find(([entryKey]) => entryKey.toLowerCase() === key.toLowerCase());
    if (found?.[1]) return found[1];
  }
  return null;
}

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isNaN(numeric) ? null : numeric;
}

function parseInteger(value: string | null) {
  const numeric = parseNumber(value);
  return numeric === null ? null : Math.trunc(numeric);
}

function inferMarketType(value: string | null): "primary" | "secondary" {
  if (value?.toLowerCase().includes("pierw")) {
    return "primary";
  }

  return "secondary";
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
