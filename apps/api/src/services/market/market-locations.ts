import {
  canonicalWarsawDistrict,
  canonicalWarsawNeighborhood,
  inferWarsawNeighborhood,
} from "../geography/warsaw-neighborhoods";

export function normalizeMarketLocation(row: {
  district: string | null;
  neighborhood: string | null;
}) {
  const district =
    canonicalWarsawDistrict(row.district ?? "") ??
    canonicalWarsawDistrict(row.neighborhood ?? "") ??
    "Bez dzielnicy";
  const neighborhood =
    canonicalWarsawNeighborhood(row.neighborhood ?? "", district) ??
    canonicalWarsawNeighborhood(row.district ?? "", district) ??
    inferWarsawNeighborhood(row.neighborhood ?? "", district) ??
    inferWarsawNeighborhood(row.district ?? "", district) ??
    "Nieustalona";
  return { raw_district: row.district, raw_neighborhood: row.neighborhood, district, neighborhood };
}

// Join raw observations to their canonical geography BEFORE percentile/average/count.
export const marketLocationJoinSql = `join jsonb_to_recordset($1::jsonb) as location(raw_district text, raw_neighborhood text, district text, neighborhood text)
 on l.district is not distinct from location.raw_district and l.neighborhood is not distinct from location.raw_neighborhood`;
