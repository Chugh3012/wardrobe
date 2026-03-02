# Wardrobe Tracker — Issue Breakdown

This document breaks down the High-Level Design (HLD) from `README.md` into individual, trackable issues grouped by phase. Each issue includes a description, acceptance criteria, and a phone-testable validation step.

---

## Phase 0 — Foundation

### Issue #0: Define Testing Framework & Phone-Testing Strategy

- [x] **Status:** Done

**Deliverable:** [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md)

**Description:**
Establish the testing approach for the entire project before any feature work begins. This includes deciding how each feature will be verified from a phone browser, what tooling will be used, and what the definition of "phone-testable" means for this project.

**Acceptance Criteria:**
- [x] A testing strategy document (or section in this file) exists describing the approach — see [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).
- [x] Team agrees on tools — Jest (unit), Supertest (integration), Playwright mobile emulation (E2E), Chrome/Safari DevTools remote debug, manual phone-test checklists.
- [x] A reusable phone-test checklist template is defined and used in all subsequent issues — see §4 of `TESTING_STRATEGY.md`.
- [x] Strategy covers: functional testing, API smoke tests from mobile browser, and PWA install verification — see §2 of `TESTING_STRATEGY.md`.

**Phone-Test Validation:**
> Open the testing strategy document on a phone browser and confirm the checklist is readable and all linked tools/URLs are accessible from mobile.

---

## Phase 1 — MVP

### Issue #1: Setup Azure Static Web App (Frontend PWA)

- [x] **Status:** Done

**Description:**
Deploy a mobile-first Progressive Web App (PWA) shell hosted on Azure Static Web Apps. This is the entry point users will interact with from their phones. The shell should load fast, be installable as a home-screen app, and serve as the foundation for all future UI features.

**Acceptance Criteria:**
- Azure Static Web App resource is provisioned and publicly accessible via a URL.
- App is mobile-first (responsive layout, touch-friendly).
- A valid `manifest.json` and service worker are present to enable PWA installation.
- App loads without errors on a mobile browser.
- Deployment pipeline (e.g., GitHub Actions) is configured for the Static Web App.

**Phone-Test Validation:**
> Open the deployed URL on a phone browser, verify the PWA install prompt appears (or "Add to Home Screen" option is available), and confirm the app loads without errors.

---

### Issue #1.5: Provision Azure Resource Group & Baseline Infrastructure (Bicep + OIDC)

- [x] **Status:** Done

**Description:**
Provision the shared Azure resource group and the Static Web App resource using Bicep (Infrastructure as Code). All GitHub Actions → Azure authentication must use **OIDC Workload Identity Federation** — no long-lived client secrets or passwords are stored in GitHub. This unblocks Issue #1's CI pipeline and establishes the extensible infra scaffold that Issues #2–#14 will add modules to.

**Security requirements:**
- GitHub Actions authenticates to Azure via **OIDC federated credentials** only. No `AZURE_CLIENT_SECRET` is stored anywhere; only the non-secret triple `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` is stored in GitHub Actions secrets.
- The service principal used by CI is granted **only the minimum RBAC roles needed** (e.g. `Owner` scoped to the wardrobe resource group, not the whole subscription — `Owner` is required because the Bicep templates create RBAC role assignments).
- All future secret values (connection strings, API keys) must be placed in Azure Key Vault — never in Bicep parameter files or GitHub secrets. Bicep modules reference Key Vault via `existing` resource + `getSecret()`.
- Bicep templates contain **no hardcoded subscription IDs, tenant IDs, or secret values**.
- Resource tags (`project`, `environment`, `managedBy`) are enforced on every resource so cost and ownership are always traceable.

**Acceptance Criteria:**
- `infra/main.bicep` defines a subscription-scoped deployment that creates the `rg-wardrobe-<env>` resource group and delegates to resource modules.
- `infra/modules/static-web-app.bicep` provisions the Azure Static Web App (Free SKU) and outputs the deployment token name (the token itself is read from Azure, never stored in Bicep state).
- `infra/main.bicepparam` captures all non-secret parameters (location, environment name, tags); no secrets present.
- `.github/workflows/provision-infra.yml` provisions infra on manual dispatch (`workflow_dispatch`) and on push to `main` when `infra/**` files change.
- The workflow uses `azure/login@v2` with `client-id`, `tenant-id`, and `subscription-id` (OIDC) — **no `creds` JSON blob, no client secret**.
- After a successful `az deployment sub create` run, the workflow reads the SWA deployment token via `az staticwebapp secrets list` and writes it to the `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub Actions secret using the GitHub API (requires `secrets: write` permission scoped to the workflow).
- One-time setup steps are documented in `infra/README.md`: creating the Entra app registration, configuring the federated credential, and granting the minimum RBAC role.

**One-time manual setup (documented in `infra/README.md`):**
1. Create an Entra app registration (service principal) for GitHub Actions.
2. Add a **federated credential** on that app targeting `repo:Chugh3012/wardrobe:ref:refs/heads/main` (and optionally PRs).
3. Grant the service principal `Owner` on the resource group (required because Bicep templates create RBAC role assignments for managed identities).
4. Store `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` as GitHub Actions secrets (these are non-secret identifiers, but kept in secrets for flexibility).

**Validation:**
> Run `gh workflow run provision-infra.yml` (or push a change to `infra/`). Verify in the Azure Portal that `rg-wardrobe-dev` exists, the Static Web App resource is present, and the `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret is updated. Confirm no client secrets appear in workflow logs or Bicep files.

---

### Issue #2: Setup Azure Functions Backend API

- [x] **Status:** Done

**Description:**
Deploy an Azure Functions app using the Consumption plan to serve as the backend API for the wardrobe tracker. Include a health/ping endpoint to verify the deployment is live. All subsequent API endpoints (garments, wear events, stats) will be added to this Functions app.

**Acceptance Criteria:**
- Azure Functions app is provisioned on the Consumption plan.
- A `GET /api/health` (or `GET /api/ping`) endpoint is deployed and returns HTTP 200 with a JSON body (e.g., `{ "status": "ok" }`).
- CORS is configured to allow requests from the Static Web App origin.
- Deployment pipeline is configured for the Functions app.

