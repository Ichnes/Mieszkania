import {
  type ListingFilters,
  type ListingViewingStatus,
  type RecentOffersResponse,
} from "@mieszkania/shared";
import type { FastifyInstance } from "fastify";
import "../../config";
import { getListingParcelContext } from "../../services/insights/listing-parcel-context";
import { getListingPlanningContext } from "../../services/insights/listing-planning-context";
import { scanRelistedListings } from "../../services/listings/listing-relistings";
import {
  addListingContactEvent,
  archiveListingRecord,
  deleteListingRecord,
  dismissListingRecord,
  getListingDetail,
  getListingInsights,
  getListingsPage,
  getMapListings,
  getRecentCollectedListings,
  updateListingManualData,
  updateListingShortlist,
} from "../../services/listings/listing-repository";
import {
  deleteListingViewing,
  upsertListingViewing,
} from "../../services/listings/listing-viewings";

export function registerListingsRoutes(app: FastifyInstance) {
  app.get("/api/listings", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return getListingsPage(parseListingFilters(query));
  });

  app.get("/api/listings/map", async () => getMapListings());

  app.get("/api/listings/recent", async () => buildRecentOffersResponse());

  app.get<{ Params: { id: string } }>("/api/listings/:id", async (request, reply) => {
    const listing = await getListingDetail(request.params.id);

    if (!listing) {
      reply.code(404);
      return {
        message: "Listing not found",
      };
    }

    return listing;
  });

  app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>(
    "/api/listings/:id/parcel",
    async (request, reply) => {
      try {
        const context = await getListingParcelContext(
          request.params.id,
          request.query.refresh === "true",
        );
        if (!context) {
          reply.code(404);
          return { message: "Listing not found" };
        }
        return context;
      } catch (error) {
        app.log.warn(error, "ULDK parcel lookup failed");
        reply.code(502);
        return { message: "Nie udalo sie pobrac danych dzialki z ULDK." };
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>(
    "/api/listings/:id/planning",
    async (request, reply) => {
      try {
        const context = await getListingPlanningContext(
          request.params.id,
          request.query.refresh === "true",
        );
        if (!context) {
          reply.code(404);
          return { message: "Listing not found" };
        }
        return context;
      } catch (error) {
        app.log.warn(error, "Urban registry lookup failed");
        reply.code(502);
        return { message: "Nie udało się pobrać danych z Rejestru Urbanistycznego." };
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/api/listings/:id", async (request) =>
    deleteListingRecord(request.params.id),
  );

  app.post<{ Params: { id: string } }>("/api/listings/:id/dismiss", async (request) =>
    dismissListingRecord(request.params.id),
  );

  app.post<{ Params: { id: string } }>("/api/listings/:id/archive", async (request) =>
    archiveListingRecord(request.params.id),
  );

  app.get<{ Params: { id: string }; Querystring: { refresh?: string } }>(
    "/api/listings/:id/insights",
    async (request, reply) => {
      let insights: Awaited<ReturnType<typeof getListingInsights>>;
      try {
        insights = await getListingInsights(request.params.id, request.query.refresh === "true");
      } catch (error) {
        app.log.warn(error, "Listing insights failed");
        return {
          commutes: [],
          amenities: [],
          amenityAnalysis: {
            status: "unavailable",
            source: "OpenStreetMap",
            radiusMeters: 2000,
            plannedFacilities: [],
          },
        };
      }

      if (!insights) {
        reply.code(404);
        return {
          message: "Listing not found",
        };
      }

      return insights;
    },
  );

  app.post<{ Params: { id: string }; Body: { shortlisted?: boolean } }>(
    "/api/listings/:id/shortlist",
    async (request, reply) => {
      if (typeof request.body?.shortlisted !== "boolean") {
        reply.code(400);
        return { message: "Missing shortlisted boolean" };
      }

      const shortlisted = await updateListingShortlist(request.params.id, request.body.shortlisted);

      if (shortlisted === null) {
        reply.code(404);
        return { message: "Listing not found" };
      }

      return { id: request.params.id, shortlisted };
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      contactStatus?:
        | "new"
        | "contacted"
        | "negotiating"
        | "viewing_scheduled"
        | "rejected"
        | "closed";
      decisionStage?:
        | "new"
        | "to_call"
        | "after_call"
        | "to_viewing"
        | "after_viewing"
        | "to_offer"
        | "rejected"
        | "bought";
      contactName?: string;
      contactPhone?: string;
      contactRole?: string;
      negotiatedPriceAmount?: number;
      askingPriceOverride?: number;
      notes?: string;
      sourceNotes?: string;
      lastContactAt?: string;
    };
  }>("/api/listings/:id/manual", async (request, reply) => {
    const price = request.body?.askingPriceOverride;
    if (
      price !== undefined &&
      (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 1e11)
    ) {
      return reply.code(400).send({ message: "Cena po rozmowie musi być dodatnią kwotą." });
    }
    const listing = await updateListingManualData(request.params.id, request.body ?? {});

    if (!listing) {
      reply.code(404);
      return { message: "Listing not found" };
    }

    return listing;
  });

  app.post<{
    Params: { id: string };
    Body: {
      eventType?:
        | "call"
        | "message"
        | "email"
        | "meeting"
        | "viewing_note"
        | "negotiation"
        | "status_change"
        | "other";
      occurredAt?: string;
      title?: string;
      notes?: string;
      contactName?: string;
      amount?: number;
    };
  }>("/api/listings/:id/contact-events", async (request, reply) => {
    if (!request.body?.eventType || !request.body?.occurredAt) {
      reply.code(400);
      return { message: "Missing eventType or occurredAt" };
    }

    const listing = await addListingContactEvent(request.params.id, request.body);

    if (!listing) {
      reply.code(404);
      return { message: "Listing not found or invalid event payload" };
    }

    return listing;
  });

  app.post<{ Body: { limit?: number } }>("/api/listings/relistings/scan", async (request) => {
    return scanRelistedListings(request.body?.limit);
  });

  app.post<{
    Params: { id: string };
    Body: { scheduledAt?: string; status?: ListingViewingStatus; notes?: string };
  }>("/api/listings/:id/viewing", async (request, reply) => {
    if (!request.body?.scheduledAt) {
      reply.code(400);
      return { message: "Missing scheduledAt" };
    }

    return upsertListingViewing({
      listingId: request.params.id,
      scheduledAt: request.body.scheduledAt,
      status: request.body.status,
      notes: request.body.notes,
    });
  });

  app.delete<{ Params: { id: string } }>("/api/listings/:id/viewing", async (request, reply) => {
    const deleted = await deleteListingViewing(request.params.id);

    if (!deleted) {
      reply.code(404);
      return { message: "Viewing not found" };
    }

    return { deleted: true };
  });
}

const buildRecentOffersResponse = async (): Promise<RecentOffersResponse> => {
  const items = await getRecentCollectedListings();

  return {
    total: items.length,
    items,
  };
};

function parseListingFilters(query: Record<string, string | undefined>): ListingFilters {
  return {
    city: query.city || undefined,
    district: query.district || undefined,
    districts: query.districts
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    minPrice: toNumber(query.minPrice),
    maxPrice: toNumber(query.maxPrice),
    minArea: toNumber(query.minArea),
    maxArea: toNumber(query.maxArea),
    minYearBuilt: toNumber(query.minYearBuilt),
    maxYearBuilt: toNumber(query.maxYearBuilt),
    minPricePerSqm: toNumber(query.minPricePerSqm),
    maxPricePerSqm: toNumber(query.maxPricePerSqm),
    roomsMin: toNumber(query.roomsMin),
    roomsMax: toNumber(query.roomsMax),
    search: query.search || undefined,
    shortlistedOnly: query.shortlistedOnly === "true",
    priceChangedOnly: query.priceChangedOnly === "true",
    archivedOnly: query.archivedOnly === "true",
    hiddenOnly: query.hiddenOnly === "true",
    includeAllCities: query.includeAllCities === "true",
    page: toPositiveInteger(query.page),
    pageSize: toPositiveInteger(query.pageSize),
    sort: toListingSort(query.sort),
  };
}

function toNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function toPositiveInteger(value?: string) {
  const numeric = toNumber(value);
  if (numeric === undefined) {
    return undefined;
  }

  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

function toListingSort(value?: string): ListingFilters["sort"] {
  const allowed: NonNullable<ListingFilters["sort"]>[] = [
    "newest",
    "oldest",
    "price_desc",
    "price_asc",
    "price_per_sqm_desc",
    "price_per_sqm_asc",
    "area_desc",
    "area_asc",
    "dream_desc",
  ];
  return allowed.includes(value as NonNullable<ListingFilters["sort"]>)
    ? (value as NonNullable<ListingFilters["sort"]>)
    : undefined;
}
