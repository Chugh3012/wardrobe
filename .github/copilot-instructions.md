# Copilot Instructions — Wardrobe Tracker

> This file is automatically read by GitHub Copilot (VS Code and github.com) before generating code.
> It captures the project's architecture, conventions, and quality standards.
>
> **Scoped instructions** in `.github/instructions/` provide file-pattern-specific guidance
> that Copilot auto-applies when editing matching files. This file provides the global context.

---

## Project Overview

A **mobile-first Progressive Web App** for tracking clothing wear frequency.
Users photograph daily outfits, AI predicts which garment was worn, users confirm/correct, and the app tracks wear statistics.

**Tech stack:** TypeScript monorepo — React 19 frontend (Vite), Azure Functions v4 backend, Cosmos DB NoSQL, Azure Blob Storage, Azure AI Custom Vision, Application Insights.

---

## Repository Structure

```
backend/          → Azure Functions API (Node.js v20, ESM)
frontend/         → React SPA (Vite, CSS Modules)
e2e/              → Playwright E2E tests (4 projects)
infra/            → Azure Bicep IaC
scripts/          → Dev tooling (mock API, dev orchestrator)
.github/
  instructions/   → Scoped Copilot instructions (auto-applied by file pattern)
  agents/         → Specialized Copilot chat agents
  prompts/        → Reusable prompt templates
  workflows/      → GitHub Actions CI/CD
```

Within each package:
- `src/functions/`  — Azure Function HTTP handlers (entry points)
- `src/services/`   — Business logic / external service wrappers
- `src/models/`     — TypeScript interfaces (data contracts only)
- `src/pages/`      — Frontend page components (one per view)
- `src/components/` — Shared/layout React components

---

## Scoped Instruction Files

These files in `.github/instructions/` are auto-applied by Copilot based on the file being edited:

| File | Applies To | Purpose |
|------|-----------|---------|
| `typescript.instructions.md` | `**/*.ts, **/*.tsx` | TypeScript strict mode, naming, imports |
| `react-frontend.instructions.md` | `frontend/**/*.tsx, *.css` | React 19 patterns, CSS Modules, a11y |
| `azure-functions-backend.instructions.md` | `backend/**/*.ts` | Handler template, service layer, validation |
| `vitest-testing.instructions.md` | `**/*.test.ts, **/*.test.tsx` | Test structure, helpers, mocking |
| `playwright-e2e.instructions.md` | `e2e/**/*.ts` | E2E patterns, locators, assertions |
| `bicep-infra.instructions.md` | `**/*.bicep, **/*.bicepparam` | Bicep naming, security, resource config |
| `security.instructions.md` | `**` | OWASP controls, auth, validation, SSRF |
| `accessibility.instructions.md` | `frontend/**/*.tsx, *.css` | WCAG 2.2 Level AA compliance |
| `github-actions.instructions.md` | `.github/workflows/*.yml` | CI/CD conventions |

---

## Custom Agents

Specialized agents in `.github/agents/` for targeted tasks:

| Agent | Purpose |
|-------|---------|
| `security-reviewer.agent.md` | OWASP + project-specific security review |
| `code-reviewer.agent.md` | Convention compliance and code quality review |
| `test-specialist.agent.md` | Write Vitest unit tests and Playwright E2E tests |
| `planner.agent.md` | Create implementation plans for new features |

---

## Reusable Prompts

Prompt templates in `.github/prompts/` for common scaffolding tasks:

| Prompt | Purpose |
|--------|---------|
| `new-api-endpoint.prompt.md` | Scaffold Azure Functions handler + service + tests |
| `new-page.prompt.md` | Scaffold React page + CSS Module + tests |
| `new-feature.prompt.md` | Full-stack feature across backend + frontend + tests |

---

## Critical Rules (always follow)

