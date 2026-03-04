---
description: 'Scaffold a new React page component with CSS Module and tests'
agent: 'agent'
---

# New Page Component

Create a new React page component following project conventions.

## Required Information
- **Name**: ${input:pageName} (PascalCase, e.g., `GarmentDetail`)
- **Description**: ${input:description}

## Steps

1. **Create page component** at `frontend/src/pages/${input:pageName}.tsx`:
   - Default export function component
   - Three state variables: `data`, `loading`, `error`
   - `useEffect` with `cancelled` flag for data fetching
   - Three render branches: loading skeleton → error state → data display
   - Import styles from CSS Module

2. **Create CSS Module** at `frontend/src/pages/${input:pageName}.module.css`:
   - Mobile-first responsive design
   - Use CSS custom properties for theming
   - Follow existing naming patterns

3. **Create test file** at `frontend/src/pages/${input:pageName}.test.tsx`:
   - Mock MSAL and fetch
   - Test loading state
   - Test error state
   - Test successful data rendering
   - Test empty state if applicable

4. **Add route** in `frontend/src/App.tsx` if needed

5. **Add API wrapper** in `frontend/src/api.ts` if the page needs a new endpoint
