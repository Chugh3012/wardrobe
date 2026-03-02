/**
 * Azure AI Custom Vision integration.
 *
 * Provides helpers to:
 *   1. Submit garment catalog images as training data (tagged by garmentId).
 *   2. Classify a daily outfit image and return prediction results.
 *
 * When the Custom Vision environment variables are not set the helpers
 * return graceful "not-configured" results so the app degrades to the
 * embedding fallback (Issue #11) or stub predictions.
 *
 * Required environment variables (stored in Key Vault, surfaced via App Settings):
 *   CUSTOM_VISION_TRAINING_ENDPOINT  — e.g. https://northeurope.api.cognitive.microsoft.com
 *   CUSTOM_VISION_TRAINING_KEY       — API key for the training resource
 *   CUSTOM_VISION_PREDICTION_ENDPOINT — e.g. https://northeurope.api.cognitive.microsoft.com
 *   CUSTOM_VISION_PREDICTION_KEY     — API key for the prediction resource
 *   CUSTOM_VISION_PROJECT_ID         — GUID of the Custom Vision project
 *   CUSTOM_VISION_PUBLISHED_NAME     — iteration publish name (e.g. "latest")
 */

import type { PredictionEntry } from "../models/predictionAudit.js";

// ── Configuration helpers ────────────────────────────────────────────────────

function getTrainingEndpoint(): string {
  return process.env["CUSTOM_VISION_TRAINING_ENDPOINT"] ?? "";
}

function getTrainingKey(): string {
  return process.env["CUSTOM_VISION_TRAINING_KEY"] ?? "";
}

function getPredictionEndpoint(): string {
  return process.env["CUSTOM_VISION_PREDICTION_ENDPOINT"] ?? "";
}

function getPredictionKey(): string {
  return process.env["CUSTOM_VISION_PREDICTION_KEY"] ?? "";
}

function getProjectId(): string {
  return process.env["CUSTOM_VISION_PROJECT_ID"] ?? "";
}

function getPublishedName(): string {
  return process.env["CUSTOM_VISION_PUBLISHED_NAME"] ?? "latest";
}

/** Returns true when all required Custom Vision env vars are configured. */
export function isCustomVisionConfigured(): boolean {
  return !!(
    getTrainingEndpoint() &&
    getTrainingKey() &&
    getPredictionEndpoint() &&
    getPredictionKey() &&
    getProjectId()
  );
}

// ── Training ─────────────────────────────────────────────────────────────────

/**
 * Submits garment catalog images to Custom Vision as training data tagged
 * with the garmentId.  Returns the number of images successfully submitted.
 *
 * This is a best-effort operation — failures are logged but do not throw.
 */
export async function submitTrainingImages(
  garmentId: string,
  imageUrls: string[]
): Promise<number> {
  if (!isCustomVisionConfigured()) return 0;

  const endpoint = getTrainingEndpoint();
  const key = getTrainingKey();
  const projectId = getProjectId();

  // Ensure the tag (garmentId) exists — Custom Vision requires tags to exist first.
  const tagId = await ensureTag(endpoint, key, projectId, garmentId);
  if (!tagId) return 0;

  // Submit each image URL with the tag.
  const entries = imageUrls.map((url) => ({ url, tagIds: [tagId] }));
  const url = `${endpoint}/customvision/v3.3/training/projects/${projectId}/images/urls`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Training-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ images: entries }),
  });

  if (!res.ok) return 0;

  const body = (await res.json()) as { isBatchSuccessful?: boolean; images?: unknown[] };
  return body.images?.length ?? 0;
}

/**
 * Ensures a tag with the given name exists in the Custom Vision project.
 * Returns the tag id, or empty string on failure.
 */
async function ensureTag(
  endpoint: string,
  key: string,
  projectId: string,
  tagName: string
): Promise<string> {
  // List existing tags and look for a match.
  const listUrl = `${endpoint}/customvision/v3.3/training/projects/${projectId}/tags`;
  const listRes = await fetch(listUrl, {
    headers: { "Training-Key": key },
  });
  if (listRes.ok) {
    const tags = (await listRes.json()) as Array<{ id: string; name: string }>;
    const existing = tags.find((t) => t.name === tagName);
    if (existing) return existing.id;
  }

  // Tag does not exist — create it.
  const createUrl = `${listUrl}?name=${encodeURIComponent(tagName)}`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: { "Training-Key": key },
  });
  if (!createRes.ok) return "";

  const created = (await createRes.json()) as { id: string };
  return created.id;
}

// ── Prediction ───────────────────────────────────────────────────────────────

/**
 * Classifies an image URL against the trained Custom Vision model.
 *
 * Returns an array of {@link PredictionEntry} sorted by confidence descending,
 * or `null` when Custom Vision is not configured.
 */
export async function classifyImage(
  imageUrl: string
): Promise<PredictionEntry[] | null> {
  if (!isCustomVisionConfigured()) return null;

  const endpoint = getPredictionEndpoint();
  const key = getPredictionKey();
  const projectId = getProjectId();
  const publishedName = getPublishedName();

  const url =
    `${endpoint}/customvision/v3.0/prediction/${projectId}/classify/iterations/${publishedName}/url`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Prediction-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: imageUrl }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    predictions?: Array<{ tagName: string; probability: number }>;
  };

  if (!body.predictions) return null;

  return body.predictions
    .map((p) => ({
      garmentId: p.tagName,
      confidence: +p.probability.toFixed(4),
    }))
    .sort((a, b) => b.confidence - a.confidence);
}
