import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { readPredictionAudit, updatePredictionAudit } from "../services/predictionAuditService.js";
import { incrementWearCount, readGarment } from "../services/garmentService.js";
import { createWearEvent } from "../services/wearEventService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { trackEvent, trackMetric, trackException } from "../services/telemetryService.js";

interface PostWearConfirmBody {
  predictionAuditId?: unknown;
  confirmedGarmentId?: unknown;
  confirmed?: unknown;
}

/** Maximum length for ID fields. */
const MAX_ID_LENGTH = 256;

/**
 * POST /api/wear/confirm
 *
 * Records the user's confirmation or correction of a prediction.
 *
 * Body (JSON):
 * {
 *   "predictionAuditId": "string",   // the PredictionAudit to confirm/correct
 *   "confirmedGarmentId": "string",  // the garment the user confirms they wore
 *   "confirmed": boolean             // true = prediction was correct, false = corrected
 * }
 *
 * If confirmed = true: a WearEvent is created and Garment.wearCount is incremented.
 * If confirmed = false: PredictionAudit.userFinalSelection is updated with the corrected
 *   garmentId; a WearEvent is still created for the corrected garment and wearCount is incremented.
 *
 * Returns 200 with the created WearEvent.
 * Returns 400 for validation errors.
 * Returns 401 when REQUIRE_AUTH is enabled and no auth header is present.
 * Returns 404 if the PredictionAudit is not found.
 */
export async function postWearConfirm(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // ── Parse JSON body ───────────────────────────────────────────────────────
  let body: PostWearConfirmBody;
  try {
    body = (await request.json()) as PostWearConfirmBody;
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body." },
    };
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // ── Validate required fields ──────────────────────────────────────────────
  const predictionAuditId =
    typeof body.predictionAuditId === "string" ? body.predictionAuditId.trim() : "";
  const confirmedGarmentId =
    typeof body.confirmedGarmentId === "string" ? body.confirmedGarmentId.trim() : "";

  if (!predictionAuditId) {
    return {
      status: 400,
      jsonBody: { error: "'predictionAuditId' is required." },
    };
  }
  if (predictionAuditId.length > MAX_ID_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'predictionAuditId' must be at most ${MAX_ID_LENGTH} characters.` },
    };
  }
  if (!confirmedGarmentId) {
    return {
      status: 400,
      jsonBody: { error: "'confirmedGarmentId' is required." },
    };
  }
  if (confirmedGarmentId.length > MAX_ID_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'confirmedGarmentId' must be at most ${MAX_ID_LENGTH} characters.` },
    };
  }
  if (typeof body.confirmed !== "boolean") {
    return {
      status: 400,
      jsonBody: { error: "'confirmed' must be a boolean." },
    };
  }
  const confirmed: boolean = body.confirmed;

  // ── Look up the PredictionAudit ───────────────────────────────────────────
  try {
    const audit = await readPredictionAudit(predictionAuditId, userId);
    if (!audit) {
      return {
        status: 404,
        jsonBody: { error: "PredictionAudit not found." },
      };
    }

    // ── Verify garment ownership (IDOR prevention) ─────────────────────────
    const garment = await readGarment(confirmedGarmentId, userId);
    if (!garment) {
      return {
        status: 404,
        jsonBody: { error: "Garment not found." },
      };
    }

    // Determine the predicted garment (top prediction)
    const predictedGarmentId =
      audit.topKPredictions.length > 0 ? audit.topKPredictions[0].garmentId : "";
    const confidence =
      audit.topKPredictions.length > 0 ? audit.topKPredictions[0].confidence : 0;

    // ── If correction, update userFinalSelection on the audit ──────────────
    if (!confirmed) {
      await updatePredictionAudit(predictionAuditId, userId, confirmedGarmentId);
    }

    // ── Create WearEvent ──────────────────────────────────────────────────
    const wearEvent = await createWearEvent({
      userId,
      garmentId: confirmedGarmentId,
      outfitImageUrl: audit.inputImageUrl,
      predictedGarmentId,
      confidence,
      confirmed,
    });

    // ── Increment wear count on the confirmed garment ─────────────────────
    await incrementWearCount(confirmedGarmentId, userId);

    context.log(
      `Wear confirmed for user ${userId}, garment ${confirmedGarmentId}, audit ${predictionAuditId}`
    );

    // ── Custom telemetry (Issue #14) ──────────────────────────────────────
    trackEvent(
      "WearConfirmed",
      { userId, garmentId: confirmedGarmentId, confirmed: String(confirmed) },
      { confidence }
    );
    trackMetric("WearConfirmationRate", confirmed ? 1 : 0);
    if (!confirmed) {
      trackEvent(
        "PredictionCorrected",
        { userId, auditId: predictionAuditId, predictedGarmentId, correctedGarmentId: confirmedGarmentId },
        { confidence }
      );
    }

    return {
      status: 200,
      jsonBody: wearEvent,
    };
  } catch (err) {
    context.log(`Error in wear/confirm: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "POST /wear/confirm", userId: userId ?? "unknown" }
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to confirm wear event. Check server logs." },
    };
  }
}

app.http("postWearConfirm", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "wear/confirm",
  handler: postWearConfirm,
});
