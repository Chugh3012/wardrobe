/**
 * Unit tests for the API client module.
 *
 * Tests the apiFetch helper, auth token acquisition, and each
 * endpoint wrapper function. Uses mocked fetch and MSAL.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock MSAL before importing api.ts ────────────────────────────────────────

const mockGetAllAccounts = vi.fn().mockReturnValue([{ username: 'test@test.com' }]);
const mockAcquireTokenSilent = vi.fn().mockResolvedValue({ accessToken: 'mock-token-123' });
const mockLoginRedirect = vi.fn();
const mockAcquireTokenRedirect = vi.fn();
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockHandleRedirectPromise = vi.fn().mockResolvedValue(null);

vi.mock('./msalConfig', () => ({
  msalInstance: {
    getAllAccounts: mockGetAllAccounts,
    acquireTokenSilent: mockAcquireTokenSilent,
    loginRedirect: mockLoginRedirect,
    acquireTokenRedirect: mockAcquireTokenRedirect,
    initialize: mockInitialize,
    handleRedirectPromise: mockHandleRedirectPromise,
  },
  apiScopes: ['api://test-client-id/access_as_user'],
  apiBaseUrl: 'http://localhost:7071',
}));

// ── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Ensure VITE_SKIP_AUTH is NOT set so the real MSAL path runs in tests
vi.stubEnv('VITE_SKIP_AUTH', '');

// ── Import after mocks ─────────────────────────────────────────────────────

const { fetchGarments, fetchStatsSummary, fetchWearHistory, createGarment, updateGarment, getSasUrl, predictOutfit, confirmWear, deleteWearEvent, clearApiCache } = await import('./api');

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  clearApiCache();
  mockGetAllAccounts.mockReturnValue([{ username: 'test@test.com' }]);
  mockAcquireTokenSilent.mockResolvedValue({ accessToken: 'mock-token-123' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helper ──────────────────────────────────────────────────────────────────

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('API Client', () => {
  describe('fetchGarments', () => {
    it('calls GET /api/garments with auth header', async () => {
      const responseBody = { garments: [], continuationToken: undefined };
      mockFetch.mockResolvedValue(mockJsonResponse(200, responseBody));

      const result = await fetchGarments();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/garments');
      expect(init.headers.get('Authorization')).toBe('Bearer mock-token-123');
      expect(result).toEqual(responseBody);
    });

    it('passes pageSize and continuationToken as query params', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { garments: [] }));

      await fetchGarments(10, 'abc123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('pageSize=10');
      expect(url).toContain('continuationToken=abc123');
    });

    it('throws on non-2xx response', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(500, { error: 'Server error' }));

      await expect(fetchGarments()).rejects.toThrow('Server error');
    });
  });

  describe('createGarment', () => {
    it('sends POST /api/garments with body', async () => {
      const created = { id: 'g1', name: 'Shirt', category: 'top', wearCount: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(201, created));

      const result = await createGarment('Shirt', 'top', ['https://blob.test/img.jpg']);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/garments');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.name).toBe('Shirt');
      expect(body.category).toBe('top');
      expect(result).toEqual(created);
    });
  });

  describe('updateGarment', () => {
    it('sends PATCH /api/garments/:id with body', async () => {
      const updated = { id: 'g1', name: 'New Name', category: 'top', wearCount: 3 };
      mockFetch.mockResolvedValue(mockJsonResponse(200, updated));

      const result = await updateGarment('g1', { name: 'New Name' });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/garments/g1');
      expect(init.method).toBe('PATCH');
      const body = JSON.parse(init.body);
      expect(body.name).toBe('New Name');
      expect(result).toEqual(updated);
    });

    it('invalidates garments + stats cache after updateGarment', async () => {
      const stats = { totalGarments: 1, totalWearEvents: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(200, stats));
      await fetchStatsSummary();

      const updated = { id: 'g1', name: 'Updated', category: 'top', wearCount: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(200, updated));
      await updateGarment('g1', { name: 'Updated' });

      mockFetch.mockResolvedValue(mockJsonResponse(200, { ...stats, totalGarments: 1 }));
      await fetchStatsSummary();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('fetchStatsSummary', () => {
    it('calls GET /api/stats/summary', async () => {
      const stats = { totalGarments: 5, totalWearEvents: 20 };
      mockFetch.mockResolvedValue(mockJsonResponse(200, stats));

      const result = await fetchStatsSummary();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/stats/summary');
      expect(result).toEqual(stats);
    });
  });

  describe('fetchWearHistory', () => {
    it('calls GET /api/wear/history with pagination params', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { events: [] }));

      await fetchWearHistory(5, 'token-abc');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('pageSize=5');
      expect(url).toContain('continuationToken=token-abc');
    });
  });

  describe('getSasUrl', () => {
    it('sends POST /api/images/sas-url', async () => {
      const sas = { blobName: 'test.jpg', uploadUrl: 'https://...', readUrl: 'https://...' };
      mockFetch.mockResolvedValue(mockJsonResponse(200, sas));

      const result = await getSasUrl('test.jpg', 'image/jpeg');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/images/sas-url');
      expect(init.method).toBe('POST');
      expect(result).toEqual(sas);
    });
  });

  describe('predictOutfit', () => {
    it('sends POST /api/wear/predict', async () => {
      const prediction = { predictionAuditId: 'pa1', predictions: [] };
      mockFetch.mockResolvedValue(mockJsonResponse(200, prediction));

      const result = await predictOutfit('https://blob.test/outfit.jpg');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/wear/predict');
      expect(JSON.parse(init.body).outfitImageUrl).toBe('https://blob.test/outfit.jpg');
      expect(result).toEqual(prediction);
    });
  });

  describe('confirmWear', () => {
    it('sends POST /api/wear/confirm', async () => {
      const event = { id: 'we1', confirmed: true };
      mockFetch.mockResolvedValue(mockJsonResponse(200, event));

      const result = await confirmWear('pa1', 'g1', true);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/wear/confirm');
      const body = JSON.parse(init.body);
      expect(body.predictionAuditId).toBe('pa1');
      expect(body.confirmedGarmentId).toBe('g1');
      expect(body.confirmed).toBe(true);
      expect(result).toEqual(event);
    });
  });

  describe('deleteWearEvent', () => {
    it('sends DELETE /api/wear/events/:id', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers() });

      await deleteWearEvent('we1');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:7071/api/wear/events/we1');
      expect(init.method).toBe('DELETE');
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(404, { error: 'Not found' }));

      await expect(deleteWearEvent('bad-id')).rejects.toThrow();
    });
  });

  // ── Caching behaviour ──────────────────────────────────────────────────────

  describe('caching', () => {
    it('returns cached data on second call within TTL', async () => {
      const stats = { totalGarments: 5, totalWearEvents: 20 };
      mockFetch.mockResolvedValue(mockJsonResponse(200, stats));

      const first = await fetchStatsSummary();
      const second = await fetchStatsSummary();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(first).toEqual(second);
    });

    it('caches fetchGarments by query params', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { garments: [{ id: 'g1' }] }));

      await fetchGarments(10);
      await fetchGarments(10);

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('treats different query params as separate cache keys', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { garments: [] }));

      await fetchGarments(10);
      await fetchGarments(20);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('invalidates garments + stats cache after createGarment', async () => {
      const stats = { totalGarments: 1, totalWearEvents: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(200, stats));
      await fetchStatsSummary(); // populate cache

      // createGarment call
      const created = { id: 'g1', name: 'Shirt', category: 'top', wearCount: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(201, created));
      await createGarment('Shirt', 'top', []);

      // stats cache should be invalidated — next call should hit network
      mockFetch.mockResolvedValue(mockJsonResponse(200, { ...stats, totalGarments: 2 }));
      const refreshed = await fetchStatsSummary();
      expect(refreshed.totalGarments).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(3); // initial + create + re-fetch
    });

    it('invalidates stats + history cache after confirmWear', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { events: [] }));
      await fetchWearHistory();

      mockFetch.mockResolvedValue(mockJsonResponse(200, { id: 'we1', confirmed: true }));
      await confirmWear('pa1', 'g1', true);

      mockFetch.mockResolvedValue(mockJsonResponse(200, { events: [{ id: 'we1' }] }));
      const result = await fetchWearHistory();
      expect(result.events).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('invalidates cache after deleteWearEvent', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { events: [{ id: 'we1' }] }));
      await fetchWearHistory();

      mockFetch.mockResolvedValue({ ok: true, status: 200, headers: new Headers() });
      await deleteWearEvent('we1');

      mockFetch.mockResolvedValue(mockJsonResponse(200, { events: [] }));
      const result = await fetchWearHistory();
      expect(result.events).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('clearApiCache forces re-fetch', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(200, { totalGarments: 1 }));
      await fetchStatsSummary();

      clearApiCache();

      mockFetch.mockResolvedValue(mockJsonResponse(200, { totalGarments: 99 }));
      const result = await fetchStatsSummary();
      expect(result.totalGarments).toBe(99);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
