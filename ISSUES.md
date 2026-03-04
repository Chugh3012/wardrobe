# Wardrobe Tracker — Issue Breakdown

This document tracks remaining features, tech debt, and enhancements for the Wardrobe Tracker project.

**Phase 1 (MVP) is complete** — all 18 issues (#0–#15.6, #21) including security hardening (#13.5, #13.6, #13.7) have been implemented and verified against the codebase.

---

## Remaining Tech Debt (from Phase 1 audits)

| ID | Gap | Origin | Notes |
|----|-----|--------|-------|
| **F5** | No retrain trigger for Custom Vision | Issue #13.5 | Training images are submitted but the model is never retrained/republished. Will be addressed by Issue #16. |
| **F7** | Key Vault secrets not auto-populated | Issue #13.5 | Bicep creates Key Vault but secrets require manual `az keyvault secret set`. No CI automation. |

---

## Phase 2

### Issue #16: Retraining Pipeline from User Corrections

- [ ] **Status:** Open

**Description:**
Build a pipeline that uses accumulated user corrections stored in `PredictionAudit.userFinalSelection` to periodically retrain the Custom Vision model. This closes the feedback loop and improves prediction accuracy over time.

**Acceptance Criteria:**
- A retraining job (Azure Function or Logic App) reads `PredictionAudit` records where `userFinalSelection` differs from the top prediction.
- Corrected images are submitted to Custom Vision as additional training images for the correct garment tag.
- Retraining is triggered on a schedule (e.g., weekly) or when a threshold number of corrections accumulates.
- Model is republished after retraining.
- Retraining activity is logged to Application Insights.

**Phone-Test Validation:**
> After submitting several corrections for a specific garment (via Issue #8), trigger a retraining cycle. Upload a photo of that garment from a phone and verify the prediction accuracy has improved compared to before retraining.

---

### Issue #17: Duplicate/Near-Similar Dress Disambiguation

- [ ] **Status:** Open

**Description:**
Handle cases where two or more garments in the catalog look visually very similar. When the model cannot confidently distinguish between them, prompt the user to manually select from the candidates. Track disambiguation choices to improve future predictions.

**Acceptance Criteria:**
- When the top-2 predictions are within a configurable similarity margin (e.g., confidence difference < 10%), a disambiguation prompt is shown.
- Disambiguation UI shows side-by-side thumbnails of the candidate garments for the user to select.
- User's selection is recorded and used as the confirmed garment for the wear event.
- Disambiguation events are logged for analysis.

**Phone-Test Validation:**
> Add two visually similar garments to the catalog on a phone. Upload an outfit photo that could match either garment. Verify the app shows a disambiguation prompt with thumbnails of both candidates for the user to choose from.

---

### Issue #18: Monthly Insights ("Not Worn in 60 Days")

- [ ] **Status:** Open

**Description:**
Surface insights about underutilized garments — specifically, items that haven't been worn in the last 60 days. Display these on a dedicated insights page or as dashboard notifications to encourage better wardrobe utilization.

**Acceptance Criteria:**
- A query identifies garments where `WearEvent.createdAt` (most recent) is older than 60 days, or garments with zero wear events.
- An insights section/page in the app displays these garments with a "Not worn in X days" label.
- The 60-day threshold is configurable.
- Insights are scoped to the authenticated user.
- Insights page is mobile-friendly and navigable from the main menu.

**Phone-Test Validation:**
> Open the insights page on a phone. Verify garments that have not been logged as worn in 60+ days (or have never been worn) appear in the "not worn" suggestions list with an accurate "not worn in X days" label.

---

## Phase 3

### Issue #19: Cost Optimization & Archival Policy

- [ ] **Status:** Open

**Description:**
Review and optimize the Azure resource costs incurred by the wardrobe tracker. Implement image archival to cool/archive Blob tier for old images, review Cosmos DB RU consumption, and audit Azure Functions execution costs. Aim to keep the app within the Azure free tier or minimal paid tier for personal use.

> **Note:** A $5/month budget alert with three notification tiers (80% actual, 100% actual, 120% forecasted) was already provisioned in Issue #13.6 (SEC-P3) via `infra/modules/budget.bicep`. The remaining work in this issue focuses on lifecycle policies, consumption reviews, and cost documentation.

**Acceptance Criteria:**
- Blob Storage lifecycle management policy is configured: images older than 90 days are moved to cool tier; images older than 365 days are moved to archive tier.
- Cosmos DB consumption is reviewed; serverless mode is confirmed as cost-optimal for low-traffic personal use.
- Azure Functions execution count and duration are reviewed against Consumption plan free grant.
- Application Insights sampling is validated to avoid excessive data ingestion costs.
- ~~A cost estimate (or Azure Cost Management view) is documented for steady-state monthly usage.~~ ✅ Done in #13.6 — budget alert at $5/month with email notifications.
- Review and adjust the budget threshold in `budget.bicep` based on actual steady-state usage data.

**Validation:**
> Review the Azure Cost Management dashboard after one month of usage. Verify the budget alert from #13.6 is active and firing at the correct thresholds. Confirm Blob archival policy is triggering for old images.

---

### Issue #20: Recommendation Features

- [ ] **Status:** Open

**Description:**
Add outfit recommendation features to the dashboard based on historical wear patterns. Recommendations may consider: wear frequency (surface underused items), last-worn date, or future extensibility hooks for weather/occasion. This is a Phase 3 enhancement and should not block any MVP or Phase 2 work.

**Acceptance Criteria:**
- A recommendations section appears on the dashboard or a dedicated page.
- At minimum, recommendations surface: "You haven't worn X in a while" and "Your most-worn item this month is Y".
- Recommendations are generated server-side via `GET /stats/summary` or a new `GET /recommendations` endpoint.
- Recommendations are mobile-friendly and display garment thumbnails.
- Recommendation logic is configurable and extensible for future signals (weather, occasion).

**Phone-Test Validation:**
> Open the app on a phone and navigate to the dashboard or recommendations page. Verify outfit/garment recommendations are displayed, including at least one "not worn recently" suggestion and one "most worn" insight, with garment thumbnails.

---

## Issue Summary

| Issue | Title | Phase | Status |
|-------|-------|-------|--------|
| #16 | Retraining Pipeline from User Corrections | Phase 2 | [ ] Open |
| #17 | Duplicate/Near-Similar Dress Disambiguation | Phase 2 | [ ] Open |
| #18 | Monthly Insights ("Not Worn in 60 Days") | Phase 2 | [ ] Open |
| #19 | Cost Optimization & Archival Policy | Phase 3 | [ ] Open |
| #20 | Recommendation Features | Phase 3 | [ ] Open |

### Completed (Phase 1 MVP — archived)

All Phase 1 issues were verified against the codebase on 2026-03-04 and removed from this document:

| Issues | Summary |
|--------|---------|
| #0 | Testing strategy (`TESTING_STRATEGY.md`) |
| #1, #1.5 | SWA frontend PWA + Bicep infrastructure (OIDC) |
| #2–#4 | Azure Functions backend, Blob Storage, Cosmos DB + data models |
| #5–#9 | Core API endpoints: garments CRUD, wear predict/confirm, stats summary |
| #10–#12 | AI Custom Vision, embedding fallback, confidence-based UX guardrails |
| #13, #13.5, #13.6, #13.7 | Identity, security hardening (S1–S14, SEC-P1–P6), EasyAuth wiring |
| #14 | Observability (Application Insights, Log Analytics, telemetry) |
| #15, #15.5, #15.6 | E2E flow validation, SWA auth pattern A, MSAL + EasyAuth v2 |
| #21 | `DELETE /wear/events/{id}` |
