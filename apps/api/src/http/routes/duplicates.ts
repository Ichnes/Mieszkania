import type { FastifyInstance } from "fastify";
import "../../config";
import {
  confirmDuplicateGroup,
  dissolveDuplicateGroup,
  DuplicateAreaConflict,
  getDuplicateCandidates,
  getDuplicateGroupOverviews,
  reviewDuplicateCandidate,
  runAutomaticDuplicateMergeByDescription,
  unmergeDuplicateListing,
} from "../../services/duplicates/listing-duplicates";

export function registerDuplicatesRoutes(app: FastifyInstance) {
  app.get("/api/duplicates/candidates", async (request) => {
    const query = request.query as {
      limit?: string;
      listingId?: string;
      minConfidence?: string;
      maxConfidence?: string;
      sort?: string;
      offset?: string;
    };
    const numeric = (value: string | undefined, fallback: number) =>
      Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
    return getDuplicateCandidates(
      query.limit ? Number(query.limit) : undefined,
      query.listingId || undefined,
      {
        minConfidence: numeric(query.minConfidence, 60),
        maxConfidence: numeric(query.maxConfidence, 100),
        sort: query.sort,
        offset: numeric(query.offset, 0),
      },
    );
  });

  app.get("/api/duplicates/groups", async (request) => {
    const query = request.query as {
      limit?: string;
      summary?: string;
      sort?: string;
      page?: string;
      search?: string;
      source?: string;
      onlyConflicts?: string;
    };
    const result = await getDuplicateGroupOverviews(Number(query.limit ?? 200), {
      page: Number(query.page ?? 1),
      sort: query.sort,
      search: query.search,
      source: query.source,
      onlyConflicts: query.onlyConflicts === "true",
    });
    return query.summary === "true" ? result : result.items;
  });

  app.post<{ Body: { primaryListingId?: string; duplicateListingId?: string } }>(
    "/api/duplicates/unmerge",
    async (request, reply) => {
      if (!request.body?.primaryListingId || !request.body?.duplicateListingId)
        return reply.code(400).send({ message: "Missing duplicate group members" });
      return unmergeDuplicateListing(
        request.body.primaryListingId,
        request.body.duplicateListingId,
      );
    },
  );

  app.post<{ Body: { groupId: string; memberIds: string[] } }>(
    "/api/duplicates/dissolve",
    {
      schema: {
        body: {
          type: "object",
          required: ["groupId", "memberIds"],
          properties: {
            groupId: { type: "string", format: "uuid" },
            memberIds: {
              type: "array",
              minItems: 2,
              uniqueItems: true,
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const ok = await dissolveDuplicateGroup(request.body.groupId, request.body.memberIds);
      return ok
        ? { dissolved: true }
        : reply
            .code(409)
            .send({ message: "Skład grupy zmienił się. Odśwież listę przed rozłączeniem." });
    },
  );
  app.post<{ Body: { primaryListingId?: string } }>(
    "/api/duplicates/confirm",
    async (request, reply) => {
      if (!request.body?.primaryListingId)
        return reply.code(400).send({ message: "Missing primary listing" });
      return confirmDuplicateGroup(request.body.primaryListingId);
    },
  );

  app.post<{ Body: { limit?: number } }>("/api/duplicates/auto-merge", async (request) => {
    return runAutomaticDuplicateMergeByDescription(request.body?.limit);
  });

  app.post<{
    Body: {
      leftId?: string;
      rightId?: string;
      primaryListingId?: string;
      status?: "same_listing" | "different_listing";
      notes?: string;
      confirmArchiveAreaDifference?: boolean;
    };
  }>("/api/duplicates/review", async (request, reply) => {
    if (!request.body?.leftId || !request.body?.rightId || !request.body?.status) {
      reply.code(400);
      return { message: "Missing duplicate review payload" };
    }

    try {
      return await reviewDuplicateCandidate({
        ...request.body,
        leftId: request.body.leftId,
        rightId: request.body.rightId,
        status: request.body.status,
      });
    } catch (error) {
      if (error instanceof DuplicateAreaConflict) {
        return reply.code(409).send({
          message: error.message,
          canConfirmArchiveAreaDifference: error.canConfirmArchive,
        });
      }
      throw error;
    }
  });
}
