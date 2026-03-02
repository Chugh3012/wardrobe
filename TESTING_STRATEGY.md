# Wardrobe Tracker — Testing Strategy

This document defines the testing approach for the Wardrobe Tracker project. It must be established before any feature work begins (Issue #0) and referenced by all subsequent issues.

---

## 1) What "Phone-Testable" Means

Every feature in this project must be verifiable from a real phone browser (or installed PWA) without relying on desktop-only tools. Specifically:

- **Primary test device: iOS / Safari.** The lead developer uses an iPhone, so Safari on iOS is the primary manual-test target. All phone-test checklists must pass on iOS Safari before a feature is considered done.
- **The feature works end-to-end** when accessed from a mobile browser (Safari on iOS primarily; Chrome on Android as secondary).
- **No desktop-only steps** are required to complete the user-facing validation — server-side log verification may use a desktop portal (e.g., Azure Portal), but the trigger action must happen from a phone.
- **Touch interactions** (tap, swipe, long-press) behave correctly; no hover-only affordances block functionality.
- **iOS-specific considerations:** Safari's PWA limitations (no push notifications, limited background sync, ITP cookie policy) must be accounted for in feature design and testing.

---

## 2) Testing Layers

### 2.1 Unit Tests

- **Scope:** Individual functions, utilities, data model validation, and business logic (e.g., confidence threshold checks, wear count increment logic).
- **Tools:** [Jest](https://jestjs.io/) for TypeScript/JavaScript backend (Azure Functions) and frontend code.
- **Run:** Locally via `npm test` and in CI via GitHub Actions on every pull request.
- **Convention:** Test files are co-located with source files using the `*.test.ts` / `*.test.js` naming pattern.

### 2.2 Integration Tests

- **Scope:** API endpoint behavior, database operations (Cosmos DB CRUD), Blob Storage upload/retrieve, and AI service call/response contracts.
- **Tools:** [Supertest](https://github.com/ladjs/supertest) (or direct HTTP calls) against a locally running Azure Functions host (`func start`) or a staging environment.
- **Run:** Locally via `npm run test:integration` and in CI against a staging deployment.
- **Convention:** Integration test files use the `*.integration.test.ts` naming pattern.

### 2.3 End-to-End (E2E) / Phone Tests

- **Scope:** Full user flows executed from a phone browser — garment creation, daily upload, prediction, confirmation, and dashboard viewing.
- **Tools:** Manual execution using the **Phone-Test Checklist Template** below. Optionally supplemented with [Playwright](https://playwright.dev/) running in mobile emulation mode (use `iPhone 14` or `iPhone 15` device profile as primary) for automated regression in CI.
- **Run:** Manually on a real iOS device (iPhone + Safari) for milestone validations; Playwright mobile emulation in CI for regression.
- **iOS priority:** Real-device manual testing must be done on iOS Safari first. Playwright CI emulation should use the `iPhone 14` / `iPhone 15` WebKit profile.

### 2.4 API Smoke Tests (from Mobile Browser)

- **Scope:** Verify backend API endpoints are reachable and returning expected responses.
- **How:** Navigate directly to API URLs from a phone browser (e.g., `https://<functions-app>/api/health`) and confirm HTTP 200 + JSON response body.
- **Tools:** Phone browser address bar (for GET endpoints) and a lightweight in-app API test page (for POST endpoints) deployed as part of the Static Web App.

### 2.5 PWA Install Verification

- **Scope:** Confirm the app is installable as a Progressive Web App on phone home screens.
- **How:** Open the deployed URL in Safari (iOS — primary) or Chrome (Android), trigger "Add to Home Screen", and verify the app launches in standalone mode.
- **Checklist items:** `manifest.json` loads without errors, service worker registers, offline shell loads, app icon appears on home screen.
- **iOS-specific checks:** Verify `apple-touch-icon` meta tags, `apple-mobile-web-app-capable` meta tag, status bar styling, and that the app opens in standalone mode (not a Safari tab).

### 2.6 Security Tests

- **Scope:** Authentication middleware, authorisation boundaries, input validation on security-sensitive paths (SAS tokens, content-type restrictions), and header spoofing resistance.
- **Tools:** Vitest (co-located `*.test.ts` files), same as unit tests.
- **Run:** Locally via `npm test` and in CI alongside all other unit tests.

#### What is covered

| Area | Tests | File |
|------|-------|------|
| Base64 `x-ms-client-principal` decoding | Valid extraction, UUID userId, missing/null userId, non-string userId, invalid base64, non-JSON payload, unsafe characters, length limits | `authMiddleware.test.ts` |
| Plain-text header fallback | Ignored when `REQUIRE_AUTH=true`; accepted only when `REQUIRE_AUTH=false`; base64 takes priority when both headers are present | `authMiddleware.test.ts` |
| SAS content-type restrictions | Default to `image/jpeg`, accept `image/png` / `image/webp`, reject `text/plain` / `application/octet-stream` | `images.test.ts` |
| Per-function auth enforcement | Every function test file uses `encodeClientPrincipal()` helper to supply a valid base64 `x-ms-client-principal` header | `*.test.ts` (all 7 function files) |

#### Test patterns

- **`encodeClientPrincipal(userId)`** — A shared helper in each test file that builds a `ClientPrincipal` JSON object and base64-encodes it. This mirrors the header that Azure Static Web Apps EasyAuth injects.
- **Negative tests** — Specifically test spoofed, malformed, and missing auth headers to ensure the middleware rejects them.
- **Environment-aware tests** — `REQUIRE_AUTH` environment variable is toggled in tests to verify both strict and relaxed modes.

---

## 3) Testing Tools Summary

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Backend & frontend unit tests (incl. security tests) |
| Integration | Supertest / HTTP client | API endpoint & service integration |
| E2E (Automated) | Playwright (mobile emulation) | Automated regression in CI |
| E2E (Manual) | Phone browser + checklist | Milestone phone-test validation |
| API Smoke | Phone browser / in-app test page | Verify endpoints are reachable |
| PWA | Phone browser | Verify install & standalone mode |
| Debugging | Safari Web Inspector (primary) / Chrome Remote Debug | Inspect phone browser remotely |
| Observability | Application Insights (Azure Portal) | Verify telemetry after phone actions |

### Remote Debugging Setup

For diagnosing issues during phone testing:

1. **iOS (primary):** Connect iPhone via USB (or Lightning), enable Web Inspector in Settings → Safari → Advanced. On macOS open Safari → Develop menu to inspect the phone's Safari tabs. This is the primary debugging workflow.
2. **Android (secondary):** Connect phone via USB, enable USB Debugging, open `chrome://inspect` on desktop Chrome to inspect the phone's browser tabs.

---

## 4) Phone-Test Checklist Template

> **Copy this template into every issue's "Phone-Test Validation" section.** Fill in the issue-specific steps and expected results.

```markdown
### Phone-Test Checklist — Issue #[NUMBER]: [TITLE]

**Device:** [e.g., iPhone 15 / iPhone 14 / Pixel 7]
**Browser:** [e.g., Safari 17 / Chrome 120]
**Date:** [YYYY-MM-DD]
**Tester:** [Name]

#### Pre-Conditions
- [ ] App is deployed to staging/production URL
- [ ] Tester is signed in (if authentication is required)
- [ ] Test data is prepared (describe any setup)

#### Test Steps
| # | Action | Expected Result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 1 | [Describe action] | [Describe expected result] | [ ] | |
| 2 | [Describe action] | [Describe expected result] | [ ] | |
| 3 | [Describe action] | [Describe expected result] | [ ] | |

#### Accessibility & UX Checks
- [ ] All interactive elements are reachable by touch (no hover-only)
- [ ] Text is readable without zooming (minimum 16px body text)
- [ ] Forms and buttons have adequate tap targets (minimum 44×44px)
- [ ] Page loads within 3 seconds on a 4G connection

#### Result
- **Overall:** [ ] Pass / [ ] Fail
- **Blocking issues:** [List any, or "None"]
- **Notes:** [Any observations]
```

---

## 5) CI/CD Integration

- **GitHub Actions** runs unit and integration tests on every pull request targeting `main`.
- Playwright mobile-emulation E2E tests run on staging deployments after merge to `main`.
- Phone-test checklists are completed manually for milestone validations (e.g., Issue #15 end-to-end flow).

### Suggested GitHub Actions Workflow

```yaml
name: Test
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:integration
```

---

## 6) Definition of Done (Testing Gate)

A feature issue is considered **done** only when:

1. ✅ Unit tests pass locally and in CI.
2. ✅ Integration tests pass (where applicable).
3. ✅ The phone-test checklist is completed and all steps pass on iOS Safari (primary device). Android testing is optional but encouraged.
4. ✅ No critical accessibility or UX issues are found during phone testing.
5. ✅ Test results are documented in the issue or pull request.

---

## 7) Phone-Test Checklist — Issue #0: Define Testing Framework & Phone-Testing Strategy

**Device:** Any smartphone
**Browser:** Any modern mobile browser (Chrome, Safari, Firefox)

#### Pre-Conditions
- [ ] This document (`TESTING_STRATEGY.md`) is committed to the repository
- [ ] Document is viewable via the GitHub repository URL on mobile

#### Test Steps
| # | Action | Expected Result | Pass/Fail | Notes |
|---|--------|-----------------|-----------|-------|
| 1 | Open `TESTING_STRATEGY.md` on a phone browser via the GitHub repo URL | Document renders fully, all sections visible | [ ] | |
| 2 | Scroll through the entire document | All headings, tables, and code blocks are readable | [ ] | |
| 3 | Verify the Phone-Test Checklist Template section | Template is visible and copy-pasteable | [ ] | |
| 4 | Tap any external tool links (Jest, Playwright, Supertest) | Links open to the correct tool documentation pages | [ ] | |

#### Result
- **Overall:** [ ] Pass / [ ] Fail
- **Blocking issues:** None expected
- **Notes:** This is the foundational testing document; all future issues reference it.
