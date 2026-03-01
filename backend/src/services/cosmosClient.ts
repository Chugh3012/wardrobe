/**
 * Shared Cosmos DB client factory.
 *
 * Authenticates via DefaultAzureCredential (Managed Identity in Azure,
 * `az login` or env vars locally). No connection strings or keys are used.
 *
 * Environment variables consumed at call time:
 *   COSMOS_DB_ENDPOINT      — e.g. https://cosmos-wardrobe-dev.documents.azure.com:443/
 *   COSMOS_DB_DATABASE_NAME — e.g. wardrobe
 */
import { CosmosClient, Database } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

let _client: CosmosClient | undefined;

export function getCosmosClient(): CosmosClient {
  if (!_client) {
    const endpoint = process.env["COSMOS_DB_ENDPOINT"];
    if (!endpoint) {
      throw new Error("COSMOS_DB_ENDPOINT environment variable is not set.");
    }
    _client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
  }
  return _client;
}

export function getDatabase(): Database {
  const dbName = process.env["COSMOS_DB_DATABASE_NAME"] ?? "wardrobe";
  return getCosmosClient().database(dbName);
}

/** Reset the cached client — useful for testing. */
export function resetClient(): void {
  _client = undefined;
}
