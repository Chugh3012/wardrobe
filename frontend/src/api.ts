/**
 * API client — typed wrappers around the backend REST endpoints.
 *
 * All requests go through the SWA reverse proxy (`/api/*`), so no
 * explicit backend URL is needed. SWA EasyAuth automatically attaches
 * the `x-ms-client-principal` header for authenticated users.
 *
 * Every function throws on non-2xx responses with a structured error
 * message extracted from the JSON body when available.
 */

// ── Shared types ─────────────────────────────────────────────────────────────

export interface GarmentSummary {
  id: string;
  name: string;
  category: string;
  wearCount: number;
  thumbnailUrl: string | null;
}

export interface GarmentListResponse {
  garments: GarmentSummary[];
  continuationToken?: string;
}

export interface Prediction {
  garmentId: string;
  garmentName: string;
  confidence: number;
}

export interface PredictResponse {
  predictionAuditId: string;
  source: 'custom_vision' | 'embedding_fallback';
  confidenceLevel: 'high' | 'medium' | 'low';
  predictions: Prediction[];
}

export interface WearEvent {
  id: string;
  userId: string;
  garmentId: string;
  outfitImageUrl: string;
  predictedGarmentId: string;
  confidence: number;
  confirmed: boolean;
  createdAt: string;
}

export interface GarmentStat {
  garmentId: string;
  name: string;
  category: string;
  wearCount: number;
  lastWornDate: string | null;
}

export interface StatsSummary {
  totalGarments: number;
  totalWearEvents: number;
  garments: GarmentStat[];
  mostWorn: Array<{ garmentId: string; name: string; wearCount: number }>;
  leastWorn: Array<{ garmentId: string; name: string; wearCount: number }>;
}

export interface SasUrlResponse {
  blobName: string;
  uploadUrl: string;
  readUrl: string;
}

export interface CreatedGarment {
  id: string;
  userId: string;
  name: string;
  category: string;
  catalogImageUrls: string[];
  wearCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Check if the current user is authenticated via SWA EasyAuth.
 * Calls `/.auth/me` — returns `true` if a valid principal exists.
 * In local dev (Vite without SWA), this endpoint won't exist — treat as authenticated.
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) return false;
    const data = await res.json();
    // SWA returns { clientPrincipal: { ... } | null }
    return data?.clientPrincipal != null;
  } catch {
    // Fetch failed (e.g. local dev without SWA proxy) — allow through
    return true;
  }
}

// ── Helper ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const body = await res.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // body wasn't JSON — keep default message
    }
    throw new Error(message);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected response format from API.');
  }
  return res.json() as Promise<T>;
}

// ── Garments ─────────────────────────────────────────────────────────────────

/**
 * GET /api/garments — fetch the authenticated user's garments.
 */
export async function fetchGarments(
  pageSize?: number,
  continuationToken?: string,
): Promise<GarmentListResponse> {
  const params = new URLSearchParams();
  if (pageSize) params.set('pageSize', String(pageSize));
  if (continuationToken) params.set('continuationToken', continuationToken);
  const qs = params.toString();
  return apiFetch<GarmentListResponse>(`/api/garments${qs ? `?${qs}` : ''}`);
}

/**
 * POST /api/garments — create a new garment.
 */
export async function createGarment(
  name: string,
  category: string,
  catalogImageUrls: string[],
): Promise<CreatedGarment> {
  return apiFetch<CreatedGarment>('/api/garments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category, catalogImageUrls }),
  });
}

// ── Images ───────────────────────────────────────────────────────────────────

/**
 * POST /api/images/sas-url — get upload + read SAS URLs for a blob.
 */
export async function getSasUrl(
  blobName: string,
  contentType = 'image/jpeg',
): Promise<SasUrlResponse> {
  return apiFetch<SasUrlResponse>('/api/images/sas-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blobName, contentType }),
  });
}

/**
 * Upload a file directly to Blob Storage using the SAS upload URL.
 */
export async function uploadToBlob(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Blob upload failed (${res.status})`);
  }
}

// ── Predictions ──────────────────────────────────────────────────────────────

/**
 * POST /api/wear/predict — upload an outfit image and get predictions.
 */
export async function predictOutfit(
  outfitImageUrl: string,
): Promise<PredictResponse> {
  return apiFetch<PredictResponse>('/api/wear/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outfitImageUrl }),
  });
}

/**
 * POST /api/wear/confirm — confirm or correct a prediction.
 */
export async function confirmWear(
  predictionAuditId: string,
  confirmedGarmentId: string,
  confirmed: boolean,
): Promise<WearEvent> {
  return apiFetch<WearEvent>('/api/wear/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ predictionAuditId, confirmedGarmentId, confirmed }),
  });
}

// ── Stats ────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/summary — get wear statistics for the dashboard.
 */
export async function fetchStatsSummary(): Promise<StatsSummary> {
  return apiFetch<StatsSummary>('/api/stats/summary');
}
