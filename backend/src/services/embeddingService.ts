/**
 * Azure AI Vision image-embedding service (fallback for Issue #11).
 *
 * Uses the Azure AI Vision 4.0 vectorize-image endpoint to compute a 1024-d
 * embedding vector for an image URL.  Cosine similarity between the daily
 * outfit embedding and the stored catalog embeddings determines the best match.
 *
 * Required environment variables:
 *   AI_VISION_ENDPOINT  — e.g. https://westeurope.api.cognitive.microsoft.com
 *   AI_VISION_KEY       — API key for the Azure AI Vision resource
 */

import type { PredictionEntry } from "../models/predictionAudit.js";

// ── Configuration helpers ────────────────────────────────────────────────────

function getEndpoint(): string {
  return process.env["AI_VISION_ENDPOINT"] ?? "";
}

function getKey(): string {
  return process.env["AI_VISION_KEY"] ?? "";
}

/** Returns true when the embedding service is configured. */
export function isEmbeddingServiceConfigured(): boolean {
  return !!(getEndpoint() && getKey());
}

// ── Embedding computation ────────────────────────────────────────────────────

/**
 * Computes a 1024-dimensional embedding for an image URL via Azure AI Vision
 * vectorize-image API.  Returns `null` on failure or when the service is not
 * configured.
 */
export async function computeEmbedding(imageUrl: string): Promise<number[] | null> {
  if (!isEmbeddingServiceConfigured()) return null;

  const endpoint = getEndpoint();
  const key = getKey();

  const url = `${endpoint}/computervision/retrieval:vectorizeImage?api-version=2024-02-01&model-version=2023-04-15`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: imageUrl }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as { vector?: number[] };
  return body.vector ?? null;
}

// ── Cosine similarity ────────────────────────────────────────────────────────

/**
 * Computes cosine similarity between two vectors of equal length.
 * Returns a value between -1 and 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Similarity search ────────────────────────────────────────────────────────

export interface CatalogEmbedding {
  garmentId: string;
  embedding: number[];
}

/**
 * Finds the top-N most similar garments from a set of catalog embeddings.
 *
 * For each garment we take the **maximum** similarity across all its catalog
 * image embeddings (best match wins).
 */
export function findTopMatches(
  queryEmbedding: number[],
  catalog: CatalogEmbedding[],
  topN = 3
): PredictionEntry[] {
  // Group embeddings by garmentId and keep the max similarity per garment.
  const best = new Map<string, number>();
  for (const item of catalog) {
    const sim = cosineSimilarity(queryEmbedding, item.embedding);
    const cur = best.get(item.garmentId) ?? -Infinity;
    if (sim > cur) best.set(item.garmentId, sim);
  }

  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([garmentId, confidence]) => ({
      garmentId,
      confidence: +confidence.toFixed(4),
    }));
}
