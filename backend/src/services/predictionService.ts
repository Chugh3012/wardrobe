import type { Garment } from "../models/garment.js";
import type { PredictionEntry } from "../models/predictionAudit.js";

/**
 * Stub prediction service.
 *
 * Until Azure AI Custom Vision is integrated (Issue #10), this service
 * returns all of the user's garments as candidates with descending
 * placeholder confidence scores.  The first garment receives 0.95 and
 * each subsequent garment drops by 0.10 (floored at 0.05).
 */
export function predictGarments(garments: Garment[]): PredictionEntry[] {
  return garments.map((g, i) => ({
    garmentId: g.id,
    confidence: Math.max(0.05, +(0.95 - i * 0.1).toFixed(2)),
  }));
}