1. **TypeScript strict mode** — never use `any`. Use `unknown` for caught errors with type guards.
2. **No classes** — purely functional style everywhere. Services are stateless exported functions, React uses function components.
3. **Tests are mandatory** — every new function, handler, or component must have co-located `*.test.ts` / `*.test.tsx` tests.
4. **Auth first** — every backend handler must call `extractUserId()` and return `unauthorizedResponse()` before any business logic.
5. **Telemetry must never crash the app** — all telemetry calls are fire-and-forget with error swallowing.
6. **Never log secrets** — the `telemetryService` deny-list (`token`, `password`, `secret`, `authorization`, `cookie`, `key`, `credential`) must be respected.
7. **Validate inputs early** — return `400` with `{ error: "descriptive message" }` for bad requests. Validation is sequential (each check returns immediately).

---

## Security (comprehensive — always follow)

### PR / Code Review Checklist

Every change **must** satisfy all of the following before merge:

- [ ] Auth checked via `extractUserId()` before any business logic in every handler
- [ ] No secrets in logs, telemetry properties, or error responses
- [ ] Input validation with descriptive 400 errors (sequential — first failure returns immediately)
- [ ] Blob paths scoped per user: `images/{userId}/...`
- [ ] SAS URLs restricted to allowed image MIME types
- [ ] URL allowlists enforced via `isValidImageUrl()` (HTTPS + `*.blob.core.windows.net`)
- [ ] `telemetryService` property deny-list honoured
- [ ] New IDs / user-supplied strings validated with safe-character regex
- [ ] No internal error details exposed to clients (generic 500 messages only)
- [ ] Tests cover auth rejection (401), bad input (400), and happy path for every handler

### Authentication Rules

Authentication uses **Azure EasyAuth v2 + app-level double-check** via `extractUserId()` in `backend/src/services/authMiddleware.ts`.

**Extraction pipeline (every request):**
1. Decode `x-ms-client-principal` header from **base64 → JSON**
2. Extract `userId` from:
   - **SWA format:** top-level `userId` field
   - **EasyAuth v2 format:** `claims[]` array — search for OID claim types in priority order:
     1. `http://schemas.microsoft.com/identity/claims/objectidentifier`
     2. `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier`
3. **Dev-only fallback:** `x-ms-client-principal-id` plain-text header — **only** when `REQUIRE_AUTH=false`

**UserId validation (applied to every extracted value):**

| Step | Check |
|------|-------|
| 1 | `trim()` the value |
| 2 | Reject if empty |
| 3 | Reject if `length > 128` |
| 4 | Reject if fails `SAFE_USER_ID_RE` (`/^[a-zA-Z0-9@._-]+$/`) — blocks path traversal, null bytes, special chars |
| 5 | On any `catch` (bad base64, bad JSON), return `null` |

**Key invariants:**
- `authLevel` is always `"anonymous"` on every `app.http()` registration — never rely on Azure Functions auth.
- `REQUIRE_AUTH` defaults to `true` (secure-by-default); `isAuthRequired()` only returns `false` when the env var is literally `"false"`.
- `unauthorizedResponse()` always returns `{ status: 401, jsonBody: { error: "Authentication required. Please sign in." } }`.

### Input Validation Rules

Validation is **sequential** — each check returns `400` immediately with a descriptive message.

**Shared constants (always reuse — never hardcode new limits):**

