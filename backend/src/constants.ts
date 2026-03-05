/**
 * Shared validation constants for backend handlers.
 *
 * Import from this module instead of redefining limits in each handler.
 * Per project convention: "Reuse shared constants — never hardcode new limits."
 */

// ── Field length limits ────────────────────────────────────────────────────

/** Maximum length for entity ID fields (garment IDs, wear event IDs, audit IDs). */
export const MAX_ID_LENGTH = 256;

/** Maximum length for garment name. */
export const MAX_NAME_LENGTH = 100;

/** Maximum length for garment category. */
export const MAX_CATEGORY_LENGTH = 50;

/** Maximum length for URL fields. */
export const MAX_URL_LENGTH = 2048;

/** Maximum allowed length for the caller-supplied blobName segment. */
export const MAX_BLOB_NAME_LENGTH = 256;

// ── Photo count limits ─────────────────────────────────────────────────────

/** Minimum number of catalog photos required for onboarding. */
export const MIN_PHOTOS = 1;

/** Maximum number of catalog photos allowed. */
export const MAX_PHOTOS = 8;

// ── Allowed values ─────────────────────────────────────────────────────────

/**
 * Allowed garment categories — must match the frontend CATEGORIES array (F2).
 */
export const ALLOWED_CATEGORIES = new Set([
  "dress",
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessory",
  "other",
]);

// ── Safe-character regexes ─────────────────────────────────────────────────

/**
 * Only safe characters allowed in entity ID values (garment IDs, wear event IDs, etc.).
 * Prevents path traversal, injection, and other unsafe inputs.
 */
export const SAFE_ENTITY_ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Only safe characters allowed in blob name values (allows path separators).
 * Prevents path traversal and injection in blob storage paths.
 */
export const SAFE_BLOB_NAME_RE = /^[a-zA-Z0-9._/-]+$/;