**Phone-Test Validation:**
> Navigate to `https://<functions-app>/api/health` from a phone browser and verify it returns a 200 OK response with the expected JSON body.

---

### Issue #3: Setup Azure Blob Storage for Images

- [x] **Status:** Done

**Description:**
Configure an Azure Blob Storage account and container to store garment catalog photos and daily outfit images. Images should be accessible via SAS tokens or signed URLs to enforce least-privilege access. This storage layer will be used by both the garment onboarding flow and the daily wear prediction flow.

**Acceptance Criteria:**
- Azure Blob Storage account is provisioned.
- A container for garment/outfit images is created with private access (no anonymous public read).
- API endpoint (or utility function) exists to generate short-lived SAS tokens for image upload and read access.
- Images uploaded via API are stored in Blob Storage and retrievable via SAS URL.
- Blob lifecycle management rules are configured (e.g., archival after 90 days).

**Phone-Test Validation:**
> Use the app on a phone to upload a test image (e.g., via the garment creation flow or a dedicated test endpoint). Verify the image is stored in Blob and can be retrieved via the returned SAS URL when opened in the phone browser.

---

### Issue #4: Setup Cosmos DB & Data Models (Garment, WearEvent, PredictionAudit)

- [x] **Status:** Done

**Description:**
Provision an Azure Cosmos DB (NoSQL, serverless) account and create the containers for the three core data models defined in the HLD. These models form the data backbone of the wardrobe tracker.

Data models to implement:

**`Garment`**
- `id`, `userId`, `name`, `category` (dress/top/etc.), `catalogImageUrls[]`, `wearCount`, `createdAt`, `updatedAt`

**`WearEvent`**
- `id`, `userId`, `garmentId`, `outfitImageUrl`, `predictedGarmentId`, `confidence`, `confirmed` (bool), `createdAt`

**`PredictionAudit`**
- `id`, `userId`, `inputImageUrl`, `topKPredictions[]`, `userFinalSelection`, `createdAt`

**Acceptance Criteria:**
- Cosmos DB (NoSQL) account is provisioned in serverless mode.
- Containers for `Garment`, `WearEvent`, and `PredictionAudit` are created with appropriate partition keys (e.g., `/userId`).
- Data model schemas (or TypeScript interfaces/classes) are defined in the codebase.
- Basic CRUD operations (at minimum Create and Read) are implemented and tested for each container.
- Connection is secured via Managed Identity (no hardcoded connection strings).

**Phone-Test Validation:**
> Use the app or call the API from a phone browser to create a new garment (e.g., via `POST /garments`). Verify the response returns the saved Cosmos DB document with an `id`, `createdAt`, and all submitted fields.

---

### Issue #5: Implement `POST /garments` — Create Garment & Catalog Photos

- [x] **Status:** Done

**Description:**
Implement the `POST /garments` endpoint that allows users to add a new garment to their catalog. Each garment requires a name, category, and 3–8 onboarding photos. Photos should be uploaded to Blob Storage and their URLs stored in the `Garment` document in Cosmos DB.

**Acceptance Criteria:**
- `POST /garments` accepts: `name`, `category`, and 3–8 photo files (or pre-uploaded Blob URLs).
- Uploaded photos are stored in Azure Blob Storage.
- A `Garment` document is created in Cosmos DB with `catalogImageUrls[]` populated.
- Request is authenticated; garment is associated with the authenticated `userId`.
- Returns the created `Garment` document (HTTP 201).
- Returns HTTP 400 if fewer than 3 or more than 8 photos are provided.
- Onboarding guidance is enforced or surfaced (good light, front/full view, plain background).

**Phone-Test Validation:**
> Open the app on a phone, navigate to the catalog section, add a new garment with a name, category, and 3+ photos taken or selected from the phone. Verify the garment appears in the catalog after submission.

---

### Issue #6: Implement `GET /garments` — List Garments

- [x] **Status:** Done

**Description:**
Implement the `GET /garments` endpoint that returns a paginated list of all garments belonging to the authenticated user. The response should include enough information to render a garment thumbnail list (name, category, primary image URL, wear count).

**Acceptance Criteria:**
- `GET /garments` returns a list of garments for the authenticated user.
- Response includes at minimum: `id`, `name`, `category`, `wearCount`, and a thumbnail image URL (first catalog image SAS URL or CDN URL).
- Results are paginated or limited to a reasonable page size.
- Returns HTTP 200 with an empty array if the user has no garments.
- Request is authenticated; only returns the authenticated user's garments.

**Phone-Test Validation:**
> Open the catalog page on a phone after adding garments via Issue #5. Verify the list displays previously added garments with their thumbnails, names, and wear counts.

---

### Issue #7: Implement `POST /wear/predict` — Upload Daily Outfit Image & Return Top Matches

- [x] **Status:** Done

**Description:**
Implement the `POST /wear/predict` endpoint that accepts a daily outfit photo from the user, stores it in Blob Storage, sends it to the AI vision service, and returns the top predicted garment matches with confidence scores. A `PredictionAudit` record is created for every prediction.

**Acceptance Criteria:**
- `POST /wear/predict` accepts an outfit image upload.
- Image is stored in Azure Blob Storage.
- Image is sent to Azure AI Custom Vision (or fallback vision service) for classification.
- Response returns top predicted garment(s) with confidence scores.
- A `PredictionAudit` document is created in Cosmos DB with the input image and top-K predictions.
- Returns HTTP 200 with predictions array; each item includes `garmentId`, `garmentName`, and `confidence`.
- Request is authenticated.

**Phone-Test Validation:**
> On a phone, use the app to take or upload a photo of a cataloged outfit. Verify the app returns the predicted garment match(es) with confidence percentages displayed.

---

### Issue #8: Implement `POST /wear/confirm` — Confirm/Correct Match & Increment Wear Count

- [x] **Status:** Done

