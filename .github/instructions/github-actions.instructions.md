---
description: 'GitHub Actions CI/CD workflow conventions'
applyTo: '.github/workflows/*.yml'
---

# GitHub Actions Conventions

## Workflow Structure

- Use descriptive `name` for each workflow.
- Use path filters on triggers to avoid unnecessary runs.
- Set `concurrency` to prevent simultaneous runs for the same branch.
- Define `permissions` at workflow level — default to `contents: read`.

## Security

- Access secrets only via `${{ secrets.MY_SECRET }}` — never hardcode.
- Pin actions to full commit SHA or major version tag (`@v4`) — never `main` or `latest`.
- Use OIDC for Azure authentication where possible.
- Set `GITHUB_TOKEN` permissions to minimum needed.

## Caching

- Cache `node_modules` and package manager caches with `actions/cache`.
- Use `hashFiles('**/package-lock.json')` in cache keys.

## Project-Specific Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CI | PR to `main` | Lint, type-check, unit tests |
| Deploy Backend | push to `main` (paths: `backend/**`) | Build + deploy to Azure Functions |
| Deploy Frontend | push to `main` (paths: `frontend/**`) | Build + deploy to Azure Static Web Apps |
| E2E Smoke | after Deploy Backend/Frontend completes | Playwright smoke tests against live |
| Provision Infrastructure | push to `main` (paths: `infra/**`) | Bicep deployment |

## Testing Integration

- Run unit tests early in the pipeline.
- Upload test reports and coverage as artifacts.
- Run E2E tests against staging after deployment.
- Capture screenshots and traces on E2E failure.

## Deployment

- Use GitHub `environment` with approval rules for production.
- Staging deploys automatically on merge to `main`.
- Keep rollback strategies documented and tested.
