/**
 * Authentication middleware for Azure Functions.
 *
 * Extracts the authenticated userId from the request.  Supports two modes:
 *
 * 1. **Token-based (Entra External ID / B2C)** — reads the standard
 *    `x-ms-client-principal-id` header injected by Azure Static Web Apps /
 *    Azure App Service EasyAuth when the user is authenticated.
 *
 * 2. **Body-based (backward compatibility)** — when the header is absent the
 *    function falls back to reading `userId` from the JSON body.  This keeps
 *    existing clients and tests working while the identity provider is being
 *    rolled out.
 *
 * Set the `REQUIRE_AUTH` environment variable to `"true"` to enforce
 * token-based auth and reject body-only requests with HTTP 401.
 */

import type { HttpRequest } from "@azure/functions";

/** Returns true when strict authentication enforcement is enabled. */
export function isAuthRequired(): boolean {
  return process.env["REQUIRE_AUTH"] === "true";
}

/**
 * Extracts the userId from the request.
 *
 * Resolution order:
 * 1. `x-ms-client-principal-id` header (set by Azure EasyAuth / SWA auth).
 * 2. `userId` field in the parsed JSON body (backward compat).
 * 3. `null` when neither source provides a userId.
 */
export function extractUserId(
  request: HttpRequest,
  parsedBody?: Record<string, unknown>
): string | null {
  // Prefer the EasyAuth header — it is tamper-proof when served through Azure.
  const headerValue = request.headers.get("x-ms-client-principal-id");
  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  // Fallback to body-supplied userId (backward compat / local dev).
  if (parsedBody && typeof parsedBody["userId"] === "string") {
    const bodyUserId = (parsedBody["userId"] as string).trim();
    if (bodyUserId) return bodyUserId;
  }

  return null;
}

/**
 * Returns a 401 HTTP response when authentication is required but no userId
 * could be extracted from the request.
 */
export function unauthorizedResponse() {
  return {
    status: 401 as const,
    jsonBody: { error: "Authentication required. Please sign in." },
  };
}
