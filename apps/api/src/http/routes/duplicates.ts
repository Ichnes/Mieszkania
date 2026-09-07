import type { FastifyInstance } from "fastify";
import "../../config";
import {
  confirmDuplicateGroup,
  getDuplicateCandidates,
  getDuplicateGroupOverviews,
  reviewDuplicateCandidate,
  runAutomaticDuplicateMergeByDescription,
  unmergeDuplicateListing,
} from "../../services/duplicates/listing-duplicates";

export function registerDuplicatesRoutes(app: FastifyInstance) {
  app.get("/api/duplicates/candidates", async (request) => {
    const query = request.query as { limit?: string; listingId?: string };
    return getDuplicateCandidates(
      query.limit ? Number(query.limit) : undefined,
      query.listingId || undefined,
    );
  });

  app.get("/api/duplicates/groups", async (request) => {
    const query = request.query as { limit?: string; summary?: string };
    const limit = Number(query.limit ?? 200);
    return query.summary === "true"
      ? getDuplicateGroupOverviews(limit, true)
      : getDuplicateGroupOverviews(limit);
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
    };
  }>("/api/duplicates/review", async (request, reply) => {
    if (!request.body?.leftId || !request.body?.rightId || !request.body?.status) {
      reply.code(400);
      return { message: "Missing duplicate review payload" };
    }

    return reviewDuplicateCandidate({
      leftId: request.body.leftId,
      rightId: request.body.rightId,
      primaryListingId: request.body.primaryListingId,
      status: request.body.status,
      notes: request.body.notes,
    });
  });
}
