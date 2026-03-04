---
description: 'Azure Functions v4 backend handler and service conventions'
applyTo: 'backend/**/*.ts'
---

# Azure Functions Backend Conventions

## Handler Pattern

Every function in `backend/src/functions/` follows this template:

```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { extractUserId, unauthorizedResponse } from "../services/authMiddleware.js";
import { trackEvent, trackException } from "../services/telemetryService.js";

export async function myHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const userId = extractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    // validate → call service → return result
    return { status: 200, jsonBody: { /* ... */ } };
  } catch (err: unknown) {
    context.log("myHandler error:", err);
    trackException(err instanceof Error ? err : new Error(String(err)), { userId });
    return { status: 500, jsonBody: { error: "Failed to do X." } };
  }
}

app.http("myHandler", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "my-route",
  handler: myHandler,
});
```

## Key Rules

- `authLevel` is always `"anonymous"` — auth is handled by EasyAuth v2 + `extractUserId()`.
- Responses are plain objects `{ status, jsonBody }` — never use `new Response()`.
- Handlers are self-contained: parse body → auth → validate → call service → return.
- Error responses: `{ status: 500, jsonBody: { error: "Human-readable message." } }`.

## Service Layer

- **Stateless exported functions** (no classes): `export async function createGarment(...)`.
- Internal helpers are module-private (not exported).
- Services call Cosmos DB, Blob Storage, AI services — never import `HttpRequest`.
- JSDoc on all public functions.

## Imports

```typescript
// Always use .js extension on relative imports (ESM Node16 resolution)
import { Garment } from "../models/garment.js";
import { getContainer } from "./cosmosClient.js";
import type { ItemResponse } from "@azure/cosmos";
```

## Data Models

- Pure TypeScript **interfaces** in `backend/src/models/` — no classes, no decorators.
- Re-exported from `models/index.ts` using `export type { ... } from "./file.js"`.
- Timestamps are ISO 8601 strings (`createdAt`, `updatedAt`).

## Validation

- Validation is **sequential** — each check returns `400` immediately with a descriptive message.
- Reuse shared constants: `MAX_NAME_LENGTH`, `MAX_URL_LENGTH`, `MAX_ID_LENGTH`, `ALLOWED_CATEGORIES`.
- Reuse safe-character regexes — do not invent new ones.
- After validating IDs, always load the resource **scoped to `userId`** (IDOR prevention).

## Error Responses

| Status | What to expose | What to hide |
|--------|---------------|--------------|
| 400 | Descriptive validation error | — |
| 401 | `"Authentication required. Please sign in."` | No token info |
| 404 | `"X not found."` | No existence leakage |
| 409 | Idempotency violation message | — |
| 500 | Generic `"Failed to do X."` | Stack traces → log only |
