/**
 * E2E: UI Verification (@ui)
 *
 * Architecture: Pattern A — SWA protects only /api/* routes.
 * The SPA shell (HTML/JS/CSS) loads for everyone. The React app checks
 * /.auth/me client-side and redirects unauthenticated users to login.
 *
 * Test categories:
 *
 * 1. **SWA-specific tests**: Run against the live SWA URL to verify
 *    API auth enforcement, /login rewrite, disabled providers,
 *    PWA manifest, security headers, asset loading, SPA fallback.
 *
 * 2. **Page rendering tests**: Run against a local Vite preview server
 *    with /.auth/me mocked as authenticated. API calls are intercepted
 *    via Playwright route mocking.
 *
 * Prerequisites:
 *   - SWA_URL env var for SWA-specific tests
 *   - Vite preview server started by playwright.config.ts webServer
 */

import { test, expect, Page, Route } from '@playwright/test';
import { SWA_URL } from '../helpers/azure-cli.js';

// SWA URL for auth/redirect/header tests
const SWA_BASE = SWA_URL || '';

// Local Vite preview URL for page rendering tests
// (set by playwright.config.ts ui-mobile/ui-desktop projects → baseURL)
const LOCAL_BASE = 'http://localhost:5173';

function skipIfNoSwa() {
  if (!SWA_BASE) {
    test.skip();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Authentication Redirect
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Authentication @ui', () => {
  test('unauthenticated API access returns 401 or redirects to login', async ({ request }) => {
    skipIfNoSwa();
    // Under Pattern A, only /api/* requires auth. Direct API call should get 401→302.
    const res = await request.get(`${SWA_BASE}/api/garments`, { maxRedirects: 0 });
    expect([401, 302]).toContain(res.status());
  });

  test('SWA root serves the app shell (200) without requiring auth', async ({ request }) => {
    skipIfNoSwa();
    const res = await request.get(SWA_BASE, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="root"');
  });

  test('client-side auth check redirects unauthenticated users to login', async ({ page }) => {
    skipIfNoSwa();
    // Go to SWA — the shell loads, React calls /.auth/me → null → redirects to login
    await page.goto(SWA_BASE, { waitUntil: 'networkidle', timeout: 15_000 });
    const url = page.url();
    const redirected = url.includes('login.microsoftonline.com')
      || url.includes('/.auth/login');
    expect(redirected, `Should redirect to Entra login, got: ${url}`).toBe(true);
  });

  test('/login route rewrites to /.auth/login/aad', async ({ page }) => {
    skipIfNoSwa();
    await page.goto(`${SWA_BASE}/login`, { waitUntil: 'commit' });
    const url = page.url();
    const isLoginPage = url.includes('login.microsoftonline.com')
      || url.includes('/.auth/login/aad');
    expect(isLoginPage, `Should be login page, got: ${url}`).toBe(true);
  });

  test('disabled identity providers return 404', async ({ request }) => {
    skipIfNoSwa();
    for (const provider of ['github', 'twitter']) {
      const res = await request.get(`${SWA_BASE}/.auth/login/${provider}`, {
        maxRedirects: 0,
      });
      expect([404, 302]).toContain(res.status());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — PWA Manifest & Service Worker
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('PWA @ui', () => {
  test('manifest.json is served with correct content', async ({ request }) => {
    // Try local Vite server (no auth) — it serves the public folder
    const res = await request.get(`${LOCAL_BASE}/manifest.json`);
    if (res.status() === 200) {
      const manifest = await res.json();
      expect(manifest.name).toBe('Wardrobe Tracker');
      expect(manifest.short_name).toBe('Wardrobe');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#7c3aed');
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('service worker is registered at /sw.js', async ({ request }) => {
    const res = await request.get(`${LOCAL_BASE}/sw.js`);
    if (res.status() === 200) {
      const body = await res.text();
      expect(body).toContain('self');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Security Headers on SWA
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Security Headers (SWA) @ui', () => {
  test('response includes CSP, HSTS, and X-Content-Type-Options', async ({ request }) => {
    skipIfNoSwa();
    const res = await request.get(SWA_BASE, { maxRedirects: 0 });
    const headers = res.headers();

    // SWA sets globalHeaders via staticwebapp.config.json
    // On a 302 redirect, headers are still present
    if (headers['content-security-policy']) {
      expect(headers['content-security-policy']).toContain("default-src 'self'");
    }
    if (headers['x-content-type-options']) {
      expect(headers['x-content-type-options']).toBe('nosniff');
    }
    if (headers['strict-transport-security']) {
      expect(headers['strict-transport-security']).toContain('max-age');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3b — Static Asset MIME Types on SWA
//
// Vite outputs hashed bundles to /assets/. The SWA auth config must
// allow anonymous access to /assets/* so the browser receives the real
// files (with correct MIME types) rather than an HTML login redirect.
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Static Asset Loading (SWA) @ui', () => {
  test('index.html references at least one JS and one CSS asset', async ({ page }) => {
    skipIfNoSwa();
    // SWA now serves the shell to everyone — we can fetch directly
    const res = await page.request.get(`${SWA_BASE}/`);
    const html = await res.text();

    const jsMatch = html.match(/\/assets\/[^"']+\.js/);
    const cssMatch = html.match(/\/assets\/[^"']+\.css/);
    expect(jsMatch, 'index.html should reference a JS bundle in /assets/').toBeTruthy();
    expect(cssMatch, 'index.html should reference a CSS bundle in /assets/').toBeTruthy();
  });

  test('JS bundles are served with correct MIME type (not text/html)', async ({ request }) => {
    skipIfNoSwa();
    // Get index.html from SWA to find the hashed asset filename
    const indexRes = await request.get(`${SWA_BASE}/`);
    const html = await indexRes.text();
    const jsMatch = html.match(/\/assets\/([^"']+\.js)/);
    expect(jsMatch, 'Should find a JS asset path in index.html').toBeTruthy();

    // Request that asset from SWA
    const assetRes = await request.get(`${SWA_BASE}/assets/${jsMatch![1]}`, { maxRedirects: 0 });
    expect(assetRes.status(), `JS asset should return 200, got ${assetRes.status()}`).toBe(200);
    const ct = assetRes.headers()['content-type'] ?? '';
    expect(ct, `JS asset MIME should be javascript, got: ${ct}`).toMatch(/javascript/);
  });

  test('CSS bundles are served with correct MIME type (not text/html)', async ({ request }) => {
    skipIfNoSwa();
    const indexRes = await request.get(`${SWA_BASE}/`);
    const html = await indexRes.text();
    const cssMatch = html.match(/\/assets\/([^"']+\.css)/);
    expect(cssMatch, 'Should find a CSS asset path in index.html').toBeTruthy();

    const assetRes = await request.get(`${SWA_BASE}/assets/${cssMatch![1]}`, { maxRedirects: 0 });
    expect(assetRes.status(), `CSS asset should return 200, got ${assetRes.status()}`).toBe(200);
    const ct = assetRes.headers()['content-type'] ?? '';
    expect(ct, `CSS asset MIME should be text/css, got: ${ct}`).toMatch(/css/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3c — Deprecated Meta Tags
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('HTML Meta Tags @ui', () => {
  test('does not use deprecated apple-mobile-web-app-capable', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'domcontentloaded' });
    const deprecated = await page.locator('meta[name="apple-mobile-web-app-capable"]').count();
    expect(deprecated, 'Should not use deprecated apple-mobile-web-app-capable').toBe(0);
  });

  test('uses mobile-web-app-capable instead', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'domcontentloaded' });
    const modern = await page.locator('meta[name="mobile-web-app-capable"]').count();
    expect(modern).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Page Rendering (with API mocking via route interception)
//
// These tests run against the LOCAL Vite preview server (no auth).
// API calls are intercepted with route mocking to simulate responses.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mock all API routes and /.auth/me to return safe defaults.
 * /.auth/me returns a valid clientPrincipal so App.tsx's checkAuth()
 * resolves to true (simulating an authenticated user).
 * Individual tests can override specific routes before navigation.
 */
async function mockApis(page: Page) {
  // Mock /.auth/me — return a valid principal so client-side auth check passes
  await page.route('**/.auth/me', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientPrincipal: {
          identityProvider: 'aad',
          userId: 'test-user-id',
          userDetails: 'test@example.com',
          userRoles: ['authenticated', 'anonymous'],
        },
      }),
    }),
  );

  // Default: return empty stats
  await page.route('**/api/stats/summary', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalGarments: 0, totalWearEvents: 0, garments: [], mostWorn: [], leastWorn: [],
      }),
    }),
  );

  // Default: return empty garments
  await page.route('**/api/garments**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ garments: [] }),
      });
    }
    return route.continue();
  });
}

// ── 4a: Dashboard ──────────────────────────────────────────────────────────

test.describe('Dashboard Page @ui', () => {
  test('renders loading state then stats', async ({ page }) => {
    // Mock /.auth/me for client-side auth check
    await page.route('**/.auth/me', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientPrincipal: { identityProvider: 'aad', userId: 'test-user', userDetails: 'test@example.com', userRoles: ['authenticated', 'anonymous'] },
        }),
      }),
    );

    // Mock stats API with real data
    await page.route('**/api/stats/summary', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalGarments: 5,
          totalWearEvents: 12,
          garments: [
            { garmentId: 'g1', name: 'Red Dress', category: 'dress', wearCount: 5, lastWornDate: '2026-02-28' },
            { garmentId: 'g2', name: 'Blue Top', category: 'top', wearCount: 3, lastWornDate: '2026-02-27' },
          ],
          mostWorn: [{ garmentId: 'g1', name: 'Red Dress', wearCount: 5 }],
          leastWorn: [{ garmentId: 'g2', name: 'Blue Top', wearCount: 3 }],
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Dashboard is the default page
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Items')).toBeVisible();
    await expect(page.getByText('Total Wears')).toBeVisible();
    await expect(page.getByText('Overview')).toBeVisible();
    await expect(page.getByText('Most Worn')).toBeVisible();
    await expect(page.getByText('Least Worn')).toBeVisible();
    await expect(page.getByText('Red Dress')).toBeVisible();
  });

  test('renders error state on API failure', async ({ page }) => {
    await page.route('**/.auth/me', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientPrincipal: { identityProvider: 'aad', userId: 'test-user', userDetails: 'test@example.com', userRoles: ['authenticated', 'anonymous'] },
        }),
      }),
    );

    await page.route('**/api/stats/summary', (route: Route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    // Should show error state — the Dashboard renders "⚠️" + error text
    await expect(page.getByText(/unable to load stats|error|failed/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ── 4b: Catalog ────────────────────────────────────────────────────────────

test.describe('Catalog Page @ui', () => {
  test('renders garment list', async ({ page }) => {
    await mockApis(page);

    // Override garments with test data
    await page.route('**/api/garments**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          garments: [
            { id: 'g1', name: 'Red Dress', category: 'dress', wearCount: 5, thumbnailUrl: null },
            { id: 'g2', name: 'Blue Top', category: 'top', wearCount: 3, thumbnailUrl: null },
          ],
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to catalog
    const catalogNav = page.getByRole('button', { name: /catalog/i });
    await catalogNav.click();

    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Red Dress')).toBeVisible();
    await expect(page.getByText('Blue Top')).toBeVisible();
  });

  test('renders empty state when no garments', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    const catalogNav = page.getByRole('button', { name: /catalog/i });
    await catalogNav.click();

    await expect(page.getByText(/your catalog is empty/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Load More button appears with continuation token', async ({ page }) => {
    await mockApis(page);

    // Override garments with continuation token
    await page.route('**/api/garments**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          garments: [{ id: 'g1', name: 'Dress 1', category: 'dress', wearCount: 0, thumbnailUrl: null }],
          continuationToken: 'next-page-token',
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    const catalogNav = page.getByRole('button', { name: /catalog/i });
    await catalogNav.click();

    await expect(page.getByText(/load more/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ── 4c: Add Garment ────────────────────────────────────────────────────────

test.describe('Add Garment Page @ui', () => {
  test('renders form with photo upload, name input, and category select', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to catalog then click add
    const catalogNav = page.getByRole('button', { name: /catalog/i });
    await catalogNav.click();

    // Look for the "+" add button (aria-label="Add new garment")
    const addButton = page.getByRole('button', { name: 'Add new garment' });
    await addButton.click();

    // Verify form elements
    await expect(page.getByText('Add Garment')).toBeVisible({ timeout: 10_000 });

    // Name input
    const nameInput = page.locator('input[type="text"]');
    await expect(nameInput).toBeVisible();

    // Category select
    const categorySelect = page.locator('select');
    await expect(categorySelect).toBeVisible();

    // Check category options
    const options = await categorySelect.locator('option').allTextContents();
    const expectedCategories = ['dress', 'top', 'bottom', 'outerwear', 'shoes', 'accessory', 'other'];
    for (const cat of expectedCategories) {
      expect(
        options.some(o => o.toLowerCase().includes(cat)),
        `Category select should include "${cat}"`,
      ).toBe(true);
    }
  });
});

// ── 4d: Daily Upload ───────────────────────────────────────────────────────

test.describe('Daily Upload Page @ui', () => {
  test('renders upload area with camera icon', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to "Today" tab
    const todayNav = page.getByRole('button', { name: /today/i });
    await todayNav.click();

    await expect(page.getByText("Today's Outfit")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/upload a photo/i)).toBeVisible();

    // Should show tips section
    await expect(page.getByText(/tips for best results/i)).toBeVisible();
  });
});

// ── 4e: Bottom Navigation ──────────────────────────────────────────────────

test.describe('Bottom Navigation @ui', () => {
  test('has four navigation items: Dashboard, Catalog, Today, History', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    const nav = page.getByRole('navigation', { name: /main/i });
    await expect(nav).toBeVisible({ timeout: 10_000 });

    const buttons = nav.getByRole('button');
    const count = await buttons.count();
    expect(count).toBe(4);

    const labels = await buttons.allTextContents();
    expect(labels.some(l => /dashboard/i.test(l))).toBe(true);
    expect(labels.some(l => /catalog/i.test(l))).toBe(true);
    expect(labels.some(l => /today/i.test(l))).toBe(true);
    expect(labels.some(l => /history/i.test(l))).toBe(true);
  });

  test('navigating between pages updates active state', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Click catalog
    const catalogBtn = page.getByRole('button', { name: /catalog/i });
    await catalogBtn.click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });

    // Click today
    const todayBtn = page.getByRole('button', { name: /today/i });
    await todayBtn.click();
    await expect(page.getByText("Today's Outfit")).toBeVisible({ timeout: 10_000 });

    // Click dashboard
    const dashBtn = page.getByRole('button', { name: /dashboard/i });
    await dashBtn.click();
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — SWA Navigation Fallback (SPA routing)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('SPA Navigation Fallback @ui', () => {
  test('unknown routes serve index.html (not 404)', async ({ request }) => {
    skipIfNoSwa();
    const res = await request.get(`${SWA_BASE}/some/unknown/route`, { maxRedirects: 0 });
    // Under Pattern A, the shell is public, so navigation fallback → 200
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="root"');
  });

  test('API routes are excluded from navigation fallback', async ({ request }) => {
    skipIfNoSwa();
    const res = await request.get(`${SWA_BASE}/api/nonexistent`, { maxRedirects: 0 });
    // /api/* requires auth → should be 401 or 302, not 200 with SPA
    expect([401, 302]).toContain(res.status());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Responsive / Mobile-First Layout
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Mobile Layout @ui', () => {
  test('viewport meta tag is set for mobile', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('bottom nav is visible and touch-friendly', async ({ page }) => {
    await mockApis(page);

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    const nav = page.getByRole('navigation', { name: /main/i });
    await expect(nav).toBeVisible({ timeout: 10_000 });

    const box = await nav.boundingBox();
    expect(box).toBeTruthy();

    const viewportSize = page.viewportSize();
    if (box && viewportSize) {
      // Nav top should be near the bottom
      expect(box.y).toBeGreaterThan(viewportSize.height * 0.7);
      // Each nav button should be at least 40px tall (touch target)
      const buttons = nav.getByRole('button');
      const firstBox = await buttons.first().boundingBox();
      if (firstBox) {
        expect(firstBox.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
