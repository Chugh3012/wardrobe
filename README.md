# Wardrobe Tracker (HLD)

## 1) Is this a good idea?
Yes — this is a practical personal-use idea with clear value: **track clothing usage frequency** to improve outfit planning and avoid under-used purchases.

The main challenge is not storage/UI, it is **reliable cloth identification from daily photos** under changing lighting, angles, wrinkles, accessories, and partial visibility.

---

## 2) Key loopholes / risks to address early

1. **Image recognition accuracy risk**  
   Similar-looking dresses, different lighting, and cropped photos can cause wrong matches.

2. **Cold start data quality**  
   If initial catalog photos are inconsistent (background, angle, low light), model quality drops.

3. **False auto-increment risk**  
   Fully automatic count updates can silently corrupt stats.

4. **Privacy/security concerns**  
   Personal photos need encryption, least-privilege access, and retention controls.

5. **User friction**  
   If daily upload takes more than a few taps, adoption drops.

---

## 3) MVP approach (Azure-first)

### MVP scope (smallest useful product)
- Maintain a catalog of dresses with 3–8 onboarding photos per item.
- Daily upload one outfit photo from phone.
- System predicts matching dress with confidence.
- User confirms/corrects in one tap.
- Wear count increments only after confirmation.
- Simple history + top-worn / least-worn view.

### Out of scope for MVP
- Multi-person wardrobe
- Advanced recommendations/styling assistant
- Video ingestion
- Full closet segmentation

---

## 4) Proposed high-level architecture (Azure)

### Frontend
- **Azure Static Web Apps**: mobile-first web app (PWA-capable for phone usability).

### Backend API
- **Azure Functions (HTTP + Durable optional)**: endpoints for catalog, upload, prediction, confirm, and stats.

### Storage
- **Azure Blob Storage**: original and processed images.
- **Azure Cosmos DB (NoSQL)**: garment metadata, wear events, prediction logs, confidence, user corrections.

### AI / Vision
- **Azure AI Custom Vision** (or Azure ML with custom classifier if scaling later): classify uploaded outfit against known garments.
- Optional fallback: **Azure AI Vision embeddings** + similarity search if classification confidence is low.

### Identity & Security
- **Microsoft Entra External ID (or B2C equivalent)** for sign-in.
- **Managed Identity + Key Vault** for secrets.
- SAS or short-lived signed access patterns for image access.

### Observability
- **Application Insights + Log Analytics** for request tracing, prediction confidence monitoring, and error diagnostics.
- **Backend telemetry service** (`telemetryService.ts`) wraps the `applicationinsights` SDK with property-key sanitization — a deny-list (token, password, secret, authorization, cookie, key, credential) prevents accidental secret leakage in custom event properties. All 6 function handlers are instrumented with `trackEvent`, `trackMetric`, and `trackException`.
- **Frontend telemetry** (`telemetry.ts`) uses `@microsoft/applicationinsights-web` with `initTelemetry()` at startup and `trackPageView()` on SPA navigation.
- **Adaptive sampling** configured in `host.json` to manage ingestion costs while preserving exceptions and custom events.
- **CSP hardened** — `connect-src` allows only the required App Insights ingestion domains.

### Frontend → Backend Integration
- **Typed API client** (`frontend/src/api.ts`) — All 6 backend endpoints are called through typed wrapper functions (`fetchGarments`, `createGarment`, `getSasUrl`, `uploadToBlob`, `predictOutfit`, `confirmWear`, `fetchStatsSummary`). Uses the SWA reverse proxy (`/api/*`) — no explicit backend URL needed.
- **Catalog page** — Lists garments with thumbnail grid, pagination via Cosmos DB continuation tokens.
- **Add Garment page** — Multi-photo upload to Blob via SAS URLs, garment creation via API, preview grid with remove support.
- **Daily Upload page** — Photo upload to Blob → AI prediction → user confirmation → wear event recording. Supports high/medium/low confidence UX flows.
- **Dashboard page** — Real-time stats from `GET /api/stats/summary`: total garments, total wears, most/least worn lists.
- All pages implement loading, error (with retry), and empty states.

---

## 5) End-to-end phone-testable flow

1. User opens mobile web app (home screen shortcut/PWA).
2. User adds garment in “Catalog”:
   - Capture/upload multiple photos
   - Add name/tag (e.g., “Red Floral Dress”)
3. Daily usage:
   - Upload/capture current outfit photo
   - Backend stores image in Blob
   - AI service returns top prediction + confidence
4. App shows:
   - “We think this is Red Floral Dress (91%)”
   - Buttons: **Confirm** / **Choose different item**
5. On confirm:
   - Create wear event in Cosmos DB
   - Increment garment wear count
6. Dashboard shows:
   - Total wears by garment
   - Last worn date
   - Most/least worn

This flow is fully testable on phone via browser without native app development.

---

## 6) Minimal data model

### `Garment`
- `id`
- `userId`
- `name`
- `category` (dress/top/etc.)
- `catalogImageUrls[]`
- `wearCount`
- `createdAt`
- `updatedAt`

### `WearEvent`
- `id`
- `userId`
- `garmentId`
- `outfitImageUrl`
- `predictedGarmentId`
- `confidence`
- `confirmed` (bool)
- `createdAt`

