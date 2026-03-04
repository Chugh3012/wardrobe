---
description: 'Playwright E2E test patterns and conventions'
applyTo: 'e2e/**/*.ts'
---

# Playwright E2E Testing Conventions

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature - Specific Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display garment catalog', async ({ page }) => {
    await test.step('Navigate to catalog', async () => {
      await page.getByRole('link', { name: 'Catalog' }).click();
    });

    await test.step('Verify garments are listed', async () => {
      await expect(page.getByRole('main')).toContainText('Garments');
    });
  });
});
```

## Projects

This project uses 4 Playwright projects:
- `azure-resources` — verify Azure infrastructure
- `api-endpoints` — backend API smoke tests
- `ui-desktop` — desktop viewport UI tests
- `ui-mobile` — mobile viewport UI tests

## Locators

- Prioritize role-based locators: `getByRole`, `getByLabel`, `getByText`.
- Use `test.step()` to group interactions for readability.
- Never use CSS selectors or XPath when role-based locators work.

## Assertions

- Use auto-retrying web-first assertions: `await expect(locator).toHaveText()`.
- Avoid `expect(locator).toBeVisible()` unless specifically testing visibility changes.
- Use `toMatchAriaSnapshot` for verifying accessibility tree structure.

## Rules

- Rely on Playwright's built-in auto-waiting — avoid hard-coded waits or increased timeouts.
- File naming: `<feature>.spec.ts` (e.g., `user-journeys.spec.ts`).
- One test file per major feature or page.
- Capture screenshots and traces on failure for debugging.
