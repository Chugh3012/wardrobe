import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listGarmentsPaginated } from "../services/garmentService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackException } from "../services/telemetryService.js";

/**
 * GET /api/garments
 *
 * Returns a paginated list of garments for the authenticated user (F3).
 * Uses the `x-ms-client-principal` header (Issue #13) for authentication.
 *
 * Query parameters:
 *   pageSize          — Number of items per page (default 20, max 100).
 *   continuationToken — Opaque token for the next page (from a previous response).
 *
 * Response includes: id, name, category, wearCount, and a thumbnail URL
 * (first entry of catalogImageUrls).
 *
 * Returns HTTP 200 with an array (empty array if user has no garments).
 * Returns HTTP 401 when no valid auth header is present.
 */
export async function getGarments(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // ── Parse pagination query params (F3) ─────────────────────────────────
  const pageSizeParam = request.query.get("pageSize");
  const continuationToken = request.query.get("continuationToken") || undefined;
  const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : undefined;

  if (pageSizeParam !== null && (isNaN(pageSize!) || pageSize! < 1)) {
    return {
      status: 400,
      jsonBody: { error: "'pageSize' must be a positive integer." },
    };
  }

  try {
    const { garments, continuationToken: nextToken } = await listGarmentsPaginated(
      userId,
      pageSize,
      continuationToken,
    );

    const items = garments.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      wearCount: g.wearCount,
      thumbnailUrl: g.catalogImageUrls.length > 0 ? g.catalogImageUrls[0] : null,
    }));

    context.log(`Listed ${items.length} garment(s) for user ${userId}`);

    return {
      status: 200,
      jsonBody: {
        garments: items,
        ...(nextToken ? { continuationToken: nextToken } : {}),
      },
    };
  } catch (err) {
    context.log(`Error listing garments: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "GET /garments", userId: userId ?? "unknown" }
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to list garments. Check server logs." },
    };
  }
}

app.http("getGarments", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "garments",
  handler: getGarments,
});
