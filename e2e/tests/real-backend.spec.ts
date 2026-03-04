/**
 * E2E: Real Backend Integration Tests (@ui)
 *
 * These tests hit the ACTUAL Azure Functions backend through the Vite
 * proxy — no route mocking, no fake data. Every API call flows through:
 *
 *   Browser → Vite (:5173) → Azure Functions (:7071) → Cosmos DB / Blob Storage
 *
 * Prerequisites:
 *   - Real backend running: `func start` in backend/
 *   - Frontend running: `npx vite` in frontend/
 *   - Data seeded in Cosmos DB (garments exist for "local-dev-user")
 *   - VITE_SKIP_AUTH=true in frontend/.env.local
 *
 * These tests verify the FULL pipeline works — auth bypass, proxy,
 * real Cosmos queries, real SAS URL generation, real blob thumbnails.
 */

import { test, expect } from '@playwright/test';

const LOCAL_BASE = 'http://localhost:5173';

// ═══════════════════════════════════════════════════════════════════════════════
// Real Backend: Dashboard loads real data from Cosmos DB
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Real Backend: Dashboard @ui', () => {
  test('loads real stats from Cosmos DB', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Dashboard should show real garment count
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Items')).toBeVisible();

    // Should show actual garment count (we seeded data)
    const totalItemsSection = page.locator('text=Total Items').locator('..');
    await expect(totalItemsSection).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Real Backend: Catalog shows garments from Cosmos DB with Blob thumbnails
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Real Backend: Catalog @ui', () => {
  test('loads real garments from Cosmos DB', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to Catalog
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 15_000 });

    // Should show the garments we seeded (use .first() since duplicates may exist)
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('White T-Shirt').first()).toBeVisible();
    await expect(page.getByText('Black Jeans').first()).toBeVisible();
    await expect(page.getByText('Running Shoes').first()).toBeVisible();
    await expect(page.getByText('Red Dress').first()).toBeVisible();
  });

  test('garment thumbnails load from real Blob Storage with SAS URLs', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 15_000 });

    // Wait for garment cards to appear
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 10_000 });

    // Check that at least one real image exists
    const images = page.locator('img[alt]');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);

    // Verify the first image src is a real Azure Blob SAS URL
    const firstSrc = await images.first().getAttribute('src');
    expect(firstSrc).toContain('blob.core.windows.net');
    expect(firstSrc).toContain('sig=');

    // Verify the image ACTUALLY LOADED (not a broken image)
    // naturalWidth > 0 means the browser successfully decoded the image data.
    // A 403 or broken image has naturalWidth === 0.
    // Wait up to 10s for the image to finish loading (network latency from Azure Blob).
    await expect(async () => {
      const loaded = await images.first().evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      );
      expect(loaded).toBe(true);
    }).toPass({ timeout: 10_000 });

    // Also verify via a direct HTTP fetch that the SAS URL returns 200
    const response = await page.request.get(firstSrc!);
    expect(response.status(), `Image URL should return 200, got ${response.status()}`).toBe(200);
    expect(response.headers()['content-type']).toContain('image/');
  });

  test('search filters real garments by name', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 15_000 });

    // Search for "Dress"
    await page.getByPlaceholder('Search garments').fill('Dress');

    // Only Red Dress should remain
    await expect(page.getByText('Red Dress').first()).toBeVisible();
    await expect(page.getByText('Blue Denim Jacket')).not.toBeVisible();
    await expect(page.getByText('White T-Shirt')).not.toBeVisible();
  });

  test('category filter works against real data', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 15_000 });

    // Click "Top" category chip
    await page.locator('[aria-pressed]').locator('..').getByRole('button', { name: 'Top' }).click();

    // Only White T-Shirt should show
    await expect(page.getByText('White T-Shirt').first()).toBeVisible();
    await expect(page.getByText('Blue Denim Jacket')).not.toBeVisible();
    await expect(page.getByText('Running Shoes')).not.toBeVisible();
  });

  test('click garment card → real GarmentDetail with stats from Cosmos', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 15_000 });

    // Click on a garment
    await page.getByText('Blue Denim Jacket').first().click();

    // GarmentDetail should load with real stats from Cosmos
    await expect(page.getByText('Wear Statistics')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('outerwear')).toBeVisible();

    // Navigate back
    await page.getByRole('button', { name: /back to catalog/i }).first().click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Real Backend: History page renders real wear events
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Real Backend: History @ui', () => {
  test('history page loads real data (may be empty initially)', async ({ page }) => {
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /history/i }).click();

    await expect(page.getByText('Outfit History')).toBeVisible({ timeout: 15_000 });

    // Either shows events or "No outfit history yet" — both are valid
    const hasEvents = await page.getByText(/ago|Today|Yesterday/i).isVisible().catch(() => false);
    const isEmpty = await page.getByText(/no outfit history yet/i).isVisible().catch(() => false);
    expect(hasEvents || isEmpty).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Real Backend: Full navigation flow with real data
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Real Backend: Full Navigation @ui', () => {
  test('navigate all pages with real data flowing through', async ({ page }) => {
    // Capture all API requests to verify they hit the real backend
    const apiRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        apiRequests.push(`${req.method()} ${new URL(req.url()).pathname}`);
      }
    });

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // 1. Dashboard — real stats
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Items')).toBeVisible();

    // 2. Catalog — real garments with real images
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 10_000 });

    // 3. Today — upload page (just verify it renders)
    await page.getByRole('button', { name: /today/i }).click();
    await expect(page.getByText("Today's Outfit")).toBeVisible({ timeout: 10_000 });

    // 4. History — real history data
    await page.getByRole('button', { name: /history/i }).click();
    await expect(page.getByText('Outfit History')).toBeVisible({ timeout: 15_000 });

    // 5. Back to Dashboard
    await page.getByRole('button', { name: /dashboard/i }).click();
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 10_000 });

    // Verify real API calls were made (not mocked)
    expect(apiRequests).toContain('GET /api/stats/summary');
    expect(apiRequests).toContain('GET /api/garments');
    expect(apiRequests).toContain('GET /api/wear/history');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Real Backend: API response validation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Real Backend: API Responses @ui', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const res = await request.get(`${LOCAL_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/garments returns real garments through proxy', async ({ request }) => {
    const res = await request.get(`${LOCAL_BASE}/api/garments`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.garments).toBeDefined();
    expect(body.garments.length).toBeGreaterThan(0);

    // Verify garment structure
    const first = body.garments[0];
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.category).toBeDefined();
    expect(typeof first.wearCount).toBe('number');

    // Thumbnail should be a real SAS URL
    if (first.thumbnailUrl) {
      expect(first.thumbnailUrl).toContain('blob.core.windows.net');
      expect(first.thumbnailUrl).toContain('sig=');
    }
  });

  test('GET /api/stats/summary returns real stats', async ({ request }) => {
    const res = await request.get(`${LOCAL_BASE}/api/stats/summary`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.totalGarments).toBeGreaterThan(0);
    expect(body.garments.length).toBeGreaterThan(0);
    expect(body.streaks).toBeDefined();
    expect(body.calendar).toBeDefined();
  });

  test('GET /api/wear/history returns valid response', async ({ request }) => {
    const res = await request.get(`${LOCAL_BASE}/api/wear/history`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.events).toBeDefined();
    expect(Array.isArray(body.events)).toBe(true);
  });

  test('POST /api/images/sas-url returns real SAS URLs', async ({ request }) => {
    const res = await request.post(`${LOCAL_BASE}/api/images/sas-url`, {
      data: { blobName: 'test/e2e-check.jpg', contentType: 'image/jpeg' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toContain('blob.core.windows.net');
    expect(body.readUrl).toContain('blob.core.windows.net');
    expect(body.uploadUrl).toContain('sig=');
  });
});
