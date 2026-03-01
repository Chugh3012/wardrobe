import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listGarments } from "../services/garmentService.js";
import { createPredictionAudit } from "../services/predictionAuditService.js";
import { predictGarments } from "../services/predictionService.js";

interface PostWearPredictBody {
  userId?: unknown;
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
 *   "userId": "string",            // required until auth middleware (Issue #13)
 *   "outfitImageUrl": "string"     // pre-uploaded Blob Storage URL
 * }
 *
 * Returns 200 with predictions array.
 * Returns 400 for validation errors.
 * Returns 404 if the user has no garments to match against.
 */
export async function postWearPredict(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
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
  const userId =
    typeof body.userId === "string" ? body.userId.trim() : "";
  const outfitImageUrl =
    typeof body.outfitImageUrl === "string" ? body.outfitImageUrl.trim() : "";

  if (!userId) {
    return {
      status: 400,
      jsonBody: { error: "'userId' is required." },
    };
  }
  if (!outfitImageUrl) {
    return {
      status: 400,
      jsonBody: { error: "'outfitImageUrl' is required." },
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

    const predictions = predictGarments(garments);

    // ── Create PredictionAudit ────────────────────────────────────────────
    const audit = await createPredictionAudit({
      userId,
      inputImageUrl: outfitImageUrl,
      topKPredictions: predictions,
      userFinalSelection: "", // set later via POST /wear/confirm (Issue #8)
    });

    // ── Build response with garmentName ───────────────────────────────────
    const garmentMap = new Map(garments.map((g) => [g.id, g.name]));

    const results = predictions.map((p) => ({
      garmentId: p.garmentId,
      garmentName: garmentMap.get(p.garmentId) ?? "",
      confidence: p.confidence,
    }));

    context.log(
      `Predicted ${results.length} garment(s) for user ${userId}, audit ${audit.id}`
    );

    return {
      status: 200,
      jsonBody: {
        predictionAuditId: audit.id,
        predictions: results,
      },
    };
  } catch (err) {
    context.log(`Error in wear/predict: ${err}`);
    return {
      status: 500,
      jsonBody: { error: "Failed to predict garments. Check server logs." },
    };
  }
}

app.http("postWearPredict", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "wear/predict",
  handler: postWearPredict,
});
