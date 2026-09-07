import type { PlanningActSummary, PlanningContextResponse } from "@mieszkania/shared";
import { withDb } from "../../db";
import { fetchExternalJson } from "../http/external-json";
import { getImmediateSurroundings } from "./immediate-surroundings";
import { getListingParcelContext } from "./listing-parcel-context";

const REGISTRY_URL = "https://rejestr-urbanistyczny.gov.pl/published";
const QUERY_URL = "https://rejestr-urbanistyczny.gov.pl/api/public/published/query";
const CACHE_TTL_DAYS = 7;
const CACHE_VERSION = 3;

type RegistryAct = {
  publishedActId?: number;
  planType?: string;
  planTypeDescription?: string;
  title?: string;
  spatialPlanningActStatus?: string;
  publishDate?: string;
  validFrom?: string | null;
  validTo?: string | null;
  commune?: string;
  district?: string;
};

type RegistryResponse = {
  publishedActs?: RegistryAct[];
};

type CachedPlanningRow = {
  parcel_id: string;
  planning_json: PlanningContextResponse & { cacheVersion?: number };
  fetched_at: Date;
};

export async function getListingPlanningContext(
  listingId: string,
  force = false,
): Promise<PlanningContextResponse | null> {
  const parcelContext = await getListingParcelContext(listingId);
  if (!parcelContext) return null;
  if (parcelContext.status !== "available" || !parcelContext.parcel) {
    return {
      status: "missing_parcel",
      provider: "Rejestr Urbanistyczny",
      acts: [],
      message:
        parcelContext.status === "missing_location"
          ? "Do analizy planów potrzebna jest dokładna lokalizacja oferty."
          : "Nie udało się ustalić działki, więc nie można jeszcze dopasować planów.",
      registryUrl: REGISTRY_URL,
    };
  }

  const parcelId = parcelContext.parcel.id;
  const freshCache = await readCache(listingId, parcelId, false);
  if (!force && freshCache?.planning_json.cacheVersion === CACHE_VERSION)
    return mapCached(freshCache, false);

  const immediateSurroundingsPromise = getImmediateSurroundings(
    parcelContext.latitude!,
    parcelContext.longitude!,
  );
  try {
    const [acts, immediateSurroundings] = await Promise.all([
      fetchUrbanRegistryActs(parcelId),
      immediateSurroundingsPromise,
    ]);
    const checkedAt = new Date().toISOString();
    const response: PlanningContextResponse = {
      status: acts.length ? "available" : "not_found",
      provider: "Rejestr Urbanistyczny",
      parcelId,
      checkedAt,
      acts,
      message: acts.length
        ? undefined
        : "W publicznym Rejestrze Urbanistycznym nie znaleziono obecnie aktu przypisanego do tej działki.",
      registryUrl: REGISTRY_URL,
      immediateSurroundings,
    };
    if (immediateSurroundings.status === "available")
      await saveCache(listingId, parcelId, response);
    return response;
  } catch {
    const immediateSurroundings = await immediateSurroundingsPromise;
    const staleCache =
      freshCache?.planning_json.cacheVersion === CACHE_VERSION
        ? freshCache
        : await readCache(listingId, parcelId, true);
    if (staleCache?.planning_json.cacheVersion === CACHE_VERSION)
      return {
        ...mapCached(staleCache, true),
        immediateSurroundings:
          immediateSurroundings.status === "available"
            ? immediateSurroundings
            : staleCache.planning_json.immediateSurroundings,
      };
    return {
      status: "unavailable",
      provider: "Rejestr Urbanistyczny",
      parcelId,
      acts: [],
      message:
        "Rejestr Urbanistyczny lub jego usługa identyfikacji działek chwilowo nie odpowiada.",
      registryUrl: REGISTRY_URL,
      immediateSurroundings,
    };
  }
}

