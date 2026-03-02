/**
 * Authentication middleware for Azure Functions.
 *
 * Extracts the authenticated userId from the `x-ms-client-principal`
 * header injected by Azure Static Web Apps / Azure App Service EasyAuth.
 *
 * **Security (S4 + SEC-P5):** The middleware now decodes and validates
 * the full base64-encoded `x-ms-client-principal` JSON payload rather
 * than trusting the plain-text `x-ms-client-principal-id` header alone.
 * This makes header spoofing significantly harder because an attacker
 * must supply a valid JSON structure with the correct schema.
 *
 * Fallback: If `x-ms-client-principal` is absent but
 * `x-ms-client-principal-id` is present (e.g. local dev), the plain-text
 * header is still accepted when `REQUIRE_AUTH` is `"false"`.
 *
 * The default for `REQUIRE_AUTH` is `true` (secure by default).
 */

import type { HttpRequest } from "@azure/functions";

/**
 * Safe characters allowed in a userId value.
 * Azure AD object IDs are UUIDs; this also allows common test-ID formats.
 * Defense-in-depth: prevents path-traversal sequences (e.g. `../`) from
 * being smuggled through the userId into blob paths or log entries.
 */
const SAFE_USER_ID_RE = /^[a-zA-Z0-9@._-]+$/;

/** Maximum length for a userId value. */
const MAX_USER_ID_LENGTH = 128;

/**
 * Minimal shape of the decoded `x-ms-client-principal` JSON.
 * @see https://learn.microsoft.com/en-us/azure/static-web-apps/user-information
 */
interface ClientPrincipal {
  identityProvider?: string;
  userId?: string;
  userDetails?: string;
  userRoles?: string[];
}

/** Returns true when strict authentication enforcement is enabled (default). */
export function isAuthRequired(): boolean {
  return process.env["REQUIRE_AUTH"] !== "false";
}

/**
 * Attempts to decode the `x-ms-client-principal` base64 header and
 * extract the userId from within the JSON payload.  Returns `null` on
 * any validation failure.
 */
function extractFromClientPrincipal(
  headerValue: string,
): string | null {
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf8");
    const principal: ClientPrincipal = JSON.parse(json);

    if (
      !principal ||
      typeof principal !== "object" ||
      typeof principal.userId !== "string"
    ) {
      return null;
    }

    const userId = principal.userId.trim();
    if (!userId) return null;
    if (userId.length > MAX_USER_ID_LENGTH) return null;
    if (!SAFE_USER_ID_RE.test(userId)) return null;

    return userId;
  } catch {
    return null;
  }
}

/**
 * Extracts the userId from the request.
 *
 * Primary: decodes the `x-ms-client-principal` base64 header (set by
 * Azure EasyAuth / SWA auth) and extracts `userId` from the JSON payload.
 *
 * Fallback (dev only, `REQUIRE_AUTH=false`): accepts
 * `x-ms-client-principal-id` plain-text header for local development
 * without EasyAuth.
 *
 * Returns `null` when no valid userId can be extracted.
 */
export function extractUserId(
  request: HttpRequest,
): string | null {
  // ── Primary: full base64 client-principal payload (SEC-P5) ──────────────
  const principalHeader = request.headers.get("x-ms-client-principal");
  if (principalHeader && principalHeader.trim()) {
    return extractFromClientPrincipal(principalHeader.trim());
  }

  // ── Fallback: plain-text header (local dev only) ────────────────────────
  if (!isAuthRequired()) {
    const headerValue = request.headers.get("x-ms-client-principal-id");
    if (headerValue && headerValue.trim()) {
      const trimmed = headerValue.trim();
      if (trimmed.length > MAX_USER_ID_LENGTH) return null;
      if (!SAFE_USER_ID_RE.test(trimmed)) return null;
      return trimmed;
    }
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
