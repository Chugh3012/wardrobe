import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { createGarment } from "../services/garmentService.js";

/** Minimum number of catalog photos required for onboarding. */
const MIN_PHOTOS = 3;
/** Maximum number of catalog photos allowed. */
const MAX_PHOTOS = 8;

interface PostGarmentBody {
  userId?: unknown;
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
 *   "userId": "string",          // required until auth middleware is wired (Issue #13)
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

  // ── Validate required fields ───────────────────────────────────────────────

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";

  if (!userId) {
    return {
      status: 400,
      jsonBody: { error: "'userId' is required." },
    };
  }
  if (!name) {
    return {
      status: 400,
      jsonBody: { error: "'name' is required." },
    };
  }
  if (!category) {
    return {
      status: 400,
      jsonBody: { error: "'category' is required." },
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

  // ── Create garment ─────────────────────────────────────────────────────────

  try {
    const garment = await createGarment({
      userId,
      name,
      category,
      catalogImageUrls,
    });

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
