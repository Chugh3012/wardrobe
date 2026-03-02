import type { Garment } from "../models/garment.js";
import type { PredictionEntry, PredictionSource } from "../models/predictionAudit.js";
import { classifyImage } from "./customVisionService.js";
import {
  computeEmbedding,
  findTopMatches,
  type CatalogEmbedding,
} from "./embeddingService.js";
import { getHighConfidenceThreshold } from "./configService.js";

/** The combined result of a prediction pipeline run. */
export interface PredictionResult {
  predictions: PredictionEntry[];
  source: PredictionSource;
}

/**
 * Run the prediction pipeline for a daily outfit image.
 *
 * 1. Try Azure AI Custom Vision classification.
 *    – If the top confidence ≥ the high-confidence threshold → return.
 * 2. Fall back to Azure AI Vision image-embedding cosine similarity search.
 * 3. If neither service is configured, fall back to a deterministic stub.
 */
export async function predictGarments(
  imageUrl: string,
  garments: Garment[]
): Promise<PredictionResult> {
  // ── 1. Custom Vision ──────────────────────────────────────────────────────
  const cvPredictions = await classifyImage(imageUrl);
  if (cvPredictions && cvPredictions.length > 0) {
    // Map CV tag names (garmentId) to garments the user owns.
    const ownedIds = new Set(garments.map((g) => g.id));
    const filtered = cvPredictions.filter((p) => ownedIds.has(p.garmentId));

    if (filtered.length > 0) {
      const topConfidence = filtered[0].confidence;
      if (topConfidence >= getHighConfidenceThreshold()) {
        return { predictions: filtered, source: "custom_vision" };
      }
      // Below threshold — fall through to embedding fallback, but keep CV
      // results as a potential fallback-of-fallback.
    }
  }

  // ── 2. Embedding fallback ─────────────────────────────────────────────────
  const queryEmbedding = await computeEmbedding(imageUrl);
  if (queryEmbedding) {
    const catalog: CatalogEmbedding[] = [];
    for (const g of garments) {
      if (g.catalogEmbeddings) {
        for (const emb of g.catalogEmbeddings) {
          catalog.push({ garmentId: g.id, embedding: emb });
        }
      }
    }
    if (catalog.length > 0) {
      const matches = findTopMatches(queryEmbedding, catalog, 3);
      if (matches.length > 0) {
        return { predictions: matches, source: "embedding_fallback" };
      }
    }
  }

  // ── 3. Stub (deterministic placeholder) ───────────────────────────────────
  const stub: PredictionEntry[] = garments.map((g, i) => ({
    garmentId: g.id,
    confidence: Math.max(0.05, +(0.95 - i * 0.1).toFixed(2)),
  }));
  return { predictions: stub, source: "stub" };
}
