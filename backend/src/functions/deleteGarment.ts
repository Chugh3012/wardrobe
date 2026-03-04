import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { readGarment, deleteGarment as deleteGarmentFromDb } from "../services/garmentService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackEvent, trackException } from "../services/telemetryService.js";

/** Maximum length for ID fields. */
const MAX_ID_LENGTH = 256;

/**
 * DELETE /api/garments/{id}
 *
 * Deletes a garment from the authenticated user's catalog.
 *
 * Returns 204 on success.
 * Returns 400 for validation errors.
 * Returns 401 when REQUIRE_AUTH is enabled and no auth header is present.
 * Returns 404 if the garment is not found or belongs to another user.
 */
export async function deleteGarmentHandler(
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
  // Character-set validation (defense-in-depth)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return {
      status: 400,
      jsonBody: { error: "Invalid 'id' format." },
    };
  }

  try {
    // ── Verify the garment exists and belongs to the user ──────────────────
    const garment = await readGarment(id, userId);
    if (!garment) {
      return {
        status: 404,
        jsonBody: { error: "Garment not found." },
      };
    }

    // ── Delete the garment ────────────────────────────────────────────────
    await deleteGarmentFromDb(id, userId);

    context.log(`Deleted garment ${id} for user ${userId}`);

    trackEvent(
      "GarmentDeleted",
      { userId, garmentId: id },
    );

    return { status: 204 };
  } catch (err: unknown) {
    context.log(`Error deleting garment: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "DELETE /garments", userId: userId ?? "unknown" },
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to delete garment." },
    };
  }
}

app.http("deleteGarment", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "garments/{id}",
  handler: deleteGarmentHandler,
});
