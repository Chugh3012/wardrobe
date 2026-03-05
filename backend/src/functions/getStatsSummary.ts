import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listGarments } from "../services/garmentService.js";
import { getWearEventAggregations, getWearDates } from "../services/wearEventService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackException } from "../services/telemetryService.js";

/**
 * GET /api/stats/summary
 *
 * Returns aggregated wear statistics for the authenticated user's wardrobe.
 * Uses the `x-ms-client-principal` header (Issue #13) for authentication.
 *
 * F4: Uses a Cosmos DB GROUP BY aggregation query to compute per-garment
 * wear statistics server-side rather than fetching every individual wear event.
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
 * Returns HTTP 401 when no valid auth header is present.
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
    // Fetch calendar data for the past 90 days alongside garments and aggregations
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString();

    const [garments, wearAggregations, wearDates] = await Promise.all([
      listGarments(userId),
      getWearEventAggregations(userId),
      getWearDates(userId, sinceDate),
    ]);

    // Build a map of garmentId → { lastWornDate, eventCount } from aggregations (F4)
    const aggMap = new Map<string, { lastWornDate: string; eventCount: number }>();
    let totalWearEvents = 0;
    for (const agg of wearAggregations) {
      aggMap.set(agg.garmentId, {
        lastWornDate: agg.lastWornDate,
        eventCount: agg.eventCount,
      });
      totalWearEvents += agg.eventCount;
    }

    // Build per-garment summary
    const garmentStats = garments.map((g) => ({
      garmentId: g.id,
      name: g.name,
      category: g.category,
      wearCount: g.wearCount,
      lastWornDate: aggMap.get(g.id)?.lastWornDate ?? null,
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

    // Compute forgotten garments — items not worn in 30+ days
    const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const forgotten = garments
      .filter((g) => {
        const lastWorn = aggMap.get(g.id)?.lastWornDate;
        if (!lastWorn) return true; // never worn
        return new Date(lastWorn).getTime() < thirtyDaysAgoMs;
      })
      .map((g) => ({
        garmentId: g.id,
        name: g.name,
        category: g.category,
        lastWornDate: aggMap.get(g.id)?.lastWornDate ?? null,
        daysSinceWorn: aggMap.get(g.id)?.lastWornDate
          ? Math.floor((now.getTime() - new Date(aggMap.get(g.id)!.lastWornDate).getTime()) / (24 * 60 * 60 * 1000))
          : null,
      }));

    // Compute wear streaks from calendar data
    const dateSet = new Set(wearDates.map((d) => d.date));
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    let currentStreakDone = false;
    // Walk backwards from today
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      if (dateSet.has(dateStr)) {
        streak++;
        if (streak > longestStreak) longestStreak = streak;
        if (!currentStreakDone) {
          currentStreak = streak;
        }
      } else {
        if (!currentStreakDone) currentStreakDone = true;
        streak = 0;
      }
    }

    context.log(`Stats summary for user ${userId}: ${garments.length} garments, ${totalWearEvents} wear events`);

    return {
      status: 200,
      jsonBody: {
        totalGarments: garments.length,
        totalWearEvents,
        garments: garmentStats,
        mostWorn,
        leastWorn,
        forgotten,
        streaks: {
          current: currentStreak,
          longest: longestStreak,
        },
        calendar: wearDates,
      },
    };
  } catch (err: unknown) {
    context.log(`Error in stats/summary: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "GET /stats/summary", userId: userId ?? "unknown" }
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to retrieve stats summary." },
    };
  }
}

app.http("getStatsSummary", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stats/summary",
  handler: getStatsSummary,
});
