import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listWearEventsPaginated } from "../services/wearEventService.js";
import { listGarments } from "../services/garmentService.js";
import { generateReadSasUrls } from "../services/blobSasService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackException } from "../services/telemetryService.js";

/**
 * GET /api/wear/history
 *
 * Returns a paginated chronological feed of wear events for the authenticated
 * user, enriched with garment name and category. Used by the History page.
 *
 * Query parameters:
 *   pageSize          — Number of items per page (default 20, max 50).
 *   continuationToken — Opaque token for the next page.
 *
 * Response shape:
 * {
 *   events: [
 *     { id, garmentId, garmentName, category, outfitImageUrl, confidence, createdAt }
 *   ],
 *   continuationToken?: string
 * }
 */
export async function getWearHistory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  const pageSizeParam = request.query.get("pageSize");
  const continuationToken = request.query.get("continuationToken") || undefined;
  if (continuationToken && continuationToken.length > 8192) {
    return {
      status: 400,
      jsonBody: { error: "'continuationToken' is too long." },
    };
  }
  const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : undefined;

  if (pageSizeParam !== null && (isNaN(pageSize!) || pageSize! < 1)) {
    return {
      status: 400,
      jsonBody: { error: "'pageSize' must be a positive integer." },
    };
  }

  try {
    const [{ events, continuationToken: nextToken }, garments] = await Promise.all([
      listWearEventsPaginated(userId, pageSize, continuationToken),
      listGarments(userId),
    ]);

    const garmentMap = new Map(garments.map((g) => [g.id, g]));

    // M8: Generate fresh SAS URLs for outfit images (stored URLs expire after 1 hour)
    const rawOutfitUrls = events.map((e) => e.outfitImageUrl || null);
    const freshOutfitUrls = await generateReadSasUrls(rawOutfitUrls);

    const enrichedEvents = events.map((e, i) => {
      const garment = garmentMap.get(e.garmentId);
      return {
        id: e.id,
        garmentId: e.garmentId,
        garmentName: garment?.name ?? "Unknown",
        category: garment?.category ?? "other",
        outfitImageUrl: freshOutfitUrls[i] ?? e.outfitImageUrl,
        confidence: e.confidence,
        createdAt: e.createdAt,
      };
    });

    context.log(`Wear history for user ${userId}: ${enrichedEvents.length} event(s)`);

    return {
      status: 200,
      jsonBody: {
        events: enrichedEvents,
        ...(nextToken ? { continuationToken: nextToken } : {}),
      },
    };
  } catch (err: unknown) {
    context.log(`Error in wear/history: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "GET /wear/history", userId: userId ?? "unknown" }
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to retrieve wear history." },
    };
  }
}

app.http("getWearHistory", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "wear/history",
  handler: getWearHistory,
});
