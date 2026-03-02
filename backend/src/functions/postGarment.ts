import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { createGarment } from "../services/garmentService.js";
import { submitTrainingImages } from "../services/customVisionService.js";
import { computeEmbedding } from "../services/embeddingService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { isValidImageUrl } from "../services/urlValidator.js";

/** Minimum number of catalog photos required for onboarding. */
const MIN_PHOTOS = 3;
/** Maximum number of catalog photos allowed. */
const MAX_PHOTOS = 8;
/** Maximum length for garment name. */
const MAX_NAME_LENGTH = 100;
/** Maximum length for garment category. */
const MAX_CATEGORY_LENGTH = 50;
/** Maximum length for URL fields (S12). */
const MAX_URL_LENGTH = 2048;

/** Allowed garment categories — must match the frontend CATEGORIES array (F2). */
const ALLOWED_CATEGORIES = new Set([
  "dress",
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessory",
  "other",
]);

interface PostGarmentBody {
  name?: unknown;
  category?: unknown;
  catalogImageUrls?: unknown;
}

/**
 * POST /api/garments
 *
 * Creates a new garment in the authenticated user's catalog.
 *
 * Body (JSON):
 * {
 *   "name": "string",            // garment display name
 *   "category": "string",        // e.g. "dress", "top", "bottom", "jacket"
 *   "catalogImageUrls": [        // 3–8 pre-uploaded Blob Storage URLs
 *     "https://…/img1.jpg",
 *     "https://…/img2.jpg",
 *     "https://…/img3.jpg"
 *   ]
 * }
 *
 * Returns 201 with the created Garment document.
 * Returns 400 for validation errors.
 * Returns 401 when REQUIRE_AUTH is enabled and no auth header is present.
 */
export async function postGarment(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: PostGarmentBody;
  try {
    body = (await request.json()) as PostGarmentBody;
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body." },
    };
  }

  // ── Authenticate ───────────────────────────────────────────────────────────
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // ── Validate required fields ───────────────────────────────────────────────

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";

  if (!name) {
    return {
      status: 400,
      jsonBody: { error: "'name' is required." },
    };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'name' must be at most ${MAX_NAME_LENGTH} characters.` },
    };
  }
  if (!category) {
    return {
      status: 400,
      jsonBody: { error: "'category' is required." },
    };
  }
  if (category.length > MAX_CATEGORY_LENGTH) {
    return {
      status: 400,
      jsonBody: { error: `'category' must be at most ${MAX_CATEGORY_LENGTH} characters.` },
    };
  }
  if (!ALLOWED_CATEGORIES.has(category.toLowerCase())) {
    return {
      status: 400,
      jsonBody: {
        error: `'category' must be one of: ${[...ALLOWED_CATEGORIES].join(", ")}. Received '${category}'.`,
      },
    };
  }

  // ── Validate catalogImageUrls ──────────────────────────────────────────────

  if (!Array.isArray(body.catalogImageUrls)) {
    return {
      status: 400,
      jsonBody: { error: "'catalogImageUrls' must be an array of URL strings." },
    };
  }

  const catalogImageUrls: string[] = [];
  for (const url of body.catalogImageUrls) {
    if (typeof url !== "string" || !url.trim()) {
      return {
        status: 400,
        jsonBody: { error: "Each entry in 'catalogImageUrls' must be a non-empty string." },
      };
    }
    catalogImageUrls.push(url.trim());
  }

  if (catalogImageUrls.length < MIN_PHOTOS || catalogImageUrls.length > MAX_PHOTOS) {
    return {
      status: 400,
      jsonBody: {
        error: `'catalogImageUrls' must contain between ${MIN_PHOTOS} and ${MAX_PHOTOS} URLs. Received ${catalogImageUrls.length}.`,
      },
    };
  }

  for (const url of catalogImageUrls) {
    if (url.length > MAX_URL_LENGTH) {
      return {
        status: 400,
        jsonBody: {
          error: `Each URL in 'catalogImageUrls' must be at most ${MAX_URL_LENGTH} characters.`,
        },
      };
    }
    if (!isValidImageUrl(url)) {
      return {
        status: 400,
        jsonBody: {
          error:
            "Each entry in 'catalogImageUrls' must be a valid HTTPS URL from an allowed domain (*.blob.core.windows.net).",
        },
      };
    }
  }

  // ── Create garment ─────────────────────────────────────────────────────────

  try {
    // Pre-compute embeddings for similarity search (Issue #11).
    const embeddings: number[][] = [];
    for (const url of catalogImageUrls) {
      const emb = await computeEmbedding(url);
      if (emb) embeddings.push(emb);
    }

    const garment = await createGarment({
      userId,
      name,
      category,
      catalogImageUrls,
      ...(embeddings.length > 0 ? { catalogEmbeddings: embeddings } : {}),
    });

    // Submit catalog images to Custom Vision for training (Issue #10).
    // This is fire-and-forget — failures are logged but do not block the response.
    submitTrainingImages(garment.id, catalogImageUrls).catch((err) =>
      context.log(`Custom Vision training submission failed: ${err}`)
    );

    context.log(`Created garment ${garment.id} for user ${userId}`);

    return {
      status: 201,
      jsonBody: garment,
    };
  } catch (err) {
    context.log(`Error creating garment: ${err}`);
    return {
      status: 500,
      jsonBody: { error: "Failed to create garment. Check server logs." },
    };
  }
}

app.http("postGarment", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "garments",
  handler: postGarment,
});
