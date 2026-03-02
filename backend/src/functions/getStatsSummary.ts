import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listGarments } from "../services/garmentService.js";
import { listWearEvents } from "../services/wearEventService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";

/**
 * GET /api/stats/summary?userId=<string>
 *
 * Returns aggregated wear statistics for the authenticated user's wardrobe.
 * Prefers the `x-ms-client-principal-id` header (Issue #13); falls back
 * to the `userId` query parameter for backward compatibility.
 *
 * Response shape:
 * {
 *   totalGarments: number,
 *   totalWearEvents: number,
 *   garments: [
 *     { garmentId, name, category, wearCount, lastWornDate }
 *   ],
 *   mostWorn: [ { garmentId, name, wearCount } ],
 *   leastWorn: [ { garmentId, name, wearCount } ]
 * }
 *
 * Returns HTTP 200 with the summary object.
 * Returns HTTP 400 if userId is missing.
 * Returns HTTP 401 when REQUIRE_AUTH is enabled and no auth header is present.
 */
export async function getStatsSummary(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  try {
    const [garments, wearEvents] = await Promise.all([
      listGarments(userId),
      listWearEvents(userId),
    ]);

    // Build a map of garmentId → last worn date from wear events
    const lastWornMap = new Map<string, string>();
    for (const evt of wearEvents) {
      const existing = lastWornMap.get(evt.garmentId);
      if (!existing || evt.createdAt > existing) {
        lastWornMap.set(evt.garmentId, evt.createdAt);
      }
    }

    // Build per-garment summary
    const garmentStats = garments.map((g) => ({
      garmentId: g.id,
      name: g.name,
      category: g.category,
      wearCount: g.wearCount,
      lastWornDate: lastWornMap.get(g.id) ?? null,
    }));

    // Determine most-worn and least-worn
    let mostWorn: Array<{ garmentId: string; name: string; wearCount: number }> = [];
    let leastWorn: Array<{ garmentId: string; name: string; wearCount: number }> = [];

    if (garments.length > 0) {
      const maxCount = Math.max(...garments.map((g) => g.wearCount));
      const minCount = Math.min(...garments.map((g) => g.wearCount));

      mostWorn = garments
        .filter((g) => g.wearCount === maxCount)
        .map((g) => ({ garmentId: g.id, name: g.name, wearCount: g.wearCount }));

      leastWorn = garments
        .filter((g) => g.wearCount === minCount)
        .map((g) => ({ garmentId: g.id, name: g.name, wearCount: g.wearCount }));
    }

    context.log(`Stats summary for user ${userId}: ${garments.length} garments, ${wearEvents.length} wear events`);

    return {
      status: 200,
      jsonBody: {
        totalGarments: garments.length,
        totalWearEvents: wearEvents.length,
        garments: garmentStats,
        mostWorn,
        leastWorn,
      },
    };
  } catch (err) {
    context.log(`Error in stats/summary: ${err}`);
    return {
      status: 500,
      jsonBody: { error: "Failed to retrieve stats summary. Check server logs." },
    };
  }
}

app.http("getStatsSummary", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stats/summary",
  handler: getStatsSummary,
});
