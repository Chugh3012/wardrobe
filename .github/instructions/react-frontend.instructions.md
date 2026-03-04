---
description: 'React 19 frontend conventions for the wardrobe PWA'
applyTo: 'frontend/**/*.tsx, frontend/**/*.ts, frontend/**/*.css'
---

# React Frontend Conventions

## Component Pattern

- **Default export** for React components; **named exports** for utilities/services.
- Function components only — no classes.
- **CSS Modules** for all styling: `import styles from './Component.module.css'` → `className={styles.xxx}`.
- No prop spreading — destructure explicitly.

## Data Fetching

Every page component follows this pattern:

```tsx
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  setLoading(true);
  fetchSomething()
    .then((d) => { if (!cancelled) { setData(d); setError(null); } })
    .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed.'); })
    .finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, []);
```

- **Three rendering branches** in every page: loading → error → data (with empty state if applicable).
- **`useEffect` cleanup** with `cancelled` flag to prevent state updates after unmount.

## API Client (`frontend/src/api.ts`)

- All backend calls go through typed wrapper functions in `api.ts`.
- GET calls use `cachedApiFetch<T>()` (in-memory cache with 5-min TTL + in-flight dedup).
- Mutations (`POST`, `DELETE`) use `apiFetch<T>()` directly and **invalidate relevant caches** after success.
- MSAL Bearer tokens are acquired via `acquireTokenSilent()` on every call.
- When adding a new GET endpoint: use `cachedApiFetch`.
- When adding a new mutation: use `apiFetch` + call `invalidateCache(...)` with affected prefixes.

## Imports

```typescript
// No file extensions (Vite resolves them)
import { fetchGarments, type GarmentSummary } from '../api';
import styles from './Catalog.module.css';
```

## Accessibility

- Use semantic HTML elements (`<main>`, `<nav>`, `<header>`, `<footer>`).
- Every interactive element must be keyboard operable.
- Images require meaningful `alt` text; decorative images use `alt=""`.
- Form inputs must have associated `<label>` elements.
- Ensure 4.5:1 contrast ratio for text, 3:1 for focus indicators.
- Use `aria-label` when visible labels are insufficient.

## Performance

- Use `React.memo` only when profiling shows unnecessary re-renders.
- Implement code splitting with `React.lazy` and `Suspense` for routes.
- Keep component files small and focused on a single concern.
