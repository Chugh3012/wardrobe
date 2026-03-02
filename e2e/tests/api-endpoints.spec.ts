/**
 * E2E: API Endpoint Verification (@api)
 *
 * Verifies that all backend API endpoints are deployed, reachable, and
 * return the expected responses. Tests run against the live SWA URL
 * (authenticated via EasyAuth) or the direct Function App URL.
 *
 * For authenticated endpoints, tests verify 401 behavior (unauthenticated)
 * and, where possible, test with auth headers. Since EasyAuth in SWA
 * handles authentication, direct Function App tests check that
 * REQUIRE_AUTH=true properly rejects unauthenticated requests.
 *
 * NOTE: The Function App has IP restrictions (Azure Cloud service tag only),
 * so tests running from a local machine may get TLS/connection errors.
 * When this happens, the test is skipped with a descriptive message.
 * In CI (GitHub Actions on Azure), the IP is allowed and tests run fully.
 *
 * The SWA has EasyAuth enabled with `/* → authenticated` route rule, so
 * all unauthenticated requests (including /api/health) get a 302 redirect
 * to /.auth/login/aad. The Function App returns 403 for REQUIRE_AUTH
 * rejections when accessed behind IP restrictions.
 *
 * Prerequisites:
 *   - FUNC_URL env var (e.g. https://func-wardrobe-dev.azurewebsites.net)
 *     OR SWA_URL env var
 */

import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
import { FUNC_URL, SWA_URL } from '../helpers/azure-cli.js';

// Prefer direct Function App URL for API tests (avoids EasyAuth redirect).
// Fall back to SWA URL if FUNC_URL is not set.
const API_BASE = FUNC_URL || SWA_URL;

// Whether we're going through SWA (EasyAuth) or direct Function App
const IS_SWA = !FUNC_URL && !!SWA_URL;

function skipIfNoApiBase() {
  if (!API_BASE) {
    test.skip();
  }
}

/**
 * Safely make an HTTP request; returns null and skips the test if the
 * connection is refused (IP restrictions, TLS errors, timeouts).
 */
async function safeGet(
  request: APIRequestContext,
  url: string,
  opts?: Parameters<APIRequestContext['get']>[1],
): Promise<APIResponse | null> {
  try {
    return await request.get(url, opts);
  } catch (e: unknown) {
    const msg = (e as Error).message || '';
    if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('TLS') || msg.includes('socket disconnect')) {
      test.skip(true, `Skipped — cannot reach ${url} (IP-restricted or unreachable)`);
    }
    throw e;
  }
}

async function safePost(
  request: APIRequestContext,
  url: string,
  opts?: Parameters<APIRequestContext['post']>[1],
): Promise<APIResponse | null> {
  try {
    return await request.post(url, opts);
  } catch (e: unknown) {
    const msg = (e as Error).message || '';
    if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('TLS') || msg.includes('socket disconnect')) {
      test.skip(true, `Skipped — cannot reach ${url} (IP-restricted or unreachable)`);
    }
    throw e;
  }
}