| Constant | Value | Used in |
|----------|-------|---------|
| `MAX_NAME_LENGTH` | `100` | postGarment |
| `MAX_CATEGORY_LENGTH` | `50` | postGarment |
| `MAX_URL_LENGTH` | `2048` | postGarment, postWearPredict |
| `MAX_ID_LENGTH` | `256` | postWearConfirm, deleteWearEvent |
| `MAX_BLOB_NAME_LENGTH` | `256` | images (SAS generation) |
| `ALLOWED_CATEGORIES` | `Set: "dress", "top", "bottom", "outerwear", "shoes", "accessory", "other"` | postGarment |
| `ALLOWED_MIME_TYPES` | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` | images |

**Safe-character regexes (reuse these — do not invent new ones):**

| Regex | Purpose | Used in |
|-------|---------|---------|
| `/^[a-zA-Z0-9@._-]+$/` | User IDs | authMiddleware |
| `/^[a-zA-Z0-9_-]+$/` | Entity IDs (garments, audits) | postWearConfirm |
| `/^[a-zA-Z0-9._/-]+$/` | Blob names (allows path separators) | images |

### URL Validation & SSRF Prevention

All user-supplied URLs pass through `isValidImageUrl()` in `backend/src/services/urlValidator.ts`:

1. Must be a parseable `URL`
2. Protocol must be `https:`
3. Hostname must end with `.blob.core.windows.net`
4. If `BLOB_ACCOUNT_NAME` env var is set → hostname must exactly equal `{BLOB_ACCOUNT_NAME}.blob.core.windows.net`
5. Hostname must **not** match any private / internal IP pattern (RFC 1918, loopback, link-local, Azure IMDS, IPv6 equivalents)

### Error Response Hygiene

| Status | What to expose | What to hide |
|--------|---------------|--------------|
| 400 | Field-specific validation error | — |
| 401 | `"Authentication required. Please sign in."` | No user/token details |
| 404 | `"X not found."` | No existence leakage beyond user-owned resources |
| 409 | Idempotency violation message | — |
| 500 | Generic `"Failed to do X."` | Stack traces → log server-side only |
| 503 | `"Blob storage is not configured."` | No account details |

### OWASP Top 10 Coverage

| Category | Controls |
|----------|----------|
| **A01 Broken Access Control** | `extractUserId()` on every handler; user-scoped blob paths; Cosmos partition key `/userId`; IDOR check on garment ownership |
| **A02 Cryptographic Failures** | HTTPS-only (TLS 1.2+); FTPS disabled; SAS HTTPS-only; no local auth keys for Cosmos |
| **A03 Injection** | Safe-character regex on all IDs and blob names; `..` traversal rejection; Cosmos SDK parameterized queries |
| **A04 Insecure Design** | Idempotency guards; user-delegation SAS (no account keys); time-bounded tokens (5 min upload / 1 hr read) |
| **A05 Security Misconfiguration** | CSP headers; HSTS; X-Frame-Options; Permissions-Policy; `allowBlobPublicAccess: false` |
| **A06 Vulnerable Components** | Key Vault references (no hardcoded secrets); 90-day secret rotation policy |
| **A07 Authentication Failures** | EasyAuth v2 + app-level double-check; secure-by-default `REQUIRE_AUTH=true` |
| **A08 Data Integrity** | Telemetry deny-list; category allowlist; MIME type restriction on uploads |
| **A09 Logging & Monitoring** | Application Insights on frontend + backend; sanitized telemetry properties |
| **A10 SSRF** | `isValidImageUrl()` — HTTPS-only, `*.blob.core.windows.net` allowlist, private IP blocklist |

---

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CI — Build, Test & Validate | PR to `main` | Lint, type-check, unit tests |
| Deploy Backend | push to `main` (paths: `backend/**`) | Build + deploy to Azure Functions |
| Deploy Frontend | push to `main` (paths: `frontend/**`) | Build + deploy to Azure Static Web Apps |
| E2E Smoke | after Deploy Backend/Frontend completes | Playwright smoke tests against live |
| Provision Infrastructure | push to `main` (paths: `infra/**`) | Bicep deployment |

When adding new code:
- Backend changes → expect CI + Deploy Backend + E2E Smoke to run.
- Frontend changes → expect CI + Deploy Frontend + E2E Smoke to run.
- Infra changes → expect Provision Infrastructure to run.

---

## PR & Commit Standards

- **Branch naming:** `feat/description`, `fix/description`, `chore/description`
- **Commit messages:** conventional commits — `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- **Squash merge** to `main` (keeps history clean)
- **Every PR** must include tests for new/changed functionality
