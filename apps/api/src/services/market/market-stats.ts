import { normalizeMarketLocation, marketLocationJoinSql } from "./market-locations";
import {
  mapPriceSample,
  priceSampleSql,
  MIN_MARKET_SAMPLE,
  type PriceSampleRow,
} from "./market-sample";
import type { MarketStatsResponse } from "@mieszkania/shared";
import { withDb } from "../../db";
import {
  canonicalWarsawDistrict,
  canonicalWarsawNeighborhood,
  inferWarsawNeighborhood,
} from "../geography/warsaw-neighborhoods";
import { getFamilySettings } from "../settings/family-settings";
import { getMarketAmenityFilter } from "./market-amenities";
import { getMarketSignals } from "./market-signals";
import { getMarketPropertySegments } from "./market-property-segments";

export type MarketStatsQuery = {
  minYear?: string;
  minArea?: string;
  maxArea?: string;
  elevator?: string;
  garage?: string;
  period?: string;
};

export async function getMarketStats(query: MarketStatsQuery): Promise<MarketStatsResponse> {
  return withDb(async (db) => {
    const { searchContract } = await getFamilySettings();
    const minYear = Number(query.minYear);
    const minArea = Math.max(searchContract.minArea, Number(query.minArea) || 0);
    const maxArea = Number(query.maxArea);
    const requestedPeriod = Number(query.period);
    const periodDays = ([30, 90, 180].includes(requestedPeriod) ? requestedPeriod : 90) as
      | 30
      | 90
      | 180;
    const scopeFilters = [
      `price_amount >= ${searchContract.minPrice}`,
      `price_amount <= ${searchContract.maxPrice}`,
      `rooms >= ${searchContract.roomsMin}`,
    ];
    const statsFilters = [
      ...scopeFilters,
      "hidden_duplicate_of_id is null",
      "coalesce(exclusion_reason, '') <> 'manual_rejected'",
      Number.isFinite(minYear) && minYear > 0 ? `year_built >= ${Math.floor(minYear)}` : "",
      Number.isFinite(minArea) && minArea > 0 ? `area_sqm >= ${minArea}` : "",
      Number.isFinite(maxArea) && maxArea > 0 ? `area_sqm <= ${maxArea}` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    let aliasedStatsFilters = statsFilters.replace(
      /\b(hidden_duplicate_of_id|year_built|area_sqm|description|price_amount|rooms|exclusion_reason)\b/g,
      "l.$1",
    );
    aliasedStatsFilters += await getMarketAmenityFilter(db, aliasedStatsFilters, query);
    const locations = await db.query<{ district: string | null; neighborhood: string | null }>(
      "select distinct district, neighborhood from listings where lower(city)='warszawa'",
    );
    const locationMapping = JSON.stringify(locations.rows.map(normalizeMarketLocation));
    const [
      totals,
      districts,
      neighborhoods,
      activity,
      distribution,
      comparison,
      roomSegments,
      areaSegments,
      buildingAgeSegments,
      sourceSegments,
      marketTypeSegments,
      boundaries,
      signals,
      propertySegments,
    ] = await Promise.all([
      db.query<{
        active: string;
        archived: string;
        avg_price: string | null;
        median_price: string | null;
        avg_area: string | null;
        new_7: string;
        archived_30: string;
      }>(
        `select count(*) filter (where status='active')::text active, count(*) filter (where status='removed' and coalesce(exclusion_reason,'') <> 'manual_rejected')::text archived, round(avg(price_amount/nullif(area_sqm,0)) filter (where status='active' and price_amount>0 and area_sqm > 0))::text avg_price, percentile_cont(0.5) within group (order by price_amount/nullif(area_sqm,0)) filter (where status='active' and price_amount>0 and area_sqm > 0) median_price, round(avg(area_sqm) filter (where status='active' and area_sqm > 0),1)::text avg_area, count(*) filter (where status='active' and first_seen_at >= now()-interval '7 days')::text new_7, count(*) filter (where status='removed' and coalesce(exclusion_reason,'') <> 'manual_rejected' and removed_at >= now()-interval '30 days')::text archived_30 from listings l where lower(l.city)='warszawa' and ${aliasedStatsFilters}`,
      ),
      db.query<{
        district: string | null;
        active: string;
        archived: string;
        avg_price: string | null;
        median_price: string | null;
        priced: string;
        avg_area: string | null;
        drops: string;
        increases: string;
        new_7: string;
        new_period: string;
        archived_period: string;
        median_days: string | null;
      }>(
        `select location.district district, count(*) filter (where l.status='active')::text active, count(*) filter (where l.status='removed' and coalesce(l.exclusion_reason,'') <> 'manual_rejected')::text archived, round(avg(l.price_amount/nullif(l.area_sqm,0)) filter (where l.status='active' and l.price_amount>0 and l.area_sqm > 0))::text avg_price, percentile_cont(0.5) within group (order by l.price_amount/nullif(l.area_sqm,0)) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays}) and l.price_amount>0 and l.area_sqm > 0)::text median_price, count(*) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays}) and l.price_amount>0 and l.area_sqm > 0)::text priced, round(avg(l.area_sqm) filter (where l.status='active' and l.area_sqm > 0),1)::text avg_area, count(*) filter (where l.status='active' and exists (select 1 from price_events pe where pe.listing_id=l.id and pe.event_type='price_drop' and pe.changed_at >= now()-make_interval(days => ${periodDays})))::text drops, count(*) filter (where l.status='active' and exists (select 1 from price_events pe where pe.listing_id=l.id and pe.event_type='price_increase' and pe.changed_at >= now()-make_interval(days => ${periodDays})))::text increases, count(*) filter (where l.status='active' and l.first_seen_at >= now()-interval '7 days')::text new_7, count(*) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays}))::text new_period, count(*) filter (where l.status='removed' and coalesce(l.exclusion_reason,'') <> 'manual_rejected' and l.removed_at >= now()-make_interval(days => ${periodDays}))::text archived_period, percentile_cont(0.5) within group (order by extract(epoch from (l.removed_at-l.first_seen_at))/86400) filter (where l.status='removed' and l.removed_at >= now()-make_interval(days => ${periodDays}) and l.removed_at >= l.first_seen_at)::text median_days from listings l ${marketLocationJoinSql} where lower(l.city)='warszawa' and ${aliasedStatsFilters} group by 1 order by count(*) filter (where l.status='active') desc`,
        [locationMapping],
      ),
      db.query<{
        district: string;
        neighborhood: string;
        active: string;
        avg_price: string | null;
      }>(
        `select location.district district, location.neighborhood neighborhood, count(*) filter (where l.status='active')::text active, round(avg(l.price_amount/nullif(l.area_sqm,0)) filter (where l.status='active' and l.price_amount>0 and l.area_sqm > 0))::text avg_price from listings l ${marketLocationJoinSql} where lower(l.city)='warszawa' and ${aliasedStatsFilters} group by 1,2 having count(*) filter (where l.status='active') > 0 order by 1, count(*) filter (where l.status='active') desc`,
        [locationMapping],
      ),
      db.query<{
        week: string;
        new_listings: string;
        archived_listings: string;
        median_price: string | null;
      }>(`
      select
        to_char(w::date, 'YYYY-MM-DD') week,
        count(l.id) filter (where l.first_seen_at >= w and l.first_seen_at < w + interval '1 week')::text new_listings,
        count(l.id) filter (where l.removed_at >= w and l.removed_at < w + interval '1 week' and coalesce(l.exclusion_reason,'') <> 'manual_rejected')::text archived_listings,
        percentile_cont(0.5) within group (order by l.price_amount/nullif(l.area_sqm,0)) filter (where l.first_seen_at >= w and l.first_seen_at < w + interval '1 week' and l.price_amount>0 and l.area_sqm > 0)::text median_price
      from generate_series(date_trunc('week', current_date - make_interval(days => ${periodDays - 1})), date_trunc('week', current_date), interval '1 week') w
      left join listings l
        on lower(l.city) = 'warszawa'
        and ${aliasedStatsFilters}
        and ((l.first_seen_at >= w and l.first_seen_at < w + interval '1 week') or (l.removed_at >= w and l.removed_at < w + interval '1 week'))
      group by w
      order by w
    `),
      db.query<{ label: string; count: string } & PriceSampleRow>(
        `select bucket.label, count(*)::text count from (select case when l.price_amount/nullif(l.area_sqm,0) < 15000 then 'poniżej 15 tys.' when l.price_amount/nullif(l.area_sqm,0) < 18000 then '15–18 tys.' when l.price_amount/nullif(l.area_sqm,0) < 21000 then '18–21 tys.' when l.price_amount/nullif(l.area_sqm,0) < 24000 then '21–24 tys.' when l.price_amount/nullif(l.area_sqm,0) < 28000 then '24–28 tys.' else '28 tys. i więcej' end label, case when l.price_amount/nullif(l.area_sqm,0) < 15000 then 1 when l.price_amount/nullif(l.area_sqm,0) < 18000 then 2 when l.price_amount/nullif(l.area_sqm,0) < 21000 then 3 when l.price_amount/nullif(l.area_sqm,0) < 24000 then 4 when l.price_amount/nullif(l.area_sqm,0) < 28000 then 5 else 6 end position from listings l where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and l.price_amount>0 and l.area_sqm > 0 and ${aliasedStatsFilters}) bucket group by bucket.label order by min(bucket.position)`,
      ),
      db.query<{
        new_current: string;
        new_previous: string;
        archived_current: string;
        archived_previous: string;
        median_current: string | null;
        median_previous: string | null;
        drops: string;
        median_days: string | null;
      }>(
        `select count(*) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays}))::text new_current, count(*) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays * 2}) and l.first_seen_at < now()-make_interval(days => ${periodDays}))::text new_previous, count(*) filter (where l.status='removed' and coalesce(l.exclusion_reason,'') <> 'manual_rejected' and l.removed_at >= now()-make_interval(days => ${periodDays}))::text archived_current, count(*) filter (where l.status='removed' and coalesce(l.exclusion_reason,'') <> 'manual_rejected' and l.removed_at >= now()-make_interval(days => ${periodDays * 2}) and l.removed_at < now()-make_interval(days => ${periodDays}))::text archived_previous, percentile_cont(0.5) within group (order by l.price_amount/nullif(l.area_sqm,0)) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays}) and l.price_amount>0 and l.area_sqm > 0)::text median_current, percentile_cont(0.5) within group (order by l.price_amount/nullif(l.area_sqm,0)) filter (where l.first_seen_at >= now()-make_interval(days => ${periodDays * 2}) and l.first_seen_at < now()-make_interval(days => ${periodDays}) and l.price_amount>0 and l.area_sqm > 0)::text median_previous, count(*) filter (where l.status='active' and exists (select 1 from price_events pe where pe.listing_id=l.id and pe.event_type='price_drop' and pe.changed_at >= now()-make_interval(days => ${periodDays})))::text drops, percentile_cont(0.5) within group (order by extract(epoch from (l.removed_at-l.first_seen_at))/86400) filter (where l.status='removed' and l.removed_at >= now()-make_interval(days => ${periodDays}) and l.removed_at >= l.first_seen_at)::text median_days from listings l where lower(l.city)='warszawa' and ${aliasedStatsFilters}`,
      ),
      db.query<{ label: string; count: string } & PriceSampleRow>(
        `select bucket.label, count(*)::text count, ${priceSampleSql.replaceAll("l.", "bucket.")} from (select l.price_amount,l.area_sqm, case when l.rooms is null then 'Brak danych' when l.rooms < 2 then '1 pokój' when l.rooms < 3 then '2 pokoje' when l.rooms < 4 then '3 pokoje' when l.rooms < 5 then '4 pokoje' else '5+ pokoi' end label, case when l.rooms is null then 6 when l.rooms < 2 then 1 when l.rooms < 3 then 2 when l.rooms < 4 then 3 when l.rooms < 5 then 4 else 5 end position from listings l where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and ${aliasedStatsFilters}) bucket group by bucket.label order by min(bucket.position)`,
      ),
      db.query<{ label: string; count: string } & PriceSampleRow>(
        `select bucket.label, count(*)::text count, ${priceSampleSql.replaceAll("l.", "bucket.")} from (select l.price_amount,l.area_sqm, case when l.area_sqm is null then 'Brak danych' when l.area_sqm < 40 then '< 40 m²' when l.area_sqm < 60 then '40–<60 m²' when l.area_sqm < 80 then '60–<80 m²' when l.area_sqm < 100 then '80–<100 m²' else '100+ m²' end label, case when l.area_sqm is null then 6 when l.area_sqm < 40 then 1 when l.area_sqm < 60 then 2 when l.area_sqm < 80 then 3 when l.area_sqm < 100 then 4 else 5 end position from listings l where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and ${aliasedStatsFilters}) bucket group by bucket.label order by min(bucket.position)`,
      ),
      db.query<{ label: string; count: string } & PriceSampleRow>(
        `select bucket.label, count(*)::text count, ${priceSampleSql.replaceAll("l.", "bucket.")} from (select l.price_amount,l.area_sqm, case when l.year_built is null then 'Brak roku' when l.year_built < 1945 then 'Przed 1945' when l.year_built < 1990 then '1945–1989' when l.year_built < 2010 then '1990–2009' when l.year_built < 2020 then '2010–2019' else '2020+' end label, case when l.year_built is null then 6 when l.year_built < 1945 then 1 when l.year_built < 1990 then 2 when l.year_built < 2010 then 3 when l.year_built < 2020 then 4 else 5 end position from listings l where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and ${aliasedStatsFilters}) bucket group by bucket.label order by min(bucket.position)`,
      ),
      db.query<{ label: string; count: string } & PriceSampleRow>(
        `select s.name label, count(*)::text count, ${priceSampleSql} from listings l join sources s on s.id=l.source_id where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and ${aliasedStatsFilters} group by s.name order by count(*) desc`,
      ),
      db.query<{ label: string; count: string } & PriceSampleRow>(
        `select case l.market_type when 'primary' then 'Rynek pierwotny' else 'Rynek wtórny' end label, count(*)::text count, ${priceSampleSql} from listings l where lower(l.city)='warszawa' and l.first_seen_at >= now()-make_interval(days => ${periodDays}) and ${aliasedStatsFilters} group by l.market_type order by count(*) desc`,
      ),
      db.query<{ name: string; geometry_geojson: unknown }>(
        `select name, geometry_geojson from district_boundaries where city = 'Warszawa'`,
      ),
      getMarketSignals(db, aliasedStatsFilters, periodDays, locationMapping),
      getMarketPropertySegments(db, aliasedStatsFilters, periodDays),
    ]);
    const t = totals.rows[0] ?? ({} as any);
    const c = comparison.rows[0] ?? ({} as any);
    const percentChange = (current: number, previous: number) =>
      previous > 0 ? Math.round(((current - previous) / previous) * 1_000) / 10 : null;
    const newListings = Number(c.new_current ?? 0);
    const previousNewListings = Number(c.new_previous ?? 0);
    const archivedListings = Number(c.archived_current ?? 0);
    const previousArchivedListings = Number(c.archived_previous ?? 0);
    const medianNewPricePerSqm = Number(c.median_current ?? 0);
    const previousMedianNewPricePerSqm = Number(c.median_previous ?? 0);
    const priceDrops = Number(c.drops ?? 0);
    const distributionTotal = distribution.rows.reduce((sum, row) => sum + Number(row.count), 0);
    const mapSegments = (rows: Array<{ label: string; count: string } & PriceSampleRow>) => {
      const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
      return rows.map((row) => ({
        label: row.label,
        ...mapPriceSample(row),
        count: Number(row.count),
        sharePercent: total ? Math.round((Number(row.count) / total) * 1_000) / 10 : 0,
      }));
    };
    return {
      periodDays,
      minimumSampleSize: MIN_MARKET_SAMPLE,
      scope: { ...searchContract, minArea, maxArea: maxArea > 0 ? maxArea : undefined },
      signals,
      totals: {
        active: Number(t.active ?? 0),
        archived: Number(t.archived ?? 0),
        averagePricePerSqm: Number(t.avg_price ?? 0),
        medianPricePerSqm: Number(t.median_price ?? 0),
        averageArea: Number(t.avg_area ?? 0),
        newLast7Days: Number(t.new_7 ?? 0),
        archivedLast30Days: Number(t.archived_30 ?? 0),
      },
      comparison: {
        newListings,
        previousNewListings,
        newListingsChangePercent: percentChange(newListings, previousNewListings),
        archivedListings,
        previousArchivedListings,
        archivedListingsChangePercent: percentChange(archivedListings, previousArchivedListings),
        medianNewPricePerSqm,
        previousMedianNewPricePerSqm,
        medianPriceChangePercent: percentChange(medianNewPricePerSqm, previousMedianNewPricePerSqm),
        priceDrops,
        priceDropSharePercent:
          Number(t.active) > 0 ? Math.round((priceDrops / Number(t.active)) * 1_000) / 10 : 0,
        medianDaysOnMarket: c.median_days == null ? null : Math.round(Number(c.median_days)),
      },
      districts: districts.rows.map((row) => {
        const active = Number(row.active ?? 0);
        const archived = Number(row.archived ?? 0);
        const storedDistrict = row.district ?? "Bez dzielnicy";
        const district = canonicalWarsawDistrict(storedDistrict) ?? storedDistrict;
        const neighborhoodFromDistrict =
          canonicalWarsawNeighborhood(storedDistrict, district) ??
          inferWarsawNeighborhood(storedDistrict, district);
        return {
          district,
          active,
          archived,
          averagePricePerSqm: Number(row.avg_price ?? 0),
          medianPricePerSqm: Number(row.median_price ?? 0),
          pricedListings: Number(row.priced ?? 0),
          averageArea: Number(row.avg_area ?? 0),
          archiveRate: active + archived ? Math.round((archived / (active + archived)) * 100) : 0,
          priceDrops: Number(row.drops ?? 0),
          priceIncreases: Number(row.increases ?? 0),
          newLast7Days: Number(row.new_7 ?? 0),
          newInPeriod: Number(row.new_period ?? 0),
          archivedInPeriod: Number(row.archived_period ?? 0),
          medianDaysOnMarket: row.median_days == null ? null : Math.round(Number(row.median_days)),
          geometry: boundaries.rows.find((boundary) => boundary.name === district)
            ?.geometry_geojson,
          neighborhoods: neighborhoods.rows
            .filter((neighborhood) => neighborhood.district === storedDistrict)
            .map((neighborhood) => ({
              neighborhood:
                neighborhood.neighborhood === "Nieustalona"
                  ? (neighborhoodFromDistrict ?? neighborhood.neighborhood)
                  : neighborhood.neighborhood,
              active: Number(neighborhood.active ?? 0),
              averagePricePerSqm: Number(neighborhood.avg_price ?? 0),
            })),
        };
      }),
      activity: activity.rows.map((row) => ({
        week: row.week,
        newListings: Number(row.new_listings ?? 0),
        archivedListings: Number(row.archived_listings ?? 0),
        medianPricePerSqm: Number(row.median_price ?? 0),
      })),
      priceDistribution: distribution.rows.map((row) => ({
        label: row.label,
        count: Number(row.count),
        sharePercent: distributionTotal
          ? Math.round((Number(row.count) / distributionTotal) * 1_000) / 10
          : 0,
      })),
      segments: {
        ...propertySegments,
        rooms: mapSegments(roomSegments.rows),
        areas: mapSegments(areaSegments.rows),
        buildingAge: mapSegments(buildingAgeSegments.rows),
        sources: mapSegments(sourceSegments.rows),
        marketTypes: mapSegments(marketTypeSegments.rows),
      },
    };
  });
}
