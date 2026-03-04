---
description: 'Scaffold a new Azure Functions HTTP handler with tests'
agent: 'agent'
---

# New API Endpoint

Create a new Azure Functions HTTP handler following project conventions.

## Required Information
- **Route**: ${input:route} (e.g., `garments/:id`)
- **Method**: ${input:method} (GET, POST, DELETE)
- **Description**: ${input:description}

## Steps

1. **Create handler** in `backend/src/functions/` following the handler template:
   - Import `extractUserId`, `unauthorizedResponse`, `trackEvent`, `trackException`
   - Auth check first
   - Sequential input validation with descriptive 400 errors
   - Call service layer in try/catch
   - Generic 500 error message (log real error server-side)
   - Register with `app.http()` using `authLevel: "anonymous"`

2. **Create/update service** in `backend/src/services/`:
   - Stateless exported functions
   - JSDoc on public functions
   - Use `.js` extensions on imports

3. **Create/update model** in `backend/src/models/` if needed:
   - Pure TypeScript interface
   - Export from `models/index.ts`

4. **Create tests** in `backend/src/functions/<name>.test.ts`:
   - Use test helpers from `testUtils.ts`
   - Test: happy path, 401 (no auth), 400 (bad input), 404 (not found), 500 (server error)

5. **Add frontend API wrapper** in `frontend/src/api.ts`:
   - GET → use `cachedApiFetch`
   - Mutation → use `apiFetch` + `invalidateCache`

6. **Run tests** to verify everything passes
