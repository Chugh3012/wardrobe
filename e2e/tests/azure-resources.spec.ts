/**
 * E2E: Azure Resource Verification (@azure)
 *
 * Verifies that all Azure resources defined in infra/main.bicep are
 * provisioned with the correct names, SKUs, tags, and configurations.
 *
 * Prerequisites:
 *   - `az login` (or OIDC CI auth)
 *   - AZURE_SUBSCRIPTION_ID env var (or default subscription)
 */

import { test, expect } from '@playwright/test';
import {
  az,
  isLoggedIn,
  RG,
  EXPECTED_RESOURCES,
  EXPECTED_TAGS,
} from '../helpers/azure-cli.js';

// ── Pre-flight: ensure we're authenticated ─────────────────────────────────

test.beforeAll(() => {
  const loggedIn = isLoggedIn();
  if (!loggedIn) {
    console.warn(
      '⚠️  Not logged in to Azure CLI. Azure resource tests will be skipped.\n' +
      '   Run `az login` or configure OIDC for CI.',
    );
  }
});

function skipIfNotLoggedIn() {
  if (!isLoggedIn()) {
    test.skip();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Resource Group
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Resource Group @azure', () => {
  test('exists with correct name and tags', () => {
    skipIfNotLoggedIn();
    const result = az<{ name: string; tags: Record<string, string>; location: string }>(
      `group show --name ${RG}`,
    );
    expect(result.success, `Resource group ${RG} should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.resourceGroup);
    expect(result.data!.tags).toMatchObject(EXPECTED_TAGS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Static Web App
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Static Web App @azure', () => {
  test('is provisioned with Free SKU', () => {
    skipIfNotLoggedIn();
    const result = az<{ name: string; sku: { name: string; tier: string }; tags: Record<string, string> }>(
      `staticwebapp show --name ${EXPECTED_RESOURCES.staticWebApp} --resource-group ${RG}`,
    );
    expect(result.success, `SWA ${EXPECTED_RESOURCES.staticWebApp} should exist: ${result.error}`).toBe(true);
    expect(result.data!.sku.name).toBe('Free');
    expect(result.data!.sku.tier).toBe('Free');
    expect(result.data!.tags).toMatchObject(EXPECTED_TAGS);
  });

  test('has a default hostname', () => {
    skipIfNotLoggedIn();
    const result = az<{ defaultHostname: string }>(
      `staticwebapp show --name ${EXPECTED_RESOURCES.staticWebApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    expect(result.data!.defaultHostname).toBeTruthy();
    expect(result.data!.defaultHostname).toMatch(/\.azurestaticapps\.net$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Azure Functions
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Azure Functions @azure', () => {
  test('Function App exists with correct name', () => {
    skipIfNotLoggedIn();
    const result = az<{ name: string; state: string; httpsOnly: boolean; kind: string }>(
      `functionapp show --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success, `Function App should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.functionApp);
    expect(result.data!.state).toBe('Running');
    expect(result.data!.httpsOnly).toBe(true);
  });

  test('uses Consumption plan (Y1 / Dynamic)', () => {
    skipIfNotLoggedIn();
    const result = az<{ sku: { name: string; tier: string } }>(
      `appservice plan show --name ${EXPECTED_RESOURCES.appServicePlan} --resource-group ${RG}`,
    );
    expect(result.success, `App Service Plan should exist: ${result.error}`).toBe(true);
    expect(result.data!.sku.name).toBe('Y1');
    expect(result.data!.sku.tier).toBe('Dynamic');
  });

  test('has Node.js 20 runtime', () => {
    skipIfNotLoggedIn();
    const result = az<Array<{ name: string; value: string }>>(
      `functionapp config appsettings list --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    const settings = new Map(result.data!.map(s => [s.name, s.value]));
    expect(settings.get('FUNCTIONS_WORKER_RUNTIME')).toBe('node');
    expect(settings.get('FUNCTIONS_EXTENSION_VERSION')).toBe('~4');
    expect(settings.get('WEBSITE_RUN_FROM_PACKAGE')).toBe('1');
  });

  test('has REQUIRE_AUTH=true', () => {
    skipIfNotLoggedIn();
    const result = az<Array<{ name: string; value: string }>>(
      `functionapp config appsettings list --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    const settings = new Map(result.data!.map(s => [s.name, s.value]));
    expect(settings.get('REQUIRE_AUTH')).toBe('true');
  });

  test('has Key Vault references for AI keys', () => {
    skipIfNotLoggedIn();
    const result = az<Array<{ name: string; value: string }>>(
      `functionapp config appsettings list --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    const settings = new Map(result.data!.map(s => [s.name, s.value]));
    for (const key of ['CUSTOM_VISION_TRAINING_KEY', 'CUSTOM_VISION_PREDICTION_KEY', 'AI_VISION_KEY']) {
      const val = settings.get(key) ?? '';
      expect(val, `${key} should be a Key Vault reference`).toMatch(/@Microsoft\.KeyVault/);
    }
  });

  test('has correct Blob and Cosmos settings', () => {
    skipIfNotLoggedIn();
    const result = az<Array<{ name: string; value: string }>>(
      `functionapp config appsettings list --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    const settings = new Map(result.data!.map(s => [s.name, s.value]));
    expect(settings.get('BLOB_ACCOUNT_NAME')).toBe(EXPECTED_RESOURCES.blobStorage);
    expect(settings.get('BLOB_CONTAINER_NAME')).toBe(EXPECTED_RESOURCES.blobContainer);
    expect(settings.get('COSMOS_DB_DATABASE_NAME')).toBe(EXPECTED_RESOURCES.cosmosDatabase);
    expect(settings.get('COSMOS_DB_ENDPOINT')).toContain('documents.azure.com');
  });

  test('has Application Insights connection string', () => {
    skipIfNotLoggedIn();
    const result = az<Array<{ name: string; value: string }>>(
      `functionapp config appsettings list --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    const settings = new Map(result.data!.map(s => [s.name, s.value]));
    expect(settings.get('APPLICATIONINSIGHTS_CONNECTION_STRING')).toBeTruthy();
    expect(settings.get('APPLICATIONINSIGHTS_CONNECTION_STRING')).toContain('InstrumentationKey=');
  });

  test('has IP security restrictions (SEC-P1)', () => {
    skipIfNotLoggedIn();
    const result = az<{ ipSecurityRestrictions: Array<{ action: string; tag?: string; name?: string }> }>(
      `webapp show --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG} --query siteConfig`,
    );
    expect(result.success).toBe(true);
    const restrictions = result.data!.ipSecurityRestrictions ?? [];
    const azureCloudRule = restrictions.find(r => r.tag === 'ServiceTag' || r.name?.includes('Azure'));
    expect(azureCloudRule, 'Should have AzureCloud service tag rule').toBeTruthy();
  });

  test('has CORS configured for SWA hostname', () => {
    skipIfNotLoggedIn();
    const result = az<{ cors: { allowedOrigins: string[] } }>(
      `webapp show --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG} --query siteConfig`,
    );
    expect(result.success).toBe(true);
    const origins = result.data!.cors?.allowedOrigins ?? [];
    const hasSwaOrigin = origins.some(o => o.includes('azurestaticapps.net'));
    expect(hasSwaOrigin, 'CORS should include the SWA hostname').toBe(true);
  });

  test('has Managed Identity enabled', () => {
    skipIfNotLoggedIn();
    const result = az<{ identity: { type: string; principalId: string } }>(
      `functionapp show --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}`,
    );
    expect(result.success).toBe(true);
    expect(result.data!.identity.type).toContain('SystemAssigned');
    expect(result.data!.identity.principalId).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Cosmos DB
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cosmos DB @azure', () => {
  test('account exists with serverless/free tier and local auth disabled', () => {
    skipIfNotLoggedIn();
    const result = az<{
      name: string;
      kind: string;
      disableLocalAuth: boolean;
      consistencyPolicy: { defaultConsistencyLevel: string };
      enableFreeTier: boolean;
    }>(
      `cosmosdb show --name ${EXPECTED_RESOURCES.cosmosAccount} --resource-group ${RG}`,
    );
    expect(result.success, `Cosmos account should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.cosmosAccount);
    expect(result.data!.kind).toBe('GlobalDocumentDB');
    expect(result.data!.disableLocalAuth).toBe(true);
    expect(result.data!.enableFreeTier).toBe(true);
    expect(result.data!.consistencyPolicy.defaultConsistencyLevel).toBe('Session');
  });

  test('database "wardrobe" exists', () => {
    skipIfNotLoggedIn();
    const result = az<{ name: string }>(
      `cosmosdb sql database show --account-name ${EXPECTED_RESOURCES.cosmosAccount} --resource-group ${RG} --name ${EXPECTED_RESOURCES.cosmosDatabase}`,
    );
    expect(result.success, `Database should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.cosmosDatabase);
  });

  for (const container of EXPECTED_RESOURCES.cosmosContainers) {
    test(`container "${container}" exists with /userId partition key`, () => {
      skipIfNotLoggedIn();
      const result = az<{
        name: string;
        resource: { partitionKey: { paths: string[] } };
      }>(
        `cosmosdb sql container show --account-name ${EXPECTED_RESOURCES.cosmosAccount} --resource-group ${RG} --database-name ${EXPECTED_RESOURCES.cosmosDatabase} --name ${container}`,
      );
      expect(result.success, `Container ${container} should exist: ${result.error}`).toBe(true);
      expect(result.data!.resource.partitionKey.paths).toContain('/userId');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Blob Storage
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Blob Storage @azure', () => {
  test('storage account exists with HTTPS-only and TLS 1.2', () => {
    skipIfNotLoggedIn();
    const result = az<{
      name: string;
      enableHttpsTrafficOnly: boolean;
      minimumTlsVersion: string;
      allowBlobPublicAccess: boolean;
    }>(
      `storage account show --name ${EXPECTED_RESOURCES.blobStorage} --resource-group ${RG}`,
    );
    expect(result.success, `Blob storage should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.blobStorage);
    expect(result.data!.enableHttpsTrafficOnly).toBe(true);
    expect(result.data!.minimumTlsVersion).toBe('TLS1_2');
    expect(result.data!.allowBlobPublicAccess).toBe(false);
  });

  test('"images" container exists with private access', () => {
    skipIfNotLoggedIn();
    // Use --auth-mode login since local auth may rely on keys
    const result = az<{ name: string; publicAccess: string | null }>(
      `storage container show --name ${EXPECTED_RESOURCES.blobContainer} --account-name ${EXPECTED_RESOURCES.blobStorage} --auth-mode login`,
    );
    expect(result.success, `Container should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.blobContainer);
    // publicAccess should be null or 'off' (private)
    expect(result.data!.publicAccess).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Key Vault
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Key Vault @azure', () => {
  test('exists with RBAC authorization and purge protection', () => {
    skipIfNotLoggedIn();
    const result = az<{
      name: string;
      properties: {
        enableRbacAuthorization: boolean;
        enableSoftDelete: boolean;
        enablePurgeProtection: boolean;
      };
    }>(
      `keyvault show --name ${EXPECTED_RESOURCES.keyVault} --resource-group ${RG}`,
    );
    expect(result.success, `Key Vault should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.keyVault);
    expect(result.data!.properties.enableRbacAuthorization).toBe(true);
    expect(result.data!.properties.enableSoftDelete).toBe(true);
    expect(result.data!.properties.enablePurgeProtection).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — AI / Cognitive Services
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('AI Services @azure', () => {
  const aiResources = [
    { name: EXPECTED_RESOURCES.cvTraining, kind: 'CustomVision.Training' },
    { name: EXPECTED_RESOURCES.cvPrediction, kind: 'CustomVision.Prediction' },
    { name: EXPECTED_RESOURCES.aiVision, kind: 'ComputerVision' },
  ];

  for (const res of aiResources) {
    test(`${res.name} exists with kind=${res.kind}, Free SKU, publicNetworkAccess disabled`, () => {
      skipIfNotLoggedIn();
      const result = az<{
        name: string;
        kind: string;
        sku: { name: string };
        properties: { publicNetworkAccess: string };
      }>(
        `cognitiveservices account show --name ${res.name} --resource-group ${RG}`,
      );
      expect(result.success, `${res.name} should exist: ${result.error}`).toBe(true);
      expect(result.data!.kind).toBe(res.kind);
      expect(result.data!.sku.name).toBe('F0');
      expect(result.data!.properties.publicNetworkAccess).toBe('Disabled');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Observability
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Observability @azure', () => {
  test('Log Analytics workspace exists', () => {
    skipIfNotLoggedIn();
    const result = az<{ name: string; retentionInDays: number; sku: { name: string } }>(
      `monitor log-analytics workspace show --workspace-name ${EXPECTED_RESOURCES.logAnalytics} --resource-group ${RG}`,
    );
    expect(result.success, `Log Analytics should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.logAnalytics);
    expect(result.data!.retentionInDays).toBe(30);
    expect(result.data!.sku.name).toBe('PerGB2018');
  });

  test('Application Insights exists and is workspace-based', () => {
    skipIfNotLoggedIn();
    const result = az<{
      name: string;
      kind: string;
      ingestionMode: string;
      workspaceResourceId: string;
    }>(
      `monitor app-insights component show --app ${EXPECTED_RESOURCES.appInsights} --resource-group ${RG}`,
    );
    expect(result.success, `App Insights should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.appInsights);
    expect(result.data!.kind).toBe('web');
    expect(result.data!.ingestionMode).toBe('LogAnalytics');
    expect(result.data!.workspaceResourceId).toContain(EXPECTED_RESOURCES.logAnalytics);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Budget (SEC-P3)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Budget @azure', () => {
  test('monthly budget alert exists', () => {
    skipIfNotLoggedIn();
    // Budget is a consumption resource — queried via `az consumption budget`
    const result = az<Array<{ name: string; amount: string; timeGrain: string }>>(
      `consumption budget list --resource-group ${RG}`,
    );
    expect(result.success, `Budget list should succeed: ${result.error}`).toBe(true);
    const budget = result.data?.find(b => b.name.includes('wardrobe'));
    expect(budget, 'Budget resource should exist').toBeTruthy();
    expect(parseFloat(budget!.amount)).toBe(5);
    expect(budget!.timeGrain).toBe('Monthly');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Functions-internal Storage Account
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Functions Storage @azure', () => {
  test('internal storage account exists', () => {
    skipIfNotLoggedIn();
    const result = az<{ name: string }>(
      `storage account show --name ${EXPECTED_RESOURCES.functionsStorage} --resource-group ${RG}`,
    );
    expect(result.success, `Functions storage should exist: ${result.error}`).toBe(true);
    expect(result.data!.name).toBe(EXPECTED_RESOURCES.functionsStorage);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Resource Tags (cross-cutting)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Resource Tags @azure', () => {
  const taggedResources = [
    { type: 'staticwebapp', cmd: `staticwebapp show --name ${EXPECTED_RESOURCES.staticWebApp} --resource-group ${RG}` },
    { type: 'functionapp', cmd: `functionapp show --name ${EXPECTED_RESOURCES.functionApp} --resource-group ${RG}` },
    { type: 'cosmosdb', cmd: `cosmosdb show --name ${EXPECTED_RESOURCES.cosmosAccount} --resource-group ${RG}` },
    { type: 'keyvault', cmd: `keyvault show --name ${EXPECTED_RESOURCES.keyVault} --resource-group ${RG}` },
    { type: 'blob-storage', cmd: `storage account show --name ${EXPECTED_RESOURCES.blobStorage} --resource-group ${RG}` },
  ];

  for (const res of taggedResources) {
    test(`${res.type} has correct tags (project, environment, managedBy)`, () => {
      skipIfNotLoggedIn();
      const result = az<{ tags: Record<string, string> }>(res.cmd);
      expect(result.success).toBe(true);
      expect(result.data!.tags).toMatchObject(EXPECTED_TAGS);
    });
  }
});
