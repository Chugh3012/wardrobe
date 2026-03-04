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

const { fetchGarments, fetchStatsSummary, fetchWearHistory, createGarment, getSasUrl, predictOutfit, confirmWear, deleteWearEvent } = await import('./api');

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
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
});