### `PredictionAudit` (optional but recommended)
- `id`
- `userId`
- `inputImageUrl`
- `topKPredictions[]`
- `userFinalSelection`
- `createdAt`

---

## 7) API surface (MVP)

- `POST /garments` (create garment + catalog photos)
- `GET /garments`
- `POST /wear/predict` (upload daily image, return top matches)
- `POST /wear/confirm` (confirm/correct match and increment count)
- `GET /stats/summary`

---

## 8) Accuracy and UX guardrails (important)

- Never auto-increment below confidence threshold (e.g., <85%).
- Always show top 3 matches when confidence is medium.
- Capture user correction and use it for periodic retraining.
- Enforce onboarding photo guidance (good light, front/full view, plain background).

---

## 9) Suggested phased plan

### Phase 1 (2–3 weeks): MVP
- Catalog + daily upload + confirm + wear counter + simple dashboard.

### Phase 2
- Retraining pipeline from corrections.
- Duplicate/near-similar dress disambiguation.
- Monthly insights (“not worn in 60 days”).

### Phase 3
- Cost optimization, archival policy, recommendation features.

---

## 10) Cost-aware Azure setup for MVP

- Static Web Apps (low-cost front-end hosting)
- Functions Consumption plan
- Blob Storage hot tier (small volume initially)
- Cosmos DB serverless (or small RU baseline)
- Custom Vision small training/prediction usage
- Application Insights with sampling

This keeps initial cost low while preserving a production-shaped architecture.

---

## 11) Security Architecture

The application implements defence-in-depth across multiple layers:

### Network & Access Control
- **SWA Auth Architecture (Pattern A)** — The SPA shell (HTML/JS/CSS) is publicly accessible. Only `/api/*` routes require `["authenticated"]` role at the SWA edge. The React app performs a client-side auth check via `/.auth/me` on mount and redirects unauthenticated users to `/.auth/login/aad`. This is the recommended architecture for SPAs on Azure Static Web Apps — it avoids MIME-type errors caused by server-side auth blocking static assets.
- **Entra ID (AAD) authentication** — SWA EasyAuth configured with a dedicated app registration (`wardrobe-swa-auth`). Disabled identity providers (GitHub, Twitter) return 404. `/login` rewrites to `/.auth/login/aad`.
- **Function App IP restrictions** — `ipSecurityRestrictions` allow only `AzureCloud` service-tag traffic; all other inbound is denied. SCM site uses the same rules.
- **No public Cosmos DB / AI endpoints** — Cosmos DB disables local auth (`disableLocalAuth: true`); AI services have `publicNetworkAccess: Disabled`.

### Identity & Secrets
- **Managed Identity** — The Function App uses a `SystemAssigned` identity for all service-to-service calls (Cosmos DB, Key Vault, Blob Storage).
- **Key Vault references** — AI service keys are stored in Key Vault and referenced via `@Microsoft.KeyVault(SecretUri=...)` in Function App app settings. No secrets in Bicep outputs or GitHub secrets.
- **OIDC federation** — GitHub Actions authenticates to Azure via workload identity federation (no long-lived client secret).
- **Service principal least-privilege** — `Owner` is scoped to `rg-wardrobe-dev` only (downscoped after first deployment).

### Application-Level
- **Client-side auth gate** — `App.tsx` calls `checkAuth()` (which hits `/.auth/me`) on mount. If no `clientPrincipal` is found, the user is redirected to `/.auth/login/aad`. The app renders a "Signing in…" loading state until auth is confirmed. In local dev (Vite without SWA), the fetch fails gracefully and allows through.
- **Base64 client principal validation** — Auth middleware decodes and validates the `x-ms-client-principal` base64 header injected by EasyAuth, extracting `userId` from the structured JSON. Plain-text header fallback is only accepted when `REQUIRE_AUTH=false` (local development).
- **Per-user blob scoping** — SAS URLs are scoped to `images/{userId}/` prefixes, preventing cross-user access.
- **Content-type restrictions** — SAS upload tokens are restricted to allowed image MIME types (jpeg, png, webp, heic, heif).

### Cost Protection
- **Monthly budget alert** — A `Microsoft.Consumption/budgets` resource enforces a $5/month threshold with notifications at 80%, 100%, and 120%.

### Observability Security
- **Service worker v2 (auth-aware)** — `sw.js` uses a network-first strategy for navigation requests (so the fresh `/.auth/me` state is always checked), never intercepts `/.auth/` or `/api/` paths, and only cache-first for shell assets (manifest, icons). Old caches are purged on activation.
- **Connection string (not secret)** — The App Insights connection string only permits writing telemetry; it cannot read data. Safe to embed in client-side code and app settings.
- **Property-key sanitization** — Backend `telemetryService.ts` strips sensitive keys (token, password, secret, authorization, cookie, key, credential) from custom event and exception properties before sending to App Insights.
- **Try/catch isolation** — Both backend and frontend telemetry init are wrapped in try/catch blocks. A telemetry failure (e.g. malformed connection string) never crashes the application.
- **Adaptive sampling** — `host.json` configures server-side adaptive sampling, excluding Request, Exception, and Event types from being sampled down, while keeping overall ingestion costs low.
- **Log Analytics RBAC** — `enableLogAccessUsingOnlyResourcePermissions: true` ensures log access is governed by resource-level Azure RBAC, not workspace-level permissions.
