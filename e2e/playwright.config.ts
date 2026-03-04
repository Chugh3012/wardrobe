import { defineConfig, devices } from '@playwright/test';

/**
 * Wardrobe Tracker — E2E Test Config
 *
 * Environment variables (set in .env or CI):
 *   AZURE_SUBSCRIPTION_ID  — Azure subscription
 *   AZURE_RESOURCE_GROUP   — e.g. rg-wardrobe-dev
 *   SWA_URL                — e.g. https://swa-wardrobe-dev.azurestaticapps.net
 *   FUNC_URL               — e.g. https://func-wardrobe-dev.azurewebsites.net
 *   ENVIRONMENT_NAME       — dev | staging | prod (default: dev)
 *
 * UI page rendering tests run against a local Vite preview server
 * (built from frontend/), since the deployed SWA uses EasyAuth that
 * redirects unauthenticated access at the HTTP level (302) before the
 * React app loads. The SWA-specific tests (auth redirect, PWA manifest,
 * security headers, SPA fallback) still run against the live SWA URL.
 */

const LOCAL_UI_PORT = 5173;
const LOCAL_UI_BASE = `http://localhost:${LOCAL_UI_PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 60_000,
  use: {
    baseURL: process.env.SWA_URL || 'http://localhost:4280',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'azure-resources',
      testMatch: /azure-resources\.spec\.ts/,
    },
    {
      name: 'api-endpoints',
      testMatch: /api-endpoints\.spec\.ts/,
    },
    {
      name: 'ui-mobile',
      testMatch: /(ui-.*|user-journeys)\.spec\.ts/,
      use: {
        ...devices['iPhone 14'],
        baseURL: LOCAL_UI_BASE,
        serviceWorkers: 'block',
      },
    },
    {
      name: 'ui-desktop',
      testMatch: /(ui-.*|user-journeys)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: LOCAL_UI_BASE,
        serviceWorkers: 'block',
      },
    },
    /* Real backend tests — only run locally with `--project=real-backend`.
     * These hit live Azure services (Cosmos DB, Blob Storage) and require
     * the real Functions backend running on localhost:7071. */
    {
      name: 'real-backend',
      testMatch: /real-backend\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: LOCAL_UI_BASE,
        serviceWorkers: 'block',
      },
    },
  ],
  /* Start Vite preview server for UI tests.
   * In CI, the dist/ is pre-built (downloaded artifact) — skip the build.
   * Locally, build first then preview.
   * Disabled when running API/Azure smoke tests (FUNC_URL is set). */
  webServer: process.env.FUNC_URL ? undefined : {
    command: process.env.CI
      ? 'cd ../frontend && npx vite preview --port 5173'
      : 'cd ../frontend && npm run build && npx vite preview --port 5173',
    port: LOCAL_UI_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
