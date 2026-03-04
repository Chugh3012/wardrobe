/**
 * E2E: User Journey Tests (@ui)
 *
 * Tests REAL user interaction flows — clicking buttons, filling forms,
 * uploading files, confirming actions, and navigating between pages.
 *
 * These run against the local Vite dev server (localhost:5173) with
 * the mock API (localhost:7071) providing realistic responses.
 * API routes are intercepted via Playwright's route mocking where needed.
 *
 * Each test simulates what an actual user would do on their phone.
 */

import { test, expect, Page, Route } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCAL_BASE = 'http://localhost:5173';
const MOCK_API = 'http://localhost:7071';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a tiny valid JPEG file for upload tests.
 * Returns the path to the temp file.
 */
function createTestImage(name: string): string {
  const dir = resolve(__dirname, '..', 'test-results', 'fixtures');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);

  // Minimal valid JPEG: SOI + APP0 + DQT + SOF0 + DHT + SOS + EOI
  // This is the smallest valid JPEG that browsers can decode (1x1 red pixel).
  const jpegBytes = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0x7B, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9,
  ]);
  writeFileSync(path, jpegBytes);
  return path;
}

/**
 * Mock the API responses with realistic data + real images.
 */
async function mockAllApis(page: Page) {
  await page.route('**/api/stats/summary', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalGarments: 6,
        totalWearEvents: 98,
        garments: [
          { garmentId: 'g1', name: 'Blue Denim Jacket', category: 'outerwear', wearCount: 12, lastWornDate: '2026-03-03T10:00:00Z' },
          { garmentId: 'g2', name: 'White T-Shirt', category: 'top', wearCount: 25, lastWornDate: '2026-03-03T08:00:00Z' },
          { garmentId: 'g3', name: 'Black Jeans', category: 'bottom', wearCount: 18, lastWornDate: '2026-03-02T09:30:00Z' },
          { garmentId: 'g4', name: 'Running Shoes', category: 'shoes', wearCount: 30, lastWornDate: '2026-03-01T07:15:00Z' },
          { garmentId: 'g5', name: 'Red Dress', category: 'dress', wearCount: 5, lastWornDate: '2025-12-01T10:00:00Z' },
          { garmentId: 'g6', name: 'Wool Scarf', category: 'accessory', wearCount: 8, lastWornDate: '2026-02-15T10:00:00Z' },
        ],
        mostWorn: [
          { garmentId: 'g4', name: 'Running Shoes', wearCount: 30 },
          { garmentId: 'g2', name: 'White T-Shirt', wearCount: 25 },
        ],
        leastWorn: [
          { garmentId: 'g5', name: 'Red Dress', wearCount: 5 },
          { garmentId: 'g6', name: 'Wool Scarf', wearCount: 8 },
        ],
        forgotten: [
          { garmentId: 'g5', name: 'Red Dress', category: 'dress', lastWornDate: '2025-12-01T10:00:00Z', daysSinceWorn: 93 },
        ],
        streaks: { current: 3, longest: 14 },
        calendar: Array.from({ length: 28 }, (_, i) => ({
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          count: Math.floor(Math.random() * 3),
        })),
      }),
    }),
  );

  await page.route('**/api/garments**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          garments: [
            { id: 'g1', name: 'Blue Denim Jacket', category: 'outerwear', wearCount: 12, thumbnailUrl: `${MOCK_API}/mock-images/g1.jpg` },
            { id: 'g2', name: 'White T-Shirt', category: 'top', wearCount: 25, thumbnailUrl: `${MOCK_API}/mock-images/g2.jpg` },
            { id: 'g3', name: 'Black Jeans', category: 'bottom', wearCount: 18, thumbnailUrl: `${MOCK_API}/mock-images/g3.jpg` },
            { id: 'g4', name: 'Running Shoes', category: 'shoes', wearCount: 30, thumbnailUrl: `${MOCK_API}/mock-images/g4.jpg` },
            { id: 'g5', name: 'Red Dress', category: 'dress', wearCount: 5, thumbnailUrl: `${MOCK_API}/mock-images/g5.jpg` },
            { id: 'g6', name: 'Wool Scarf', category: 'accessory', wearCount: 8, thumbnailUrl: `${MOCK_API}/mock-images/g6.jpg` },
          ],
        }),
      });
    }
    // POST /api/garments — create garment
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'g-new', userId: 'test-user', name: 'Test Garment',
        category: 'top', catalogImageUrls: [],
        wearCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/api/wear/history**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        events: [
          { id: 'we1', garmentId: 'g2', garmentName: 'White T-Shirt', category: 'top', outfitImageUrl: `${MOCK_API}/mock-images/g2.jpg`, confidence: 0.92, createdAt: '2026-03-03T08:00:00Z' },
          { id: 'we2', garmentId: 'g3', garmentName: 'Black Jeans', category: 'bottom', outfitImageUrl: `${MOCK_API}/mock-images/g3.jpg`, confidence: 0.88, createdAt: '2026-03-02T09:30:00Z' },
          { id: 'we3', garmentId: 'g1', garmentName: 'Blue Denim Jacket', category: 'outerwear', outfitImageUrl: `${MOCK_API}/mock-images/g1.jpg`, confidence: 0.75, createdAt: '2026-03-01T07:15:00Z' },
        ],
      }),
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Journey 1: Catalog → Search → Filter → Click Garment → Detail → Back
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Journey: Browse & Search Catalog @ui', () => {
  test('search garments by name and filter by category', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to Catalog
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });

    // Verify garment images are rendering (not placeholder icons)
    const images = page.locator('img[alt]');
    await expect(images.first()).toBeVisible({ timeout: 5_000 });

    // Search by typing in the search input
    const searchInput = page.getByPlaceholder('Search garments');
    await searchInput.fill('Denim');
    // Should show only Blue Denim Jacket
    await expect(page.getByText('Blue Denim Jacket')).toBeVisible();
    await expect(page.getByText('White T-Shirt')).not.toBeVisible();

    // Clear search
    await searchInput.clear();
    await expect(page.getByText('White T-Shirt')).toBeVisible();

    // Filter by category — click "Shoes" chip (in the filter chips bar, not garment cards)
    await page.locator('[aria-pressed]').locator('..').getByRole('button', { name: 'Shoes' }).click();
    await expect(page.getByText('Running Shoes')).toBeVisible();
    await expect(page.getByText('Blue Denim Jacket')).not.toBeVisible();

    // Click "All" to reset filter
    await page.locator('[aria-pressed]').locator('..').getByRole('button', { name: 'All' }).click();
    await expect(page.getByText('Blue Denim Jacket')).toBeVisible();
    await expect(page.getByText('Running Shoes')).toBeVisible();
  });

  test('click garment card to view detail then navigate back', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to Catalog
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });

    // Click on "Blue Denim Jacket" garment card
    await page.getByText('Blue Denim Jacket').click();

    // Should show GarmentDetail page
    await expect(page.getByText('Wear Statistics')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('outerwear')).toBeVisible();

    // Click back button
    await page.getByRole('button', { name: /back to catalog/i }).first().click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Journey 2: Add Garment — Full Flow (upload photo, fill form, submit)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Journey: Add a New Garment @ui', () => {
  test('complete add garment flow: upload photo → fill name → select category → save', async ({ page }) => {
    await mockAllApis(page);

    // Mock SAS URL endpoint
    await page.route('**/api/images/sas-url', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blobName: 'garments/test-image.jpg',
          uploadUrl: `${MOCK_API}/mock-blob-upload/test-image.jpg`,
          readUrl: `${MOCK_API}/mock-blob-read/test-image.jpg`,
        }),
      }),
    );

    // Mock blob upload (PUT)
    await page.route('**/mock-blob-upload/**', (route: Route) =>
      route.fulfill({ status: 201 }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate: Dashboard → Catalog → Add Garment
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Add new garment' }).click();
    await expect(page.getByText('Add Garment')).toBeVisible({ timeout: 10_000 });

    // Step 1: Upload a photo
    const testImagePath = createTestImage('test-garment.jpg');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Verify photo preview appears
    await expect(page.locator('img[alt="Photo 1"]')).toBeVisible({ timeout: 5_000 });

    // Step 2: Fill in garment name
    await page.locator('#garment-name').fill('My Favorite Blue Shirt');

    // Step 3: Select category
    await page.locator('#garment-category').selectOption('top');

    // Step 4: Click Save
    await page.getByRole('button', { name: /save garment/i }).click();

    // Step 5: See success state
    await expect(page.getByText('Garment saved!')).toBeVisible({ timeout: 15_000 });

    // Step 6: Click "Back to Catalog"
    await page.getByRole('button', { name: /back to catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });
  });

  test('shows validation errors when form is incomplete', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /catalog/i }).click();
    await page.getByRole('button', { name: 'Add new garment' }).click();
    await expect(page.getByText('Add Garment')).toBeVisible({ timeout: 10_000 });

    // Add a photo but leave name and category empty, then click Save.
    // The name input has `required`, so the browser's native validation
    // prevents submission. We verify the form stays open (no success state).
    const testImagePath = createTestImage('test-validation.jpg');
    await page.locator('input[type="file"]').setInputFiles(testImagePath);
    await expect(page.locator('img[alt="Photo 1"]')).toBeVisible({ timeout: 5_000 });

    // Click save — browser validation should block it (name is required)
    await page.getByRole('button', { name: /save garment/i }).click();

    // Form should still be visible (not replaced by success state)
    await expect(page.getByText('Add Garment')).toBeVisible();
    await expect(page.getByText('Garment saved!')).not.toBeVisible();

    // Fill name but leave category empty — still fails
    await page.locator('#garment-name').fill('Test Shirt');
    await page.getByRole('button', { name: /save garment/i }).click();
    await expect(page.getByText('Garment saved!')).not.toBeVisible();
  });

  test('back button returns to catalog', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /catalog/i }).click();
    await page.getByRole('button', { name: 'Add new garment' }).click();
    await expect(page.getByText('Add Garment')).toBeVisible({ timeout: 10_000 });

    // Click back
    await page.getByRole('button', { name: /back to catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Journey 3: Daily Upload — Photo → Predict → Confirm → Wear Recorded
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Journey: Upload Daily Outfit @ui', () => {
  test('upload outfit photo → see predictions → confirm → wear recorded', async ({ page }) => {
    await mockAllApis(page);

    // Mock SAS URL
    await page.route('**/api/images/sas-url', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blobName: 'outfits/test-outfit.jpg',
          uploadUrl: `${MOCK_API}/mock-blob-upload/test-outfit.jpg`,
          readUrl: `${MOCK_API}/mock-blob-read/test-outfit.jpg`,
        }),
      }),
    );

    // Mock blob upload
    await page.route('**/mock-blob-upload/**', (route: Route) =>
      route.fulfill({ status: 201 }),
    );

    // Mock prediction — medium confidence → shows top-3 choices
    await page.route('**/api/wear/predict', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictionAuditId: 'pa-test-123',
          source: 'embedding_fallback',
          confidenceLevel: 'medium',
          predictions: [
            { garmentId: 'g1', garmentName: 'Blue Denim Jacket', confidence: 0.72 },
            { garmentId: 'g2', garmentName: 'White T-Shirt', confidence: 0.55 },
            { garmentId: 'g3', garmentName: 'Black Jeans', confidence: 0.41 },
          ],
        }),
      }),
    );

    // Mock confirm wear
    await page.route('**/api/wear/confirm', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'we-new-123', userId: 'test-user', garmentId: 'g1',
          outfitImageUrl: '', predictedGarmentId: 'g1',
          confidence: 0.72, confirmed: true,
          createdAt: new Date().toISOString(),
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to Today's Outfit
    await page.getByRole('button', { name: /today/i }).click();
    await expect(page.getByText("Today's Outfit")).toBeVisible({ timeout: 10_000 });

    // Upload a photo
    const testImagePath = createTestImage('test-outfit.jpg');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Should show "Analyzing your outfit…" briefly, then predictions
    await expect(page.getByText(/which garment are you wearing/i)).toBeVisible({ timeout: 15_000 });

    // Should see 3 prediction choices
    await expect(page.getByText('Blue Denim Jacket')).toBeVisible();
    await expect(page.getByText('White T-Shirt')).toBeVisible();
    await expect(page.getByText('Black Jeans')).toBeVisible();

    // Confirm: click "Blue Denim Jacket"
    await page.getByRole('button', { name: /Blue Denim Jacket/i }).click();

    // Should show confirmed state
    await expect(page.getByText(/wear recorded/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/upload another/i)).toBeVisible();
    await expect(page.getByText(/remove this outfit/i)).toBeVisible();
  });

  test('high confidence → confirm → wear recorded', async ({ page }) => {
    await mockAllApis(page);

    await page.route('**/api/images/sas-url', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blobName: 'outfits/high-conf.jpg',
          uploadUrl: `${MOCK_API}/mock-blob-upload/high-conf.jpg`,
          readUrl: `${MOCK_API}/mock-blob-read/high-conf.jpg`,
        }),
      }),
    );

    await page.route('**/mock-blob-upload/**', (route: Route) =>
      route.fulfill({ status: 201 }),
    );

    // High confidence prediction
    await page.route('**/api/wear/predict', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictionAuditId: 'pa-high-456',
          source: 'custom_vision',
          confidenceLevel: 'high',
          predictions: [
            { garmentId: 'g5', garmentName: 'Red Dress', confidence: 0.95 },
            { garmentId: 'g2', garmentName: 'White T-Shirt', confidence: 0.30 },
          ],
        }),
      }),
    );

    await page.route('**/api/wear/confirm', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'we-high-456', userId: 'test-user', garmentId: 'g5',
          outfitImageUrl: '', predictedGarmentId: 'g5',
          confidence: 0.95, confirmed: true,
          createdAt: new Date().toISOString(),
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /today/i }).click();

    const testImagePath = createTestImage('test-dress-outfit.jpg');
    await page.locator('input[type="file"]').setInputFiles(testImagePath);

    // High confidence → shows single match
    await expect(page.getByText(/we found a match/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Red Dress')).toBeVisible();
    await expect(page.getByText('95%')).toBeVisible();

    // Click confirm
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/wear recorded/i)).toBeVisible({ timeout: 10_000 });
  });

  test('high confidence → choose different item → see all predictions', async ({ page }) => {
    await mockAllApis(page);

    await page.route('**/api/images/sas-url', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blobName: 'outfits/diff.jpg',
          uploadUrl: `${MOCK_API}/mock-blob-upload/diff.jpg`,
          readUrl: `${MOCK_API}/mock-blob-read/diff.jpg`,
        }),
      }),
    );

    await page.route('**/mock-blob-upload/**', (route: Route) =>
      route.fulfill({ status: 201 }),
    );

    await page.route('**/api/wear/predict', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictionAuditId: 'pa-diff-789',
          source: 'custom_vision',
          confidenceLevel: 'high',
          predictions: [
            { garmentId: 'g5', garmentName: 'Red Dress', confidence: 0.92 },
            { garmentId: 'g2', garmentName: 'White T-Shirt', confidence: 0.40 },
            { garmentId: 'g3', garmentName: 'Black Jeans', confidence: 0.25 },
          ],
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /today/i }).click();

    await page.locator('input[type="file"]').setInputFiles(createTestImage('test-diff.jpg'));

    // High confidence shown
    await expect(page.getByText(/we found a match/i)).toBeVisible({ timeout: 15_000 });

    // Click "Choose a different item"
    await page.getByRole('button', { name: /choose a different item/i }).click();

    // Should now show medium confidence view with all 3 predictions
    await expect(page.getByText(/which garment are you wearing/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Red Dress')).toBeVisible();
    await expect(page.getByText('White T-Shirt')).toBeVisible();
    await expect(page.getByText('Black Jeans')).toBeVisible();
  });

  test('upload another button resets the flow', async ({ page }) => {
    await mockAllApis(page);

    await page.route('**/api/images/sas-url', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blobName: 'outfits/again.jpg',
          uploadUrl: `${MOCK_API}/mock-blob-upload/again.jpg`,
          readUrl: `${MOCK_API}/mock-blob-read/again.jpg`,
        }),
      }),
    );
    await page.route('**/mock-blob-upload/**', (route: Route) => route.fulfill({ status: 201 }));
    await page.route('**/api/wear/predict', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predictionAuditId: 'pa-again',
          source: 'custom_vision',
          confidenceLevel: 'high',
          predictions: [{ garmentId: 'g2', garmentName: 'White T-Shirt', confidence: 0.90 }],
        }),
      }),
    );
    await page.route('**/api/wear/confirm', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'we-again', userId: 'test-user', garmentId: 'g2',
          outfitImageUrl: '', predictedGarmentId: 'g2',
          confidence: 0.90, confirmed: true,
          createdAt: new Date().toISOString(),
        }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /today/i }).click();

    // Upload → confirm
    await page.locator('input[type="file"]').setInputFiles(createTestImage('test-again.jpg'));
    await expect(page.getByText(/we found a match/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/wear recorded/i)).toBeVisible({ timeout: 10_000 });

    // Click "Upload Another"
    await page.getByRole('button', { name: /upload another/i }).click();

    // Should be back to the initial upload state
    await expect(page.getByText(/tap to take a photo/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Journey 4: History Page — View timeline, see outfit entries
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Journey: View Wear History @ui', () => {
  test('navigate to history and see wear events with images', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Navigate to History
    await page.getByRole('button', { name: /history/i }).click();

    // Should show history page
    await expect(page.getByText('Outfit History')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Your wear timeline')).toBeVisible();

    // Should show wear events
    await expect(page.getByText('White T-Shirt')).toBeVisible();
    await expect(page.getByText('Black Jeans')).toBeVisible();
    await expect(page.getByText('Blue Denim Jacket')).toBeVisible();

    // Should show confidence percentages
    await expect(page.getByText('92%')).toBeVisible();
  });

  test('history shows empty state when no events', async ({ page }) => {
    await mockAllApis(page);

    // Override wear history with empty
    await page.route('**/api/wear/history**', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      }),
    );

    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /history/i }).click();

    await expect(page.getByText(/no outfit history yet/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Journey 5: Full cross-page navigation flow
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Journey: Full App Navigation @ui', () => {
  test('navigate through all pages: Dashboard → Catalog → Add → Back → Today → History', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // 1. Dashboard (default)
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Items')).toBeVisible();
    await expect(page.getByText('6')).toBeVisible(); // totalGarments

    // 2. Navigate to Catalog
    await page.getByRole('button', { name: /catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });

    // Wait for garment names to render (images may lazy-load)
    await expect(page.getByText('Blue Denim Jacket').first()).toBeVisible({ timeout: 10_000 });

    // 3. Navigate to Add Garment
    await page.getByRole('button', { name: 'Add new garment' }).click();
    await expect(page.getByText('Add Garment')).toBeVisible({ timeout: 10_000 });

    // 4. Back to Catalog
    await page.getByRole('button', { name: /back to catalog/i }).click();
    await expect(page.getByText('My Catalog')).toBeVisible({ timeout: 10_000 });

    // 5. Navigate to Today
    await page.getByRole('button', { name: /today/i }).click();
    await expect(page.getByText("Today's Outfit")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/tips for best results/i)).toBeVisible();

    // 6. Navigate to History
    await page.getByRole('button', { name: /history/i }).click();
    await expect(page.getByText('Outfit History')).toBeVisible({ timeout: 10_000 });

    // 7. Back to Dashboard
    await page.getByRole('button', { name: /dashboard/i }).click();
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Journey 6: Dashboard stats rendering with real data
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Journey: Dashboard Interactive Stats @ui', () => {
  test('dashboard shows all stat sections with real data', async ({ page }) => {
    await mockAllApis(page);
    await page.goto(LOCAL_BASE, { waitUntil: 'networkidle' });

    // Verify title and stats
    await expect(page.getByText('My Wardrobe')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Items')).toBeVisible();
    await expect(page.getByText('Total Wears')).toBeVisible();

    // Most worn section
    await expect(page.getByText('Most Worn')).toBeVisible();
    await expect(page.getByText('Running Shoes')).toBeVisible();

    // Forgotten garments section  
    await expect(page.getByText(/forgotten/i)).toBeVisible();
  });
});

