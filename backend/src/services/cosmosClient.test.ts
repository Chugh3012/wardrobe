import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({}),
    };
  }),
}));

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

describe("cosmosClient", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when COSMOS_DB_ENDPOINT is not set", async () => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "");
    const { resetClient, getCosmosClient } = await import("./cosmosClient.js");
    resetClient();
    expect(() => getCosmosClient()).toThrow("COSMOS_DB_ENDPOINT environment variable is not set.");
  });

  it("returns a CosmosClient when COSMOS_DB_ENDPOINT is set", async () => {
    const { resetClient, getCosmosClient } = await import("./cosmosClient.js");
    resetClient();
    const client = getCosmosClient();
    expect(client).toBeDefined();
  });

  it("getDatabase returns a database reference", async () => {
    const { resetClient, getDatabase } = await import("./cosmosClient.js");
    resetClient();
    const db = getDatabase();
    expect(db).toBeDefined();
  });
});
