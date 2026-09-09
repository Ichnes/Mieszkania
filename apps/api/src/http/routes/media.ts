import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import "../../config";
import { findMediaFilePathAsync, getListingImages } from "../../services/media/image-repository";
import { backfillListingMedia } from "../../services/media/media-downloader";
import { getMapThumbnail, getRemoteMapThumbnail } from "../../services/media/map-thumbnail";

export function registerMediaRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/listings/:id/map-thumbnail", async (request, reply) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id))
      return reply.code(400).send({ message: "Invalid listing id" });
    const images = await getListingImages(request.params.id);
    const primary = images.find((image) => image.isPrimary) ?? images[0];
    if (!primary) return reply.code(404).send({ message: "Image not found" });
    try {
      const bytes = primary.localFilePath
        ? await getMapThumbnail(primary.localFilePath)
        : await getRemoteMapThumbnail(primary.sourceUrl);
      return reply
        .header("Content-Type", "image/webp")
        .header("Cache-Control", "private, max-age=3600")
        .header("X-Content-Type-Options", "nosniff")
        .send(bytes);
    } catch {
      // Some portals accept browser image requests but reject server-side downloads.
      if (/^https?:\/\//i.test(primary.sourceUrl)) return reply.redirect(primary.sourceUrl);
      return reply.code(404).send({ message: "Image unavailable" });
    }
  });
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

  app.get<{ Params: { storageKey: string }; Querystring: { variant?: string } }>(
    "/api/media/:storageKey",
    async (request, reply) => {
      // Fastify has decoded route parameters already. Never decode a second time.
      const filePath = await findMediaFilePathAsync(request.params.storageKey);

      if (!filePath) {
        reply.code(404);
        return { message: "Media not found" };
      }

      const thumbnail = request.query.variant === "map";
      const bytes = thumbnail ? await getMapThumbnail(filePath) : await readFile(filePath);
      reply.header("Content-Type", thumbnail ? "image/webp" : getMimeType(filePath));
      reply.header("Cache-Control", "private, max-age=3600");
      reply.header("X-Content-Type-Options", "nosniff");
      return reply.send(bytes);
    },
  );
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