export function buildUrbanRegistryQuery(parcelIdentifier: string) {
  return {
    page: { number: 1, size: 30, sort: { sortBy: "publishDate", direction: "desc" } },
    criteria: {
      query: null,
      parcelIdentifier,
      statusList: null,
      publishDateFrom: null,
      publishDateTo: null,
      planValidFrom: null,
      planValidTo: null,
      publishedActVersions: "CURRENT",
      planTypeList: [
        "LOCAL_SPATIAL_DEVELOPMENT_PLAN",
        "MUNICIPAL_GENERAL_PLAN",
        "INTEGRATED_INVESTMENT_PLAN",
        "LOCAL_RECONSTRUCTION_PLAN",
        "LOCAL_REVITALIZATION_PLAN",
      ],
      plansGroup: "ALL",
      appTypeList: null,
      levelList: null,
    },
  };
}

export function mapUrbanRegistryAct(act: RegistryAct): PlanningActSummary | null {
  if (!Number.isFinite(act.publishedActId) || !act.planType || !act.title?.trim()) return null;
  const id = Number(act.publishedActId);
  return {
    id,
    title: act.title.trim(),
    planType: act.planType,
    planTypeLabel: act.planTypeDescription?.trim() || fallbackPlanTypeLabel(act.planType),
    status: act.spatialPlanningActStatus?.trim() || undefined,
    publishDate: act.publishDate || undefined,
    validFrom: act.validFrom || undefined,
    validTo: act.validTo || undefined,
    commune: act.commune?.trim() || undefined,
    district: act.district?.trim() || undefined,
    detailsUrl: `${REGISTRY_URL}/details/${registryRouteForPlan(act.planType)}/${id}`,
  };
}

async function fetchUrbanRegistryActs(parcelId: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const payload = await fetchExternalJson<RegistryResponse>(QUERY_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "mieszkania-local/0.1 (parcel planning analysis)",
        },
        body: JSON.stringify(buildUrbanRegistryQuery(parcelId)),
        timeoutMs: 18_000,
      });
      if (!Array.isArray(payload.publishedActs)) throw new Error("RU_INVALID_RESPONSE");
      return payload.publishedActs
        .map(mapUrbanRegistryAct)
        .filter((act): act is PlanningActSummary => Boolean(act));
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RU_UNAVAILABLE");
}

function registryRouteForPlan(planType: string) {
  if (planType === "MUNICIPAL_GENERAL_PLAN") return "pog";
  return "mpzp";
}

function fallbackPlanTypeLabel(planType: string) {
  const labels: Record<string, string> = {
    LOCAL_SPATIAL_DEVELOPMENT_PLAN: "Miejscowy plan zagospodarowania przestrzennego",
    MUNICIPAL_GENERAL_PLAN: "Plan ogólny gminy",
    INTEGRATED_INVESTMENT_PLAN: "Zintegrowany plan inwestycyjny",
    LOCAL_RECONSTRUCTION_PLAN: "Miejscowy plan odbudowy",
    LOCAL_REVITALIZATION_PLAN: "Miejscowy plan rewitalizacji",
  };
  return labels[planType] ?? planType;
}

async function readCache(listingId: string, parcelId: string, allowExpired: boolean) {
  return withDb(async (db) => {
    const result = await db.query<CachedPlanningRow>(
      `
      select parcel_id, planning_json, fetched_at
      from listing_planning_context
      where listing_id = $1
        and parcel_id = $2
        and ($3::boolean or fetched_at >= now() - make_interval(days => $4))
      limit 1
    `,
      [listingId, parcelId, allowExpired, CACHE_TTL_DAYS],
    );
    return result.rows[0] ?? null;
  });
}

async function saveCache(listingId: string, parcelId: string, response: PlanningContextResponse) {
  await withDb((db) =>
    db.query(
      `
    insert into listing_planning_context (listing_id, parcel_id, planning_json, fetched_at)
    values ($1,$2,$3,now())
    on conflict (listing_id) do update set
      parcel_id = excluded.parcel_id,
      planning_json = excluded.planning_json,
      fetched_at = now()
  `,
      [listingId, parcelId, JSON.stringify({ cacheVersion: CACHE_VERSION, ...response })],
    ),
  );
}

function mapCached(row: CachedPlanningRow, isStale: boolean): PlanningContextResponse {
  const { cacheVersion: _cacheVersion, ...planning } = row.planning_json;
  return {
    ...planning,
    parcelId: row.parcel_id,
    checkedAt: row.fetched_at.toISOString(),
    isStale,
  };
}
