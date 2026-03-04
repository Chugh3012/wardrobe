---
description: 'TypeScript strict-mode conventions for the wardrobe monorepo'
applyTo: '**/*.ts, **/*.tsx'
---

# TypeScript Conventions

## Strict Mode

- Never use `any`. Use `unknown` for caught errors, then narrow with type guards.
- Enable and respect all `strict` flags in `tsconfig.json`.
- Use `import type` for type-only imports.

## Style

- Purely functional — no classes anywhere. Services are stateless exported functions; React uses function components.
- Prefer `const` over `let`; never use `var`.
- Use discriminated unions and exhaustive checks over loose optional fields.
- Use ES2022 features: `??`, `?.`, `Array.at()`, `Object.hasOwn()`.

## Functions

- Use `async/await` for all asynchronous code — never raw `.then()` chains in business logic.
- Use `unknown` in `catch` blocks and narrow: `err instanceof Error ? err : new Error(String(err))`.
- JSDoc block comments on all public/exported functions.

## Modules

- ESM only — `"type": "module"` in `package.json`.
- **Backend**: always use `.js` extension on relative imports (Node16 ESM resolution).
- **Frontend**: no file extensions on relative imports (Vite resolves them).

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files (backend) | camelCase | `garmentService.ts` |
| Files (frontend components) | PascalCase | `Dashboard.tsx` |
| Functions | camelCase | `createGarment` |
| Interfaces / Types | PascalCase | `Garment`, `StatsSummary` |
| Constants | UPPER_SNAKE_CASE | `MAX_PHOTOS`, `CACHE_TTL_MS` |
| Test files | Same name + `.test.ts` | `garmentService.test.ts` |

## Documentation

- JSDoc on all public functions and exported interfaces.
- Section dividers: `// ── Section Name ──────────────────────────────`
- Issue references in comments: `// (Issue #14)`.
- Constants at module top with JSDoc explanations.
