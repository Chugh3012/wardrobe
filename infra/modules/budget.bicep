// Provisions a monthly Azure budget alert scoped to the resource group
// to prevent unexpected cost overruns (SEC-P3).
//
// A notification is sent when actual or forecasted spend exceeds defined
// thresholds.  This is a safety net — the Wardrobe Tracker is designed to
// run within the Azure free tier, so any significant spend is anomalous.

targetScope = 'resourceGroup'

@description('Monthly budget amount in USD.')
param monthlyBudgetUsd int = 5

@description('Email addresses to receive budget alerts.')
param alertEmailAddresses array = []

@description('Short environment name used in resource names.')
param environmentName string

@description('Current UTC timestamp — used to derive the budget start date. Do not override manually.')
param now string = utcNow('yyyy-MM')

// ── Budget ────────────────────────────────────────────────────────────────────

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-wardrobe-${environmentName}'
  properties: {
    category: 'Cost'
    amount: monthlyBudgetUsd
    timeGrain: 'Monthly'
    timePeriod: {
      // Start from the first of the current month; Azure auto-renews monthly.
      startDate: '${now}-01'
    }
    notifications: {
      actual80Pct: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        contactEmails: alertEmailAddresses
        thresholdType: 'Actual'
      }
      actual100Pct: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        contactEmails: alertEmailAddresses
        thresholdType: 'Actual'
      }
      forecasted120Pct: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 120
        contactEmails: alertEmailAddresses
        thresholdType: 'Forecasted'
      }
    }
  }
}
