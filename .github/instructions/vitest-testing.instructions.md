---
description: 'Vitest unit and integration testing conventions'
applyTo: '**/*.test.ts, **/*.test.tsx, **/vitest.config.*'
---

# Vitest Testing Conventions

## Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('POST /api/garments', () => {
  it('creates a garment and returns 201', async () => {
    // arrange → act → assert
  });

  it('returns 400 when name is missing', async () => { ... });
  it('returns 401 when unauthenticated', async () => { ... });
});
```

- Describe blocks: name after HTTP method + route (backend) or component/feature (frontend).
- Test both happy path and error cases (400, 401, 500).
- Test auth rejection for every handler.
- Use AAA pattern: Arrange → Act → Assert.

## Backend Test Helpers

Always use shared helpers from `backend/src/testUtils.ts` — do NOT hand-craft `HttpRequest` objects:

```typescript
import { makeGetRequest, makePostRequest, makeDeleteRequest, makeContext, parseResponseBody, authHeaders, encodeClientPrincipal } from '../testUtils.js';

const request = makePostRequest('/api/garments', body, { headers: authHeaders() });
const context = makeContext();
const response = await postGarment(request, context);
const result = parseResponseBody<CreatedGarment>(response);
```

## Frontend Test Patterns

- Mock MSAL before importing `api.ts`.
- Mock `fetch` via `vi.stubGlobal('fetch', mockFetch)`.
- Clear cache between tests: `clearApiCache()` in `beforeEach`.
- Use `@testing-library/react` for component tests.

## Rules

- Every new function, handler, or component **must** have co-located `*.test.ts` / `*.test.tsx` tests.
- NEVER change the original code solely to make it easier to test.
- Use `vi.fn()` and `vi.mock()` for mocking — never hand-roll mocks.
- Keep tests isolated — no shared mutable state between tests.
- Reset mocks in `beforeEach`.
