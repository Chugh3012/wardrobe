import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { readWearEvent, deleteWearEvent as deleteWearEventFromDb } from "../services/wearEventService.js";
import { decrementWearCount } from "../services/garmentService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackEvent, trackException } from "../services/telemetryService.js";

/** Maximum length for ID fields. */
const MAX_ID_LENGTH = 256;

/**
 * DELETE /api/wear/events/{id}
 *
 * Deletes a wear event (outfit) from the authenticated user's history and
 * decrements the associated garment's wearCount.
 *
 * Returns 204 on success.
 * Returns 400 for validation errors.
 * Returns 401 when REQUIRE_AUTH is enabled and no auth header is present.
 * Returns 404 if the WearEvent is not found or belongs to another user.
 */
export async function deleteWearEventHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // ── Validate path parameter ───────────────────────────────────────────────
  const id = request.params.id ?? "";

  if (!id) {
    return {
      status: 400,
      jsonBody: { error: "'id' path parameter is required." },
    };
  }
  if (id.length > MAX_ID_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'id' must be at most ${MAX_ID_LENGTH} characters.` },
    };
  }
  // L14: Character-set validation (defense-in-depth)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return {
      status: 400,
      jsonBody: { error: "Invalid 'id' format." },
    };
  }

  try {
    // ── Verify the wear event exists and belongs to the user ────────────────
    const wearEvent = await readWearEvent(id, userId);
    if (!wearEvent) {
      return {
        status: 404,
        jsonBody: { error: "Wear event not found." },
      };
    }

    // ── Delete the wear event ───────────────────────────────────────────────
    await deleteWearEventFromDb(id, userId);

    // ── Decrement wear count on the associated garment ──────────────────────
    try {
      await decrementWearCount(wearEvent.garmentId, userId);
    } catch (err) {
      // Log but don't fail the request — the wear event is already deleted
      context.log(`Warning: failed to decrement wearCount for garment ${wearEvent.garmentId}: ${err}`);
    }

    context.log(`Deleted wear event ${id} for user ${userId}`);

    trackEvent(
      "WearEventDeleted",
      { userId, wearEventId: id, garmentId: wearEvent.garmentId },
    );

    return { status: 204 };
  } catch (err) {
    context.log(`Error deleting wear event: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "DELETE /wear/events", userId: userId ?? "unknown" },
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to delete wear event. Check server logs." },
    };
  }
}

app.http("deleteWearEvent", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "wear/events/{id}",
  handler: deleteWearEventHandler,
});
