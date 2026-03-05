import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listGarments } from "../services/garmentService.js";
import { createPredictionAudit } from "../services/predictionAuditService.js";
import { predictGarments } from "../services/predictionService.js";
import { getConfidenceLevel } from "../services/configService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { isValidImageUrl } from "../services/urlValidator.js";
import { trackEvent, trackMetric, trackException } from "../services/telemetryService.js";
import { MAX_URL_LENGTH } from "../constants.js";

interface PostWearPredictBody {
  outfitImageUrl?: unknown;
}

/**
 * POST /api/wear/predict
 *
 * Accepts a daily outfit photo URL, runs garment prediction, stores a
 * PredictionAudit record, and returns the top matches with confidence scores.
 *
 * Body (JSON):
 * {
 *   "outfitImageUrl": "string"     // pre-uploaded Blob Storage URL
 * }
 *
 * Returns 200 with predictions array, source, and confidenceLevel.
 * Returns 400 for validation errors.
 * Returns 401 when REQUIRE_AUTH is enabled and no auth header is present.
 * Returns 404 if the user has no garments to match against.
 */
export async function postWearPredict(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // ── Parse JSON body ───────────────────────────────────────────────────────
  let body: PostWearPredictBody;
  try {
    body = (await request.json()) as PostWearPredictBody;
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body." },
    };
  }

  // ── Validate required fields ──────────────────────────────────────────────
  const outfitImageUrl =
    typeof body.outfitImageUrl === "string" ? body.outfitImageUrl.trim() : "";

  if (!outfitImageUrl) {
    return {
      status: 400,
      jsonBody: { error: "'outfitImageUrl' is required." },
    };
  }

  if (outfitImageUrl.length > MAX_URL_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'outfitImageUrl' must be at most ${MAX_URL_LENGTH} characters.` },
    };
  }

  if (!isValidImageUrl(outfitImageUrl)) {
    return {
      status: 400,
      jsonBody: {
        error:
          "'outfitImageUrl' must be a valid HTTPS URL from an allowed domain (*.blob.core.windows.net).",
      },
    };
  }

  // ── Fetch user's garments & predict ───────────────────────────────────────
  try {
    const garments = await listGarments(userId);

    if (garments.length === 0) {
      return {
        status: 404,
        jsonBody: {
          error:
            "No garments found for this user. Add garments before predicting.",
        },
      };
    }

    const { predictions, source } = await predictGarments(outfitImageUrl, garments);

    // ── Create PredictionAudit ────────────────────────────────────────────
    const audit = await createPredictionAudit({
      userId,
      inputImageUrl: outfitImageUrl,
      topKPredictions: predictions,
      source,
      userFinalSelection: "", // set later via POST /wear/confirm (Issue #8)
    });

    // ── Build response with garmentName ───────────────────────────────────
    const garmentMap = new Map(garments.map((g) => [g.id, g.name]));

    const results = predictions.map((p) => ({
      garmentId: p.garmentId,
      garmentName: garmentMap.get(p.garmentId) ?? "",
      confidence: p.confidence,
    }));

    const topConfidence = predictions.length > 0 ? predictions[0].confidence : 0;
    const confidenceLevel = getConfidenceLevel(topConfidence);

    context.log(
      `Predicted ${results.length} garment(s) for user ${userId}, audit ${audit.id}, source=${source}, level=${confidenceLevel}`
    );

    // ── Custom telemetry (Issue #14) ──────────────────────────────────────
    trackMetric("PredictionConfidence", topConfidence);
    trackEvent(
      "PredictionCompleted",
      { userId, source, confidenceLevel, auditId: audit.id },
      { topConfidence, candidateCount: results.length }
    );
    if (source === "embedding_fallback") {
      trackEvent("PredictionFallbackTriggered", { userId, auditId: audit.id }, { topConfidence });
    }

    return {
      status: 200,
      jsonBody: {
        predictionAuditId: audit.id,
        source,
        confidenceLevel,
        predictions: results,
      },
    };
  } catch (err) {
    context.log(`Error in wear/predict: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "POST /wear/predict", userId: userId ?? "unknown" }
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to predict garments." },
    };
  }
}

app.http("postWearPredict", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "wear/predict",
  handler: postWearPredict,
});
