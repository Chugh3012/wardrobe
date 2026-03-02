/**
 * Authentication middleware for Azure Functions.
 *
 * Extracts the authenticated userId from the `x-ms-client-principal-id`
 * header injected by Azure Static Web Apps / Azure App Service EasyAuth.
 *
 * **Security (S4):** Body-based userId fallback has been removed to prevent
 * user impersonation.  The default for `REQUIRE_AUTH` is now `true` (secure
 * by default).  Set `REQUIRE_AUTH=false` only for local development without
 * EasyAuth — in that case callers must still supply the header manually.
 */

import type { HttpRequest } from "@azure/functions";

/** Returns true when strict authentication enforcement is enabled (default). */
export function isAuthRequired(): boolean {
  return process.env["REQUIRE_AUTH"] !== "false";
}

/**
 * Extracts the userId from the request.
 *
 * Only the `x-ms-client-principal-id` header (set by Azure EasyAuth / SWA
 * auth) is accepted.  Returns `null` when the header is absent or empty.
 */
export function extractUserId(
  request: HttpRequest,
): string | null {
  const headerValue = request.headers.get("x-ms-client-principal-id");
  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
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
