# Local Development & Testing Guide

> Complete guide for running, testing, and validating the Wardrobe Tracker locally and via CI/CD.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Local Development Modes](#local-development-modes)
4. [Testing Layers](#testing-layers)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Security Model](#security-model)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Install all dependencies
npm run install:all

# 2a. Full-stack (frontend + real backend hitting Azure)
cp backend/local.settings.json.example backend/local.settings.json  # edit values
cp frontend/.env.local.example frontend/.env.local
npm run dev

# 2b. Frontend-only with mock API (no Azure required)
npm run dev:frontend-mock

# 3. Run all tests
npm run test:all
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| npm | 10+ | Package management |
| Azure Functions Core Tools | v4 | Local backend (`npm i -g azure-functions-core-tools@4`) |
| Azure CLI | 2.60+ | Azure auth (`az login`) for DefaultAzureCredential |

### First-time setup

```bash
# Clone and install
git clone <repo-url>
cd wardrobe
npm run install:all

# Login to Azure (needed for real backend mode)
az login
```

---

## Local Development Modes

### Mode 1: Frontend + Mock API (fastest, offline)

**Best for**: UI development, styling, component work. No Azure account needed.

```bash
npm run dev:frontend-mock
```

This starts:
- **Vite dev server** on `http://localhost:5173` — hot-reloading React app
- **Mock API** on `http://localhost:7071` — returns realistic fake data

The mock API serves all 6 endpoints with sample garments, stats, and predictions. MSAL auth is bypassed via `VITE_SKIP_AUTH=true` in `.env.local`.

### Mode 2: Full-Stack (frontend + real Azure Functions backend)

**Best for**: Testing real data flows, backend changes, end-to-end validation.

```bash
# 1. Copy and configure backend settings
cp backend/local.settings.json.example backend/local.settings.json
# Edit: set COSMOS_DB_ENDPOINT, BLOB_ACCOUNT_NAME, etc.

# 2. Copy and configure frontend env
cp frontend/.env.local.example frontend/.env.local
# VITE_API_BASE_URL= (empty — Vite proxy handles it)
# VITE_SKIP_AUTH=true (or false for real MSAL login)

# 3. Start both
npm run dev
```

This starts:
- **Vite dev server** on `http://localhost:5173` — proxies `/api/*` to `:7071`
- **Azure Functions** on `http://localhost:7071` — real handler code

**How the proxy works**:
- Frontend sets `VITE_API_BASE_URL=` (empty), so API calls go to `/api/*` on same-origin
- Vite's built-in proxy forwards `/api/*` → `http://localhost:7071`
- The proxy injects `x-ms-client-principal-id: local-dev-user` header on each request
- Backend runs with `REQUIRE_AUTH=false` and accepts the plain-text header

### Mode 3: Frontend with real MSAL auth + real backend

**Best for**: Testing the full auth flow including token acquisition.

```bash
# In frontend/.env.local:
VITE_SKIP_AUTH=false
VITE_API_BASE_URL=

# Requires AAD app registration with http://localhost:5173 as redirect URI
npm run dev
```

MSAL will redirect to Azure AD login, acquire a real token, and the Vite proxy still injects the `x-ms-client-principal-id` header for the backend.

### Mode 4: Start services individually

```bash
npm run dev:frontend   # Vite only on :5173
npm run dev:backend    # Azure Functions only on :7071
npm run dev:mock       # Mock API only on :7071
```

---

## Testing Layers

```
┌───────────────────────────────────────────────────────────────┐
│                    E2E Tests (Playwright)                      │
│   UI rendering · API smoke · Azure resource verification      │
│   115+ test cases · 4 projects (mobile, desktop, api, azure)  │
├───────────────────────────────────────────────────────────────┤
│                  Integration Tests (Vitest)                    │
│   Full HTTP handler pipeline · Mocked Azure services          │
│   Auth enforcement · Request validation · Error handling       │
├───────────────────────────────────────────────────────────────┤
│                    Unit Tests (Vitest)                         │
│   Backend: 239 tests · Frontend: 15 tests                     │
│   Individual function/service/component logic                 │
└───────────────────────────────────────────────────────────────┘
```

### Unit Tests

```bash
# All unit tests
npm run test

# Backend only (239 tests)
npm run test:backend

# Frontend only (15 tests)
npm run test:frontend
```

**Backend unit tests** cover all 8 HTTP handlers, 10 services, and auth middleware with mocked Cosmos/Blob/Vision services.

**Frontend unit tests** cover the API client (all endpoint wrappers, token handling, error paths) and App component (auth flow, page rendering).

### Integration Tests

```bash
npm run test:integration
```

**9 tests** exercising the full Azure Functions HTTP handler pipeline:
- Health endpoint (no auth)
- GET /api/garments (auth enforcement, pagination, empty state, Cosmos errors)
- GET /api/stats/summary (auth enforcement, aggregated response)
- Auth bypass mode (REQUIRE_AUTH=false with x-ms-client-principal-id)

External services (Cosmos, Blob, Vision) are mocked at the module boundary.

### E2E Tests (Playwright)

```bash
# All E2E
npm run test:e2e

# UI tests only (runs Vite preview server automatically)
npm run test:e2e:ui

# API tests (requires FUNC_URL env var pointing to deployed Function App)
npm run test:e2e:api

# Azure resource verification (requires az login + AZURE_RESOURCE_GROUP)
npm run test:e2e:azure
```

**E2E test projects**:
| Project | Target | What it tests |
|---------|--------|---------------|
| `ui-mobile` | localhost:5173 (Vite preview) | Page rendering, navigation, PWA manifest, security headers |
| `ui-desktop` | localhost:5173 (Vite preview) | Same as mobile on desktop viewport |
| `api-endpoints` | Deployed Function App | All 6 API endpoints, auth enforcement, payload validation |
| `azure-resources` | Azure CLI | Resource group, SKUs, settings, networking, RBAC, tags |

---

## CI/CD Pipeline

### Workflow: `ci.yml` — runs on every Pull Request

```
PR opened/updated
  ├── Backend: Build & Test (239 unit tests)
  ├── Frontend: Type-check, Test (15 tests), Build
  ├── Integration Tests (9 tests, needs Backend)
  ├── E2E UI (Playwright, needs Frontend build)
  ├── Security Audit (npm audit, secret scanning)
  └── CI Gate (all must pass)
```

**No Azure credentials needed** — all external services are mocked. Safe for PRs from Copilot or forks.

### Workflow: `deploy-backend.yml` — on main push to `backend/**`

Builds, tests, deploys to Azure Functions via OIDC.

### Workflow: `deploy-frontend.yml` — on main push to `frontend/**`

Type-checks, tests, builds, deploys to Azure Static Web Apps. Creates staging preview on PRs.

### Workflow: `e2e-smoke.yml` — after deploy to main

Runs API + Azure resource verification tests against the live environment.

### Workflow: `provision-infra.yml` — on main push to `infra/**`

Bicep lint → what-if → deploy → sync SWA token.

### Creating PRs from GitHub Copilot (phone)

When you create a PR from Copilot on your phone, the **ci.yml** workflow triggers automatically:

1. **No secrets needed** — the CI pipeline mocks all Azure services
2. **All test layers run** — unit, integration, E2E UI, security audit
3. **Frontend preview** — Azure SWA deploys a staging preview URL in the PR comments
4. **CI Gate** — the PR can't merge until all checks pass
5. **Playwright reports** — downloadable as artifacts for debugging failures

---

## Security Model

### Production (Azure)

```
Browser → SWA (EasyAuth/AAD) → Function App (EasyAuth validates token)
                                   ↳ x-ms-client-principal (base64 JSON)
                                   ↳ Managed Identity → Cosmos/Blob (no keys)
```

### Local Development

```
Browser → Vite (:5173) → Proxy → Azure Functions (:7071)
             ↳ Injects x-ms-client-principal-id header
             ↳ Backend: REQUIRE_AUTH=false
             ↳ DefaultAzureCredential (az login) → Cosmos/Blob
```

### Security guarantees preserved locally

| Control | Production | Local Dev |
|---------|-----------|-----------|
| AAD authentication | EasyAuth v2 validates JWT | Optional via MSAL (VITE_SKIP_AUTH=false) |
| User ID source | x-ms-client-principal (base64 JSON) | x-ms-client-principal-id (plain text) |
| Backend auth enforcement | REQUIRE_AUTH=true (default) | REQUIRE_AUTH=false (explicit opt-in) |
| Azure service auth | Managed Identity | DefaultAzureCredential (az login) |
| Secrets management | Key Vault references | local.settings.json (gitignored) |
| No hardcoded secrets | Enforced in CI (secret scanning) | .gitignore excludes all env files |
| CORS | Function App app setting | local.settings.json Host.CORS |

### What is NOT compromised

- `REQUIRE_AUTH` defaults to `true` — you must explicitly set `false`
- `VITE_SKIP_AUTH` has no effect on production builds (only read by client code)
- `local.settings.json` is `.gitignored` — cannot be committed
- CI runs secret scanning on every PR
- No connection strings — all services use Managed Identity / DefaultAzureCredential
- The proxy's `x-ms-client-principal-id` injection only works in Vite dev mode

---

## Available Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend + backend together |
| `npm run dev:frontend` | Frontend only (Vite dev server) |
| `npm run dev:backend` | Backend only (Azure Functions) |
| `npm run dev:mock` | Mock API server only |
| `npm run dev:frontend-mock` | Frontend + mock API together |
| `npm run build` | Build both frontend and backend |
| `npm run test` | Run all unit tests |
| `npm run test:backend` | Backend unit tests (Vitest) |
| `npm run test:frontend` | Frontend unit tests (Vitest) |
| `npm run test:integration` | Integration tests (Vitest) |
| `npm run test:e2e` | All E2E tests (Playwright) |
| `npm run test:all` | Unit + integration tests |
| `npm run install:all` | Install deps for all packages |
| `npm run clean` | Remove build artifacts |

---

## Troubleshooting

### "Azure Functions Core Tools not found"

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### "COSMOS_DB_ENDPOINT environment variable is not set"

Copy `backend/local.settings.json.example` to `backend/local.settings.json` and fill in your Cosmos DB endpoint.

### "DefaultAzureCredential failed"

Run `az login` to authenticate with Azure. The backend uses your Azure CLI session for Cosmos/Blob access.

### Vite proxy returns 502

The backend (port 7071) isn't running. Start it with `npm run dev:backend` or use mock mode.

### MSAL redirect loop

Add `http://localhost:5173` as a redirect URI in your AAD app registration. Or use `VITE_SKIP_AUTH=true` in `.env.local`.

### Frontend can't reach API

Check that `VITE_API_BASE_URL` is empty in `.env.local` (for proxy mode) or set to `http://localhost:7071` (for direct mode — requires CORS).

### E2E tests fail in CI

Download the Playwright report artifact from the GitHub Actions run. It contains screenshots and traces for failed tests.
