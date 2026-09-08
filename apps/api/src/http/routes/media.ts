import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import "../../config";
import { findMediaFilePathAsync } from "../../services/media/image-repository";
import { backfillListingMedia } from "../../services/media/media-downloader";

export function registerMediaRoutes(app: FastifyInstance) {
  app.post<{ Body: { listingId?: string; limit?: number } }>(
    "/api/media/backfill",
    async (request) => {
      const body = (request.body ?? {}) as { listingId?: string; limit?: number };
      return backfillListingMedia({
        listingId: body.listingId,
        limit: body.limit,
      });
    },
  );

  app.post<{ Params: { id: string } }>("/api/listings/:id/media/backfill", async (request) => {
    return backfillListingMedia({
      listingId: request.params.id,
      limit: 500,
    });
  });

  app.get<{ Params: { storageKey: string } }>("/api/media/:storageKey", async (request, reply) => {
    // Fastify has decoded route parameters already. Never decode a second time.
    const filePath = await findMediaFilePathAsync(request.params.storageKey);

    if (!filePath) {
      reply.code(404);
      return { message: "Media not found" };
    }

    const bytes = await readFile(filePath);
    reply.header("Content-Type", getMimeType(filePath));
    reply.header("Cache-Control", "private, max-age=3600");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(bytes);
  });
}

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") return "image/gif";
  if (extension === ".avif") return "image/avif";

  return "application/octet-stream";
}
