/**
 * Records the full prediction result and the user's final selection.
 * Used for auditing, analytics, and future model retraining.
 * Stored in the "predictionAudits" Cosmos DB container, partitioned by userId.
 */
export interface PredictionAudit {
  id: string;
  userId: string;
  inputImageUrl: string;
  topKPredictions: PredictionEntry[];
  /** Which prediction pipeline produced the result. */
  source: PredictionSource;
  userFinalSelection: string; // garmentId selected by the user
  createdAt: string; // ISO 8601
}

export interface PredictionEntry {
  garmentId: string;
  confidence: number;
}

export type PredictionSource = "custom_vision" | "embedding_fallback" | "stub";
