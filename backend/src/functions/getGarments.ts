import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listGarments } from "../services/garmentService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";

/**
 * GET /api/garments?userId=<string>
 *
 * Returns a list of garments for the authenticated user.
 * Prefers the `x-ms-client-principal-id` header (Issue #13); falls back
 * to the `userId` query parameter for backward compatibility.
 *
 * Response includes: id, name, category, wearCount, and a thumbnail URL
 * (first entry of catalogImageUrls).
 *
 * Returns HTTP 200 with an array (empty array if user has no garments).
 * Returns HTTP 400 if userId is missing.
 * Returns HTTP 401 when REQUIRE_AUTH is enabled and no auth header is present.
 */
export async function getGarments(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  try {
    const garments = await listGarments(userId);

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
      jsonBody: { garments: items },
    };
  } catch (err) {
    context.log(`Error listing garments: ${err}`);
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
