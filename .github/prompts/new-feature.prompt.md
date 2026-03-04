---
description: 'Scaffold a full-stack feature across backend, frontend, and tests'
agent: 'agent'
---

# New Full-Stack Feature

Plan and implement a complete feature spanning backend API, frontend UI, and tests.

## Required Information
- **Feature**: ${input:featureName}
- **Description**: ${input:description}

## Steps

1. **Plan**: Identify all files that need creating or modifying across `backend/`, `frontend/`, and `e2e/`

2. **Backend Model** (if new data entity):
   - Create interface in `backend/src/models/`
   - Export from `models/index.ts`

3. **Backend Service**:
   - Create/update service in `backend/src/services/`
   - Stateless exported functions with JSDoc

4. **Backend Handler**:
   - Create handler in `backend/src/functions/`
   - Auth → Validate → Service → Response
   - Register with `app.http()`

5. **Backend Tests**:
   - Co-located test file using `testUtils.ts` helpers
   - Cover: 200, 400, 401, 404, 500 scenarios

6. **Frontend API**:
   - Add typed wrapper in `frontend/src/api.ts`
   - GET → `cachedApiFetch`, mutation → `apiFetch` + `invalidateCache`

7. **Frontend Component**:
   - Page in `frontend/src/pages/` with CSS Module
   - Loading/error/data render branches

8. **Frontend Tests**:
   - Mock MSAL + fetch, test all render states

9. **E2E Test** (optional):
   - Smoke test in `e2e/tests/`

10. **Run all tests** to verify
