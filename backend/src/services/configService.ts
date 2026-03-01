/**
 * Centralised configuration helpers.
 *
 * All thresholds and feature-flags are read from environment variables at
 * call-time so that tests can stub them per-test via `vi.stubEnv`.
 */

/** Confidence at or above which a prediction is "high confidence". */
export function getHighConfidenceThreshold(): number {
  return parseFloat(process.env["HIGH_CONFIDENCE_THRESHOLD"] ?? "0.85");
}

/** Confidence at or above which a prediction is "medium confidence". */
export function getMediumConfidenceThreshold(): number {
  return parseFloat(process.env["MEDIUM_CONFIDENCE_THRESHOLD"] ?? "0.60");
}

/**
 * Derive the confidence band for a given top confidence score.
 *
 * - `"high"`   → confidence ≥ HIGH_CONFIDENCE_THRESHOLD  (default 85%)
 * - `"medium"` → confidence ≥ MEDIUM_CONFIDENCE_THRESHOLD (default 60%)
 * - `"low"`    → everything below the medium threshold
 */
export function getConfidenceLevel(topConfidence: number): "high" | "medium" | "low" {
  if (topConfidence >= getHighConfidenceThreshold()) return "high";
  if (topConfidence >= getMediumConfidenceThreshold()) return "medium";
  return "low";
}