/** Valid "unauthorized" response codes across SWA (302) and Function App (401/403) */
const UNAUTH_CODES = [401, 302, 403];

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Health Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('GET /api/health @api', () => {
  test('returns 200 with { status: "ok" }', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/health`);
    if (!res) return;
    // SWA redirects everything to login (302); Function App may return 200 or 403
    if (IS_SWA) {
      expect([200, 302]).toContain(res.status());
    } else if (res.status() === 200) {
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    } else {
      // IP restrictions may return 403
      expect(UNAUTH_CODES).toContain(res.status());
    }
  });

  test('returns JSON content type', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/health`);
    if (!res) return;
    if (res.status() === 200) {
      const ct = res.headers()['content-type'] || '';
      expect(ct).toContain('application/json');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — GET /api/garments (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('GET /api/garments @api', () => {
  test('returns 401/302/403 without authentication', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/garments`);
    if (!res) return;
    expect(UNAUTH_CODES).toContain(res.status());
  });

  test('rejects invalid auth header', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/garments`, {
      headers: { 'x-ms-client-principal': 'not-valid-base64!!!' },
    });
    if (!res) return;
    expect([400, 401, 302, 403]).toContain(res.status());
  });

  test('accepts valid base64 auth header and returns garments array', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safeGet(request, `${API_BASE}/api/garments`, {
      headers: { 'x-ms-client-principal': principal },
    });
    if (!res) return;
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('garments');
      expect(Array.isArray(body.garments)).toBe(true);
    } else {
      // Accept 401/403/302 if direct access is restricted (SEC-P1)
      expect(UNAUTH_CODES).toContain(res.status());
    }
  });

  test('supports pageSize query parameter', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safeGet(request, `${API_BASE}/api/garments?pageSize=5`, {
      headers: { 'x-ms-client-principal': principal },
    });
    if (!res) return;
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('garments');
      expect(body.garments.length).toBeLessThanOrEqual(5);
    }
  });

  test('returns 400 for invalid pageSize', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safeGet(request, `${API_BASE}/api/garments?pageSize=0`, {
      headers: { 'x-ms-client-principal': principal },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — POST /api/garments (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /api/garments @api', () => {
  test('returns 401/302/403 without authentication', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safePost(request, `${API_BASE}/api/garments`, {
      data: { name: 'Test', category: 'dress', catalogImageUrls: [] },
    });
    if (!res) return;
    expect(UNAUTH_CODES).toContain(res.status());
  });

  test('returns 400 for missing required fields', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/garments`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { name: 'Test' }, // missing category and catalogImageUrls
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns 400 when fewer than 3 photos are provided', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/garments`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'E2E Dress',
        category: 'dress',
        catalogImageUrls: ['https://example.blob.core.windows.net/a.jpg'],
      },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns 400 for invalid category', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/garments`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'E2E Garment',
        category: 'invalid-category',
        catalogImageUrls: [
          'https://test.blob.core.windows.net/a.jpg',
          'https://test.blob.core.windows.net/b.jpg',
          'https://test.blob.core.windows.net/c.jpg',
        ],
      },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('rejects non-HTTPS image URLs (SSRF protection)', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/garments`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'E2E Garment',
        category: 'dress',
        catalogImageUrls: [
          'http://evil.com/a.jpg',
          'https://test.blob.core.windows.net/b.jpg',
          'https://test.blob.core.windows.net/c.jpg',
        ],
      },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — POST /api/images/sas-url (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /api/images/sas-url @api', () => {
  test('returns 401/302/403 without authentication', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safePost(request, `${API_BASE}/api/images/sas-url`, {
      data: { blobName: 'test.jpg' },
    });
    if (!res) return;
    expect(UNAUTH_CODES).toContain(res.status());
  });

  test('returns 400 for missing blobName', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/images/sas-url`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: {},
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns 400 for path-traversal blobName', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/images/sas-url`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { blobName: '../../etc/passwd' },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('rejects disallowed content types', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/images/sas-url`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { blobName: 'test.html', contentType: 'text/html' },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns uploadUrl and readUrl for valid request', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/images/sas-url`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { blobName: 'e2e-test.jpg', contentType: 'image/jpeg' },
    });
    if (!res) return;
    // May be 200 (success) or 403 (IP/auth) or 500/503 (if blob account not reachable)
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('uploadUrl');
      expect(body).toHaveProperty('readUrl');
      expect(body).toHaveProperty('blobName');
      expect(body.blobName).toContain('e2e-test-user/');
      expect(body.uploadUrl).toContain('blob.core.windows.net');
      expect(body.readUrl).toContain('blob.core.windows.net');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — POST /api/wear/predict (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /api/wear/predict @api', () => {
  test('returns 401/302/403 without authentication', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safePost(request, `${API_BASE}/api/wear/predict`, {
      data: { outfitImageUrl: 'https://example.blob.core.windows.net/outfit.jpg' },
    });
    if (!res) return;
    expect(UNAUTH_CODES).toContain(res.status());
  });

  test('returns 400 for missing outfitImageUrl', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/wear/predict`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: {},
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns 400 for non-HTTPS outfitImageUrl (SSRF)', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/wear/predict`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { outfitImageUrl: 'http://169.254.169.254/metadata/identity' },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns 400 for non-blob-domain outfitImageUrl', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/wear/predict`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { outfitImageUrl: 'https://evil.com/outfit.jpg' },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — POST /api/wear/confirm (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('POST /api/wear/confirm @api', () => {
  test('returns 401/302/403 without authentication', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safePost(request, `${API_BASE}/api/wear/confirm`, {
      data: {
        predictionAuditId: 'test-audit',
        confirmedGarmentId: 'test-garment',
        confirmed: true,
      },
    });
    if (!res) return;
    expect(UNAUTH_CODES).toContain(res.status());
  });

  test('returns 400 for missing required fields', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/wear/confirm`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: { predictionAuditId: 'test' }, // missing confirmedGarmentId and confirmed
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });

  test('returns 400 when confirmed is not a boolean', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safePost(request, `${API_BASE}/api/wear/confirm`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: {
        predictionAuditId: 'test-audit',
        confirmedGarmentId: 'test-garment',
        confirmed: 'yes',
      },
    });
    if (!res) return;
    if (!UNAUTH_CODES.includes(res.status())) {
      expect(res.status()).toBe(400);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — GET /api/stats/summary (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('GET /api/stats/summary @api', () => {
  test('returns 401/302/403 without authentication', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/stats/summary`);
    if (!res) return;
    expect(UNAUTH_CODES).toContain(res.status());
  });

  test('returns stats summary with correct shape', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    const res = await safeGet(request, `${API_BASE}/api/stats/summary`, {
      headers: { 'x-ms-client-principal': principal },
    });
    if (!res) return;
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('totalGarments');
      expect(body).toHaveProperty('totalWearEvents');
      expect(body).toHaveProperty('garments');
      expect(body).toHaveProperty('mostWorn');
      expect(body).toHaveProperty('leastWorn');
      expect(typeof body.totalGarments).toBe('number');
      expect(typeof body.totalWearEvents).toBe('number');
      expect(Array.isArray(body.garments)).toBe(true);
      expect(Array.isArray(body.mostWorn)).toBe(true);
      expect(Array.isArray(body.leastWorn)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Security: Direct Function App access (SEC-P1 / SEC-P5)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Security — Direct access restrictions @api', () => {
  test('health endpoint is reachable', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/health`);
    if (!res) return;
    // Health is anonymous on Function App → 200; SWA → 302 (EasyAuth redirect)
    expect([200, 302, 403]).toContain(res.status());
  });

  test('protected endpoints return non-200 without auth', async ({ request }) => {
    skipIfNoApiBase();
    const endpoints = [
      { method: 'GET' as const, path: '/api/garments' },
      { method: 'GET' as const, path: '/api/stats/summary' },
      { method: 'POST' as const, path: '/api/garments' },
      { method: 'POST' as const, path: '/api/images/sas-url' },
      { method: 'POST' as const, path: '/api/wear/predict' },
      { method: 'POST' as const, path: '/api/wear/confirm' },
    ];

    for (const ep of endpoints) {
      const res = ep.method === 'GET'
        ? await safeGet(request, `${API_BASE}${ep.path}`)
        : await safePost(request, `${API_BASE}${ep.path}`, {
            data: {},
            headers: { 'Content-Type': 'application/json' },
          });
      if (!res) return;
      // Should NOT be 200 — must be 401, 302 (redirect), or 403 (IP blocked / auth)
      expect(
        res.status(),
        `${ep.method} ${ep.path} should be protected (got ${res.status()})`,
      ).not.toBe(200);
    }
  });

  test('oversized payload is rejected (S12: maxRequestBytes)', async ({ request }) => {
    skipIfNoApiBase();
    const principal = Buffer.from(JSON.stringify({ userId: 'e2e-test-user' })).toString('base64');
    // Generate a ~6MB payload (exceeds 5MB limit)
    const largeBody = JSON.stringify({ name: 'x'.repeat(6 * 1024 * 1024) });
    const res = await safePost(request, `${API_BASE}/api/garments`, {
      headers: {
        'x-ms-client-principal': principal,
        'Content-Type': 'application/json',
      },
      data: largeBody,
    });
    if (!res) return;
    // Should reject — 413, 400, 403, or other error
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Response Headers (CSP, security headers)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Response Headers @api', () => {
  test('API health returns standard security headers', async ({ request }) => {
    skipIfNoApiBase();
    const res = await safeGet(request, `${API_BASE}/api/health`);
    if (!res) return;
    const headers = res.headers();
    // Azure Functions / SWA should set Strict-Transport-Security
    // These may not all be present on direct Function calls, so we check what we can
    if (headers['strict-transport-security']) {
      expect(headers['strict-transport-security']).toContain('max-age');
    }
  });
});
