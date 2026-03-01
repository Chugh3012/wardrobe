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
- The service principal used by CI is granted **only the minimum RBAC roles needed** (e.g. `Contributor` scoped to the wardrobe resource group, not the whole subscription).
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
3. Grant the service principal `Contributor` on the resource group (or `Owner` if RBAC assignments are needed).
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

- [ ] **Status:** Open

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

- [ ] **Status:** Open

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

- [ ] **Status:** Open

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

- [ ] **Status:** Open

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

- [ ] **Status:** Open

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

- [ ] **Status:** Open

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

- [ ] **Status:** Open

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

**Acceptance Criteria:**
- Blob Storage lifecycle management policy is configured: images older than 90 days are moved to cool tier; images older than 365 days are moved to archive tier.
- Cosmos DB consumption is reviewed; serverless mode is confirmed as cost-optimal for low-traffic personal use.
- Azure Functions execution count and duration are reviewed against Consumption plan free grant.
- Application Insights sampling is validated to avoid excessive data ingestion costs.
- A cost estimate (or Azure Cost Management view) is documented for steady-state monthly usage.

**Validation:**
> Review the Azure Cost Management dashboard after one month of usage. Verify the total monthly cost is within the defined budget target. Confirm Blob archival policy is triggering for old images.

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
| #7 | Implement `POST /wear/predict` | MVP | [ ] Open |
| #8 | Implement `POST /wear/confirm` | MVP | [ ] Open |
| #9 | Implement `GET /stats/summary` | MVP | [ ] Open |
| #10 | Integrate Azure AI Custom Vision | MVP | [ ] Open |
| #11 | Add Fallback: Embeddings & Similarity Search | MVP | [ ] Open |
| #12 | Implement Confidence-Based UX Guardrails | MVP | [ ] Open |
| #13 | Setup Identity & Security | MVP | [ ] Open |
| #14 | Setup Observability | MVP | [ ] Open |
| #15 | End-to-End Phone-Testable Flow Validation | MVP | [ ] Open |
| #16 | Retraining Pipeline from User Corrections | Phase 2 | [ ] Open |
| #17 | Duplicate/Near-Similar Dress Disambiguation | Phase 2 | [ ] Open |
| #18 | Monthly Insights ("Not Worn in 60 Days") | Phase 2 | [ ] Open |
| #19 | Cost Optimization & Archival Policy | Phase 3 | [ ] Open |
| #20 | Recommendation Features | Phase 3 | [ ] Open |
