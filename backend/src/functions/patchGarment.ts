import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { readGarment, updateGarment } from "../services/garmentService.js";
import {
  extractUserId,
  unauthorizedResponse,
} from "../services/authMiddleware.js";
import { isValidImageUrl } from "../services/urlValidator.js";
import { trackEvent, trackException } from "../services/telemetryService.js";

/** Maximum length for garment name. */
const MAX_NAME_LENGTH = 100;
/** Maximum length for garment category. */
const MAX_CATEGORY_LENGTH = 50;
/** Maximum length for URL fields (S12). */
const MAX_URL_LENGTH = 2048;
/** Maximum length for ID fields. */
const MAX_ID_LENGTH = 256;
/** Minimum number of catalog photos required. */
const MIN_PHOTOS = 1;
/** Maximum number of catalog photos allowed. */
const MAX_PHOTOS = 8;

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

interface PatchGarmentBody {
  name?: unknown;
  category?: unknown;
  catalogImageUrls?: unknown;
}

/**
 * PATCH /api/garments/{id}
 *
 * Partially updates a garment in the authenticated user's catalog.
 * Only provided fields are updated; omitted fields remain unchanged.
 *
 * Body (JSON):
 * {
 *   "name": "string",            // optional — garment display name
 *   "category": "string",        // optional — e.g. "dress", "top", "bottom"
 *   "catalogImageUrls": [...]    // optional — 1–8 pre-uploaded Blob Storage URLs
 * }
 *
 * Returns 200 with the updated Garment document.
 * Returns 400 for validation errors.
 * Returns 401 when REQUIRE_AUTH is enabled and no auth header is present.
 * Returns 404 if the garment is not found or belongs to another user.
 */
export async function patchGarment(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // ── Authenticate ───────────────────────────────────────────────────────────
  const userId = extractUserId(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  // ── Validate path parameter ────────────────────────────────────────────────
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
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return {
      status: 400,
      jsonBody: { error: "Invalid 'id' format." },
    };
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: PatchGarmentBody;
  try {
    body = (await request.json()) as PatchGarmentBody;
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body." },
    };
  }

  // ── Validate optional fields ───────────────────────────────────────────────
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return {
        status: 400,
        jsonBody: { error: "'name' must be a non-empty string." },
      };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return {
        status: 400,
        jsonBody: { error: `'name' must be at most ${MAX_NAME_LENGTH} characters.` },
      };
    }
    updates.name = name;
  }

  if (body.category !== undefined) {
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const normalizedCategory = category.toLowerCase();
    if (!normalizedCategory) {
      return {
        status: 400,
        jsonBody: { error: "'category' must be a non-empty string." },
      };
    }
    if (normalizedCategory.length > MAX_CATEGORY_LENGTH) {
      return {
        status: 400,
        jsonBody: { error: `'category' must be at most ${MAX_CATEGORY_LENGTH} characters.` },
      };
    }
    if (!ALLOWED_CATEGORIES.has(normalizedCategory)) {
      return {
        status: 400,
        jsonBody: {
          error: `'category' must be one of: ${[...ALLOWED_CATEGORIES].join(", ")}. Received '${category}'.`,
        },
      };
    }
    updates.category = normalizedCategory;
  }

  if (body.catalogImageUrls !== undefined) {
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

    updates.catalogImageUrls = catalogImageUrls;
  }

  // At least one field must be provided
  if (Object.keys(updates).length === 0) {
    return {
      status: 400,
      jsonBody: { error: "At least one field must be provided for update (name, category, catalogImageUrls)." },
    };
  }

  // ── Read and update garment ────────────────────────────────────────────────
  try {
    const existing = await readGarment(id, userId);
    if (!existing) {
      return {
        status: 404,
        jsonBody: { error: "Garment not found." },
      };
    }

    const updated = await updateGarment(id, userId, updates);
    if (!updated) {
      return {
        status: 404,
        jsonBody: { error: "Garment not found." },
      };
    }

    context.log(`Updated garment ${id} for user ${userId}`);

    trackEvent(
      "GarmentUpdated",
      { userId, garmentId: id },
      { fieldsUpdated: Object.keys(updates).length },
    );

    return {
      status: 200,
      jsonBody: updated,
    };
  } catch (err: unknown) {
    context.log(`Error updating garment: ${err}`);
    trackException(
      err instanceof Error ? err : new Error(String(err)),
      { endpoint: "PATCH /garments", userId: userId ?? "unknown" },
    );
    return {
      status: 500,
      jsonBody: { error: "Failed to update garment." },
    };
  }
}

app.http("patchGarment", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "garments/{id}",
  handler: patchGarment,
});