**Description:**
Implement the `POST /wear/confirm` endpoint that records the user's confirmation or correction of a prediction. Wear count increments on `confirmed = true` only. Corrections are stored in the `PredictionAudit` record for future retraining.

**Acceptance Criteria:**
- `POST /wear/confirm` accepts: `predictionAuditId`, `confirmedGarmentId`, and `confirmed` (bool).
- If `confirmed = true`: a `WearEvent` is created and the `Garment.wearCount` is incremented.
- If `confirmed = false` (correction): the `PredictionAudit.userFinalSelection` is updated with the corrected `garmentId`; a `WearEvent` is still created for the corrected garment.
- Wear count is **never** incremented automatically without a user confirmation action.
- Returns HTTP 200 with the updated `WearEvent`.
- Request is authenticated.

**Phone-Test Validation:**
> On a phone, after a prediction (Issue #7): tap "Confirm" and verify the wear count for that garment increments by 1. Then upload another photo, tap "Choose different item", select the correct garment, and verify the correction is saved and the correct garment's wear count increments.

---

### Issue #9: Implement `GET /stats/summary` — Dashboard Stats

- [x] **Status:** Done

**Description:**
Implement the `GET /stats/summary` endpoint that returns aggregated wear statistics for the authenticated user's wardrobe. This powers the dashboard view shown at the end of the end-to-end flow.

**Acceptance Criteria:**
- `GET /stats/summary` returns:
  - Total wear count per garment.
  - Last worn date per garment.
  - Most-worn garment(s).
  - Least-worn garment(s).
- Response is scoped to the authenticated user.
- Returns HTTP 200 with a structured summary object.
- Dashboard UI displays most-worn and least-worn garments with counts and dates.

**Phone-Test Validation:**
> Open the dashboard page on a phone after confirming several wear events. Verify the most-worn and least-worn garments are shown with accurate wear counts and last-worn dates.

---

### Issue #10: Integrate Azure AI Custom Vision for Garment Classification

- [x] **Status:** Done

**Description:**
Train an Azure AI Custom Vision model on the garment catalog photos and integrate it into the `POST /wear/predict` endpoint. Each garment's catalog images (from Issue #5) serve as training data. The model must be retrained when new garments are added to the catalog.

**Acceptance Criteria:**
- An Azure AI Custom Vision project is provisioned and connected to the Functions backend.
- Training pipeline exists: when a garment's catalog photos are uploaded, they are submitted to Custom Vision as training images tagged with the `garmentId`.
- The model is trained and published to a prediction endpoint.
- `/wear/predict` calls the Custom Vision prediction endpoint and maps results to `Garment` records.
- A retrain trigger exists (manual or automated) for when new garments are added.
- Custom Vision API key is stored in Key Vault; accessed via Managed Identity.

**Phone-Test Validation:**
> On a phone, upload a photo of a known cataloged garment (one that was onboarded with catalog photos). Verify the app returns the correct garment as the top prediction with a confidence percentage.

---

### Issue #11: Add Fallback — Azure AI Vision Embeddings & Similarity Search

- [x] **Status:** Done

**Description:**
When Custom Vision returns a prediction below the confidence threshold (e.g., <85%), fall back to Azure AI Vision image embeddings combined with cosine similarity search across catalog image embeddings. This improves robustness for ambiguous or novel photos. Pre-computed embeddings for catalog images should be stored in Cosmos DB (or a vector index).

**Acceptance Criteria:**
- Confidence threshold (default: 85%) is configurable via environment variable / Key Vault.
- When Custom Vision confidence is below the threshold, the fallback embedding similarity search is invoked.
- Catalog image embeddings are pre-computed and stored when garments are onboarded.
- Fallback returns top-3 candidate garments ranked by cosine similarity.
- Response from `/wear/predict` includes a `source` field: `"custom_vision"` or `"embedding_fallback"`.
- Fallback logic is unit-tested.

**Phone-Test Validation:**
> On a phone, upload an ambiguous photo (e.g., partially visible garment, poor lighting). Verify the app displays a top-3 alternatives list rather than a single high-confidence match, and that the UI indicates lower confidence.

---

### Issue #12: Implement Confidence-Based UX Guardrails

- [x] **Status:** Done

**Description:**
Implement the accuracy and UX guardrails defined in README §8 to prevent silent data corruption and improve user experience. These guardrails govern when to auto-suggest vs. show alternatives, and enforce data quality during garment onboarding.

**Acceptance Criteria:**
- Wear count is **never** auto-incremented below the 85% confidence threshold; user confirmation is always required.
- When confidence is medium (configurable range, e.g., 60–84%), the UI shows top-3 match options for user selection.
- When confidence is high (≥85%), the UI shows the single top match with a prominent "Confirm" button.
- User corrections (choosing a different garment) are saved to `PredictionAudit.userFinalSelection` for future retraining.
- During garment onboarding, the app surfaces photo guidance: good lighting, front/full view, plain background.
- All thresholds are configurable (not hardcoded in business logic).

**Phone-Test Validation:**
> On a phone, upload a low-confidence image and verify the app shows a top-3 choices UI without a "Confirm" auto-action. Then upload a high-confidence image of a cataloged garment and verify the app shows a single match with a "Confirm" button.

---

### Issue #13: Setup Identity & Security (Entra External ID, Managed Identity, Key Vault)

- [x] **Status:** Done

**Description:**
Configure end-to-end authentication and secrets management. Users sign in via Microsoft Entra External ID. Service-to-service calls use Managed Identity. All secrets (Cosmos DB keys, Blob connection strings, Custom Vision keys) are stored in Azure Key Vault. Image access is gated by short-lived SAS tokens.

**Acceptance Criteria:**
- Microsoft Entra External ID (or equivalent B2C) is configured for user sign-in and sign-out.
- The frontend integrates with the identity provider; authenticated user's `userId` is available in all API requests.
- Azure Functions use Managed Identity to access Cosmos DB, Blob Storage, Key Vault, and AI services — no hardcoded secrets.
- All secrets are stored in Key Vault; local development uses environment variables or Key Vault references.
- SAS tokens for image access are short-lived (e.g., 1-hour expiry).
- Unauthenticated requests to protected API endpoints return HTTP 401.

**Phone-Test Validation:**
> Open the app on a phone, sign in with a test account, perform an authenticated action (e.g., view garments). Sign out and verify the session is cleared. Verify that attempting to access the API without a token from the phone browser returns a 401 response.

---

### Issue #13.5: Security Hardening & Implementation Gap Remediation

- [x] **Status:** Done

**Description:**
A full audit of Issues #0–#13 revealed security vulnerabilities and implementation gaps that must be addressed before the app is exposed to real users. This issue captures every gap found, prioritised by severity. Items marked 🔴 are exploitable in the current codebase; items marked 🟡 are defence-in-depth improvements; items marked 🟢 are functional gaps (not security) that were accepted in earlier issues but still need finishing.

---

#### 🔴 Critical — Exploitable Security Gaps

**S1. `POST /api/images/sas-url` has no authentication check**
The SAS-URL endpoint never calls `extractUserId` and never checks `REQUIRE_AUTH`. Any unauthenticated caller can generate upload and read SAS tokens for **any** blob path, including paths belonging to other users.
- **File:** `backend/src/functions/images.ts`
- **Fix:** Add the same `extractUserId` + `isAuthRequired` guard used by every other protected endpoint.

**S2. Blob-name path traversal — no per-user scoping or sanitisation**
The `blobName` parameter in `POST /api/images/sas-url` accepts arbitrary strings (e.g. `../../other-container/secret`). There is no validation that the blob name starts with the authenticated user's prefix or that it contains only safe characters.
- **File:** `backend/src/functions/images.ts`
- **Fix:** Validate `blobName` against a pattern (e.g. `^[a-zA-Z0-9._/-]{1,256}$`), reject `..` sequences, and prefix every blob name with `{userId}/` so users can only access their own blobs.

**S3. IDOR on `POST /api/wear/confirm` — garment ownership not verified**
`confirmedGarmentId` is accepted from the request body without verifying that the garment belongs to the authenticated user. User A can increment the wear count on User B's garment by passing User B's garment ID.
- **File:** `backend/src/functions/postWearConfirm.ts` (line ~129)
- **Fix:** Before calling `incrementWearCount`, call `readGarment(confirmedGarmentId, userId)` and return 404 if it does not exist.

**S4. Auth fallback allows user impersonation when `REQUIRE_AUTH` is disabled**
When `REQUIRE_AUTH` is not set (the current default), all endpoints accept an arbitrary `userId` from the JSON body or query string. Any caller can impersonate any user. The default must be secure.
- **File:** `backend/src/services/authMiddleware.ts`
- **Fix:** Either (a) change the default of `REQUIRE_AUTH` to `"true"`, or (b) remove the body-fallback path entirely and always require the `x-ms-client-principal-id` header (set by SWA/EasyAuth).

**S5. Azure Functions directly accessible — bypasses SWA auth layer**
All functions use `authLevel: "anonymous"`. The SWA `staticwebapp.config.json` requires the `authenticated` role for `/api/*`, but this only applies when requests go **through** SWA. If the Function App URL is known (e.g. `func-wardrobe-dev.azurewebsites.net`), anyone can call the API directly, bypassing SWA authentication entirely.
- **Files:** all files in `backend/src/functions/`, `infra/modules/functions.bicep`
- **Fix:** Either (a) set `authLevel: "function"` and share the function key with SWA only, or (b) configure Function App access restrictions in Bicep to allow traffic **only** from the SWA backend (recommended), or (c) ensure `REQUIRE_AUTH=true` is set as a Function App setting so the `x-ms-client-principal-id` header is always required.

**S6. Cosmos DB local (key-based) authentication is enabled**
`disableLocalAuth: false` in `cosmos-db.bicep`. If the account key leaks (logs, error messages, backup), an attacker has full unrestricted access to all data, bypassing the RBAC grants on the Managed Identity.
- **File:** `infra/modules/cosmos-db.bicep` (line 51)
- **Fix:** Set `disableLocalAuth: true` so only Managed Identity RBAC access is allowed.

**S7. No URL validation on image URLs submitted to AI services (SSRF)**
`catalogImageUrls` in `POST /garments` and `outfitImageUrl` in `POST /wear/predict` accept **any** string. These URLs are forwarded server-side to Custom Vision and Azure AI Vision endpoints. An attacker can submit internal Azure IMDS URLs (`http://169.254.169.254/…`) or other internal endpoints to perform Server-Side Request Forgery.
- **Files:** `backend/src/functions/postGarment.ts`, `backend/src/functions/postWearPredict.ts`
- **Fix:** Validate all image URLs against an allow-list of domains (e.g. only `*.blob.core.windows.net`), reject non-HTTPS URLs, and reject RFC-1918 / link-local IP addresses.

---

#### 🟡 High — Defence-in-Depth Hardening

**S8. No Content-Security-Policy (CSP) header on the frontend**
`staticwebapp.config.json` sets `X-Frame-Options`, `X-Content-Type-Options`, etc., but does **not** include a `Content-Security-Policy` header. Without CSP, any XSS vulnerability in the frontend has no browser-level mitigation.
- **File:** `frontend/public/staticwebapp.config.json` (moved from `frontend/` to `frontend/public/` so Vite includes it in the build output)
- **Fix:** Add a `Content-Security-Policy` header, e.g.: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.blob.core.windows.net; connect-src 'self' https://*.azurewebsites.net;`

**S9. No rate limiting on any API endpoint**
There is no rate limiting at the Azure Functions level, API Management level, or application level. An attacker can flood `POST /wear/predict` (which triggers expensive AI service calls) and cause cost exhaustion or denial-of-service.
- **Files:** `backend/host.json`, `infra/modules/functions.bicep`
- **Fix:** Add at minimum: (a) an `extensions.http.maxConcurrentRequests` setting in `host.json`, (b) consider Azure API Management or Azure Front Door rate-limiting rules for production.
- **Note:** This is NOT covered by Issue #14 (Observability) or any other open issue.

**S10. AI Services have `publicNetworkAccess: 'Enabled'`**
All three Cognitive Services accounts (Custom Vision Training, Prediction, Computer Vision) are publicly accessible on the internet. Any party with the API key can use or abuse these resources.
- **File:** `infra/modules/ai-services.bicep` (lines 34, 50, 66)
- **Fix:** Set `publicNetworkAccess: 'Disabled'` and configure network rules or Private Endpoints so only the Function App VNet can reach them (requires VNet integration).

**S11. CORS allows `localhost:5173` in the production Bicep template**
The Function App CORS configuration unconditionally includes `http://localhost:5173`. In production, this allows any attacker running a local dev server to make authenticated cross-origin requests to the production API.
- **File:** `infra/modules/functions.bicep` (line 99)
- **Fix:** Parameterise CORS origins by environment. Only include `localhost` for `dev` environment.

**S12. No request payload size limits**
There are no limits on JSON body size in `host.json` or function code. An attacker can submit multi-megabyte JSON payloads to any POST endpoint, consuming memory and compute.
- **Files:** `backend/host.json`, all POST function handlers
- **Fix:** Add `extensions.http.maxRequestBytes` in `host.json` (e.g. 5 MB). Additionally, validate string field lengths in each handler (e.g. `name` ≤ 100 chars, `blobName` ≤ 256 chars).

**S13. Functions runtime storage account key stored in plain-text app settings**
The `AzureWebJobsStorage` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` app settings in `functions.bicep` contain the full account key of the Functions-internal storage account. Anyone with access to the Function App configuration can read these keys.
- **File:** `infra/modules/functions.bicep` (lines 106–111)
- **Fix:** Use Managed Identity for the Functions runtime storage (`AzureWebJobsStorage__accountName` pattern) instead of connection strings with embedded keys.

**S14. No secret rotation policy for AI service API keys**
Custom Vision and AI Vision API keys are stored in Key Vault but there is no rotation automation or policy configured.
- **Fix:** Add a Key Vault secret rotation policy or document a manual rotation schedule.

---

#### 🟢 Functional Gaps (Non-Security)

**F1. Frontend pages are static stubs — no actual API integration**
All four frontend pages (Catalog, AddGarment, DailyUpload, Dashboard) render hardcoded or mock data. None of them call the backend API. This means:
- `AddGarment.tsx` form submit is a no-op (line 24: `// API integration in Issue #5`)
- `Catalog.tsx` always shows the empty-state placeholder
- `DailyUpload.tsx` uses a mock predict response (line 27–36)
- `Dashboard.tsx` shows static `—` values
- **Impact:** The E2E acceptance flow (Issue #15) cannot pass. Users cannot actually use the app.
- **Fix:** Wire each page to the backend API using `fetch` through the SWA proxy (`/api/…`).

**F2. `POST /garments` — `category` accepts any string (no enum validation)**
The acceptance criteria specify categories like "dress", "top", "bottom", "jacket". The backend accepts any non-empty string.
- **File:** `backend/src/functions/postGarment.ts` (line 77)
- **Fix:** Validate `category` against an allow-list matching the frontend `CATEGORIES` array.

**F3. `GET /garments` — no pagination**
Issue #6 acceptance criteria: "Results are paginated or limited to a reasonable page size." The current implementation returns all garments with no limit.
- **File:** `backend/src/services/garmentService.ts` (line 70–78)
- **Fix:** Add `OFFSET`/`LIMIT` (or continuation token) support to the Cosmos DB query and accept `page`/`pageSize` query parameters.

**F4. `GET /stats/summary` — fetches all wear events without pagination**
For a user with thousands of wear events, this endpoint will be slow and expensive (Cosmos RU consumption).
- **File:** `backend/src/functions/getStatsSummary.ts` (line 54–57)
- **Fix:** Use Cosmos DB aggregation queries (`GROUP BY`, `COUNT`, `MAX`) instead of fetching all documents client-side.

**F5. No retrain trigger exists for Custom Vision**
Issue #10 acceptance criteria: "A retrain trigger exists (manual or automated) for when new garments are added." Training images are submitted, but the model is never actually retrained or republished.
- **Fix:** Add a `POST /api/admin/retrain` endpoint or a timer-triggered function that calls the Custom Vision training and publish APIs.

**F6. Unauthenticated requests return 400 instead of 401 when `REQUIRE_AUTH` is disabled**
Issue #13 acceptance criteria: "Unauthenticated requests to protected API endpoints return HTTP 401." Currently, when `REQUIRE_AUTH` is not enabled, missing userId returns 400 (bad request) instead of 401.
- **Files:** all function handlers
- **Fix:** When userId is missing, always return 401 regardless of `REQUIRE_AUTH` setting — or better yet, always require auth (see S4).

**F7. Key Vault secret population is not automated**
Issue #13 acceptance criteria: "All secrets are stored in Key Vault." The Bicep templates create the Key Vault but do not populate any secrets. A manual `az keyvault secret set` step is required with no automation or CI integration.
- **File:** `infra/modules/functions.bicep` (lines 162–168 comments), `infra/README.md`
- **Fix:** Either populate secrets in Bicep using `Microsoft.KeyVault/vaults/secrets` resources, or add a GitHub Actions step to populate them post-deployment.

**F8. `name` and other string fields have no maximum length**
`name` in `POST /garments`, `blobName` in `POST /images/sas-url` — there is no upper bound on string length, risking storage abuse or UI rendering issues.
- **Fix:** Add `maxLength` checks (e.g. `name` ≤ 100, `blobName` ≤ 256, `category` ≤ 50).

---

#### Summary — Issue #13.5 Checklist

| # | Severity | Gap | Status |
|---|----------|-----|--------|
| S1 | 🔴 Critical | SAS endpoint has no auth | ✅ `extractUserId` + 401 guard in `images.ts`; 13 unit tests |
| S2 | 🔴 Critical | Blob path traversal | ✅ Length check, `..` rejection, safe-char regex, `{userId}/` prefix in `images.ts` |
| S3 | 🔴 Critical | IDOR on wear/confirm | ✅ `readGarment(confirmedGarmentId, userId)` ownership check in `postWearConfirm.ts` |
| S4 | 🔴 Critical | Auth default is insecure | ✅ `isAuthRequired()` defaults `true`; body fallback removed in `authMiddleware.ts`; 9 tests |
| S5 | 🔴 Critical | Functions directly accessible | ✅ `REQUIRE_AUTH: 'true'` in `functions.bicep`; header-only auth enforcement |
| S6 | 🔴 Critical | Cosmos local auth enabled | ✅ `disableLocalAuth: true` in `cosmos-db.bicep` |
| S7 | 🔴 Critical | SSRF via image URLs | ✅ `urlValidator.ts`: HTTPS-only, `*.blob.core.windows.net` allowlist, private-IP rejection; 15 tests |
| S8 | 🟡 High | Missing CSP header | ✅ `Content-Security-Policy` in `staticwebapp.config.json` |
| S9 | 🟡 High | No rate limiting | ✅ `maxConcurrentRequests: 100`, `maxOutstandingRequests: 200` in `host.json` |
| S10 | 🟡 High | AI services publicly accessible | ✅ `publicNetworkAccess: 'Disabled'` on all 3 AI services in `ai-services.bicep` |
| S11 | 🟡 High | CORS allows localhost in prod | ✅ `includeCorsLocalhost` param (default `false`); only `dev` env enables it |
| S12 | 🟡 High | No payload size limits | ✅ `maxRequestBytes: 5 MB` in `host.json` + per-field length limits in all handlers |
| S13 | 🟡 High | Storage key in plain-text app settings | ✅ Identity-based `AzureWebJobsStorage__accountName` + RBAC |
| S14 | 🟡 High | No secret rotation | ✅ Documented 90-day rotation schedule + `enablePurgeProtection` |
| F1 | 🟢 Functional | Frontend is all stubs | Partially by #15 |
| F2 | 🟢 Functional | No category enum validation | No |
| F3 | 🟢 Functional | No pagination on GET /garments | No |
| F4 | 🟢 Functional | Stats fetches all events | No |
| F5 | 🟢 Functional | No retrain trigger | Partially by #16 |
| F6 | 🟢 Functional | 400 instead of 401 on missing auth | No |
| F7 | 🟢 Functional | Key Vault secrets not auto-populated | No |
| F8 | 🟢 Functional | No max-length on string inputs | No |

**Acceptance Criteria:**
- [x] All 🔴 Critical items (S1–S7) are fixed and verified by unit tests.
- [x] All 🟡 High items (S8–S14) are addressed or documented as accepted risk with a mitigation timeline.
- [ ] 🟢 Functional items are triaged — fix now or defer to the appropriate open issue with a cross-reference.
- [ ] A follow-up security test pass confirms no regressions.

**Priority Order (recommended):**
1. S4 + S5 (auth enforcement) — everything else depends on authentication working.
2. S1 + S2 (SAS endpoint) — unauthenticated blob access.
3. S3 (IDOR) — cross-user data mutation.
4. S7 (SSRF) — server-side request forgery via AI services.
5. S6 (Cosmos local auth) — infra hardening.
6. S8–S14 (defence-in-depth) — can be done in parallel.
7. F1–F8 (functional) — address alongside or defer to relevant issues.

---

### Issue #13.6: Infrastructure Security Hardening (SEC-P1 through SEC-P6)

- [x] **Status:** Done

**Description:**
A follow-up security audit after Issue #13.5 revealed additional infrastructure-level and defence-in-depth gaps. This issue captures six targeted remediations (SEC-P1 through SEC-P6) that harden the deployed environment beyond the application-level fixes in #13.5.

---

#### SEC-P1: Function App Network Access Restrictions

The Function App was publicly accessible at its `.azurewebsites.net` URL, allowing anyone to bypass SWA authentication and spoof the `x-ms-client-principal-id` header.

- **Fix:** Added `ipSecurityRestrictions` in `infra/modules/functions.bicep` to allow only `AzureCloud` service-tag traffic and deny all other inbound requests. SCM site uses the same restrictions (`scmIpSecurityRestrictionsUseMain: true`).
- **Limitation:** SWA Free tier does not support linked backends. For full isolation, upgrade to SWA Standard and use a linked/managed backend. This is documented as an accepted limitation.

#### SEC-P2: Downscope Service Principal to Resource Group

The GitHub Actions service principal had `Owner` scoped to the entire subscription, granting far broader access than needed.

- **Fix:** Documented step-by-step downscoping commands in `infra/README.md` (step 3a) to move `Owner` from subscription scope to `rg-wardrobe-dev` only. Updated the security model table.

#### SEC-P3: Monthly Budget Alert

No cost alerting was configured, leaving the project vulnerable to unexpected cost overruns from abuse or misconfiguration.

- **Fix:** Created `infra/modules/budget.bicep` — provisions a `Microsoft.Consumption/budgets` resource with $5/month threshold and three notification tiers (80% actual, 100% actual, 120% forecasted). Wired into `main.bicep` with a `budgetAlertEmails` parameter.

#### SEC-P4: Key Vault References for AI Service Keys

AI service API keys were referenced only in comments — no actual Key Vault reference app settings existed. Application code would have needed to read keys from environment variables or Key Vault directly.

- **Fix:** Added three `@Microsoft.KeyVault(SecretUri=...)` app settings in `functions.bicep`: `CUSTOM_VISION_TRAINING_KEY`, `CUSTOM_VISION_PREDICTION_KEY`, `AI_VISION_KEY`. The Function App MI already has `Key Vault Secrets User` role via `key-vault-rbac.bicep`. Secrets must be populated manually via `az keyvault secret set`.

#### SEC-P5: Validate `x-ms-client-principal` Base64 Token

The auth middleware trusted the plain-text `x-ms-client-principal-id` header, which is trivially spoofable when the Function App is accessed directly (bypassing SWA).

- **Fix:** Rewrote `authMiddleware.ts` to decode and validate the full `x-ms-client-principal` base64-encoded JSON payload. Extracts `userId` from within the structured principal. Falls back to plain-text header only when `REQUIRE_AUTH=false` (local dev). Updated all 7 function test files (164 tests pass). This makes spoofing significantly harder since the attacker must supply a valid JSON structure.

#### SEC-P6: SAS Upload Content-Type Restrictions

The SAS URL endpoint generated upload tokens without content-type restrictions, allowing upload of arbitrary file types (e.g. HTML, SVG with scripts).

- **Fix:** Added `ALLOWED_CONTENT_TYPES` set in `images.ts` (jpeg, png, webp, heic, heif). The optional `contentType` body parameter defaults to `image/jpeg`. The content type is embedded in the upload SAS token via the `contentType` parameter in `generateBlobSASQueryParameters`. Added 5 new unit tests.

---

#### Summary — Issue #13.6 Checklist

| # | Area | Remediation | Status |
|---|------|-------------|--------|
| SEC-P1 | Infra | Function App `ipSecurityRestrictions` (AzureCloud only) | ✅ |
| SEC-P2 | Infra | SP downscoped to RG (documented in `infra/README.md`) | ✅ |
| SEC-P3 | Infra | Monthly budget alert ($5, 3 tiers) | ✅ |
| SEC-P4 | Infra | Key Vault references for AI keys in app settings | ✅ |
| SEC-P5 | Code | Auth middleware validates base64 `x-ms-client-principal` | ✅ |
| SEC-P6 | Code | SAS upload restricted to image content types | ✅ |

**Files Modified:**
- `infra/modules/functions.bicep` — `ipSecurityRestrictions`, KV ref app settings
- `infra/modules/budget.bicep` — new module
- `infra/main.bicep` — budget module + `keyVaultName` param
- `infra/README.md` — SP downscoping steps, security model table
- `backend/src/services/authMiddleware.ts` — base64 principal validation
- `backend/src/services/authMiddleware.test.ts` — 18 tests (rewritten)
- `backend/src/functions/images.ts` — content-type validation
- `backend/src/functions/images.test.ts` — 5 new content-type tests
- `backend/src/functions/*.test.ts` — all 6 function test helpers updated to use base64 header

---

### Issue #14: Setup Observability (Application Insights & Log Analytics)

- [ ] **Status:** Open

**Description:**
Instrument the Azure Functions backend and the frontend PWA with Application Insights. Configure Log Analytics workspace for centralized log aggregation. Track request tracing, prediction confidence metrics, and error diagnostics to enable rapid debugging and performance monitoring.

**Acceptance Criteria:**
- Application Insights resource is provisioned and connected to the Functions app.
- Frontend PWA sends page view and custom event telemetry to Application Insights.
- All Azure Functions requests are automatically traced (correlation IDs, duration, status codes).
- Custom metrics are tracked: prediction confidence scores, fallback trigger rate, wear confirmation rate.
- Error diagnostics: exceptions and failed requests are logged with enough context to reproduce.
- Log Analytics workspace is connected to Application Insights for advanced queries.
- Sampling is configured to manage costs at low volume.

**Phone-Test Validation:**
> Trigger a request from a phone (e.g., load the garments page or submit a prediction). Within a few minutes, verify in the Azure Portal (Application Insights → Live Metrics or Search) that the request trace appears with the correct status code and duration. (This verification step can be done from a desktop portal while the trigger is done from phone.)

---

### Issue #15: End-to-End Phone-Testable Flow Validation

- [ ] **Status:** Open

**Description:**
Perform a full end-to-end validation of the complete user flow described in README §5 on a real phone. This issue serves as the Phase 1 acceptance gate — all preceding MVP issues (#1–#14) must be complete before this is executed.

**End-to-end flow to validate:**
1. Open the app on a phone browser (or installed PWA).
2. Sign in.
3. Add a new garment with catalog photos.
4. From the daily upload screen, take/upload an outfit photo.
5. View the prediction result with confidence score.
6. Tap "Confirm" to record the wear event.
7. Navigate to the dashboard and verify wear stats are updated.

**Acceptance Criteria:**
- All steps in the flow complete without errors on a real phone browser.
- Garment appears in catalog after creation.
- Prediction returns the correct garment with a confidence score.
- Wear count increments after confirmation.
- Dashboard reflects updated stats (most-worn, last-worn).
- The full flow completes in a reasonable time (under 60 seconds of user interaction).

**Phone-Test Validation:**
> Perform the full end-to-end flow on a phone from start to finish: catalog a garment with photos → upload a daily outfit photo → see the prediction → tap "Confirm" → open the dashboard and verify stats updated. Document each step result in a test checklist.

---

## Phase 2

### Issue #16: Retraining Pipeline from User Corrections

- [ ] **Status:** Open

**Description:**
Build a pipeline that uses accumulated user corrections stored in `PredictionAudit.userFinalSelection` to periodically retrain the Custom Vision model. This closes the feedback loop and improves prediction accuracy over time.

**Acceptance Criteria:**
- A retraining job (Azure Function or Logic App) reads `PredictionAudit` records where `userFinalSelection` differs from the top prediction.
- Corrected images are submitted to Custom Vision as additional training images for the correct garment tag.
- Retraining is triggered on a schedule (e.g., weekly) or when a threshold number of corrections accumulates.
- Model is republished after retraining.
- Retraining activity is logged to Application Insights.

**Phone-Test Validation:**
> After submitting several corrections for a specific garment (via Issue #8), trigger a retraining cycle. Upload a photo of that garment from a phone and verify the prediction accuracy has improved compared to before retraining.

---

### Issue #17: Duplicate/Near-Similar Dress Disambiguation

- [ ] **Status:** Open

**Description:**
Handle cases where two or more garments in the catalog look visually very similar. When the model cannot confidently distinguish between them, prompt the user to manually select from the candidates. Track disambiguation choices to improve future predictions.

**Acceptance Criteria:**
- When the top-2 predictions are within a configurable similarity margin (e.g., confidence difference < 10%), a disambiguation prompt is shown.
- Disambiguation UI shows side-by-side thumbnails of the candidate garments for the user to select.
- User's selection is recorded and used as the confirmed garment for the wear event.
- Disambiguation events are logged for analysis.

**Phone-Test Validation:**
> Add two visually similar garments to the catalog on a phone. Upload an outfit photo that could match either garment. Verify the app shows a disambiguation prompt with thumbnails of both candidates for the user to choose from.

---

### Issue #18: Monthly Insights ("Not Worn in 60 Days")

- [ ] **Status:** Open

**Description:**
Surface insights about underutilized garments — specifically, items that haven't been worn in the last 60 days. Display these on a dedicated insights page or as dashboard notifications to encourage better wardrobe utilization.

**Acceptance Criteria:**
- A query identifies garments where `WearEvent.createdAt` (most recent) is older than 60 days, or garments with zero wear events.
- An insights section/page in the app displays these garments with a "Not worn in X days" label.
- The 60-day threshold is configurable.
- Insights are scoped to the authenticated user.
- Insights page is mobile-friendly and navigable from the main menu.

**Phone-Test Validation:**
> Open the insights page on a phone. Verify garments that have not been logged as worn in 60+ days (or have never been worn) appear in the "not worn" suggestions list with an accurate "not worn in X days" label.

---

## Phase 3

### Issue #19: Cost Optimization & Archival Policy

- [ ] **Status:** Open

**Description:**
Review and optimize the Azure resource costs incurred by the wardrobe tracker. Implement image archival to cool/archive Blob tier for old images, review Cosmos DB RU consumption, and audit Azure Functions execution costs. Aim to keep the app within the Azure free tier or minimal paid tier for personal use.

> **Note:** A $5/month budget alert with three notification tiers (80% actual, 100% actual, 120% forecasted) was already provisioned in Issue #13.6 (SEC-P3) via `infra/modules/budget.bicep`. The remaining work in this issue focuses on lifecycle policies, consumption reviews, and cost documentation.

**Acceptance Criteria:**
- Blob Storage lifecycle management policy is configured: images older than 90 days are moved to cool tier; images older than 365 days are moved to archive tier.
- Cosmos DB consumption is reviewed; serverless mode is confirmed as cost-optimal for low-traffic personal use.
- Azure Functions execution count and duration are reviewed against Consumption plan free grant.
- Application Insights sampling is validated to avoid excessive data ingestion costs.
- ~~A cost estimate (or Azure Cost Management view) is documented for steady-state monthly usage.~~ ✅ Done in #13.6 — budget alert at $5/month with email notifications.
- Review and adjust the budget threshold in `budget.bicep` based on actual steady-state usage data.

**Validation:**
> Review the Azure Cost Management dashboard after one month of usage. Verify the budget alert from #13.6 is active and firing at the correct thresholds. Confirm Blob archival policy is triggering for old images.

---

### Issue #20: Recommendation Features

- [ ] **Status:** Open

**Description:**
Add outfit recommendation features to the dashboard based on historical wear patterns. Recommendations may consider: wear frequency (surface underused items), last-worn date, or future extensibility hooks for weather/occasion. This is a Phase 3 enhancement and should not block any MVP or Phase 2 work.

**Acceptance Criteria:**
- A recommendations section appears on the dashboard or a dedicated page.
- At minimum, recommendations surface: "You haven't worn X in a while" and "Your most-worn item this month is Y".
- Recommendations are generated server-side via `GET /stats/summary` or a new `GET /recommendations` endpoint.
- Recommendations are mobile-friendly and display garment thumbnails.
- Recommendation logic is configurable and extensible for future signals (weather, occasion).

**Phone-Test Validation:**
> Open the app on a phone and navigate to the dashboard or recommendations page. Verify outfit/garment recommendations are displayed, including at least one "not worn recently" suggestion and one "most worn" insight, with garment thumbnails.

---

## Issue Summary

| Issue | Title | Phase | Status |
|-------|-------|-------|--------|
| #0 | Define Testing Framework & Phone-Testing Strategy | Foundation | [x] Done |
| #1 | Setup Azure Static Web App (Frontend PWA) | MVP | [x] Done |
| #1.5 | Provision Azure Resource Group & Baseline Infrastructure (Bicep + OIDC) | MVP | [x] Done |
| #2 | Setup Azure Functions Backend API | MVP | [x] Done |
| #3 | Setup Azure Blob Storage for Images | MVP | [x] Done |
| #4 | Setup Cosmos DB & Data Models | MVP | [x] Done |
| #5 | Implement `POST /garments` | MVP | [x] Done |
| #6 | Implement `GET /garments` | MVP | [x] Done |
| #7 | Implement `POST /wear/predict` | MVP | [x] Done |
| #8 | Implement `POST /wear/confirm` | MVP | [x] Done |
| #9 | Implement `GET /stats/summary` | MVP | [x] Done |
| #10 | Integrate Azure AI Custom Vision | MVP | [x] Done |
| #11 | Add Fallback: Embeddings & Similarity Search | MVP | [x] Done |
| #12 | Implement Confidence-Based UX Guardrails | MVP | [x] Done |
| #13 | Setup Identity & Security | MVP | [x] Done |
| #13.5 | Security Hardening & Implementation Gap Remediation | MVP | [ ] Open |
| #13.6 | Infrastructure Security Hardening (SEC-P1–P6) | MVP | [x] Done |
| #14 | Setup Observability | MVP | [ ] Open |
| #15 | End-to-End Phone-Testable Flow Validation | MVP | [ ] Open |
| #16 | Retraining Pipeline from User Corrections | Phase 2 | [ ] Open |
| #17 | Duplicate/Near-Similar Dress Disambiguation | Phase 2 | [ ] Open |
| #18 | Monthly Insights ("Not Worn in 60 Days") | Phase 2 | [ ] Open |
| #19 | Cost Optimization & Archival Policy | Phase 3 | [ ] Open |
| #20 | Recommendation Features | Phase 3 | [ ] Open |
