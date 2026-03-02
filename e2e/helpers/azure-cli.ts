/**
 * Helper: execute Azure CLI commands and return parsed JSON output.
 *
 * Requires `az` CLI to be installed and the user to be logged in
 * (`az login` or OIDC in CI).
 */

import { execSync } from 'node:child_process';

export interface AzCliResult<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Run an `az` CLI command and return the JSON-parsed result.
 * Returns `{ success: false, error }` if the command fails.
 */
export function az<T = unknown>(args: string): AzCliResult<T> {
  try {
    const raw = execSync(`az ${args} --output json`, {
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, data: JSON.parse(raw) as T, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, error: msg };
  }
}

/**
 * Check if the user is logged in to Azure CLI.
 */
export function isLoggedIn(): boolean {
  const result = az('account show');
  return result.success;
}

// ── Environment helpers ─────────────────────────────────────────────────────

export const ENV = process.env.ENVIRONMENT_NAME || 'dev';
export const RG = process.env.AZURE_RESOURCE_GROUP || `rg-wardrobe-${ENV}`;
export const SUBSCRIPTION = process.env.AZURE_SUBSCRIPTION_ID || '';
export const SWA_URL = process.env.SWA_URL || '';
export const FUNC_URL = process.env.FUNC_URL || '';

// ── Expected resource names (must match main.bicep) ─────────────────────────

export const EXPECTED_RESOURCES = {
  resourceGroup: `rg-wardrobe-${ENV}`,
  staticWebApp: `swa-wardrobe-${ENV}`,
  functionApp: `func-wardrobe-${ENV}`,
  appServicePlan: `plan-wardrobe-${ENV}`,
  cosmosAccount: `cosmos-wardrobe-${ENV}`,
  blobStorage: `stwardrobeimg${ENV}`,
  functionsStorage: `stwardrobefn${ENV}`,
  keyVault: `kv-wardrobe-${ENV}`,
  cvTraining: `cv-train-wardrobe-${ENV}`,
  cvPrediction: `cv-pred-wardrobe-${ENV}`,
  aiVision: `cv-vision-wardrobe-${ENV}`,
  appInsights: `appi-wardrobe-${ENV}`,
  logAnalytics: `log-wardrobe-${ENV}`,
  budget: `budget-wardrobe-${ENV}`,
  cosmosDatabase: 'wardrobe',
  cosmosContainers: ['garments', 'wearEvents', 'predictionAudits'],
  blobContainer: 'images',
} as const;

export const EXPECTED_TAGS = {
  project: 'wardrobe',
  environment: ENV,
  managedBy: 'bicep',
};
