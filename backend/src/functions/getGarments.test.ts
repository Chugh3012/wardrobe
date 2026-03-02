import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFetchAll = vi.fn();
const mockQuery = vi.fn().mockReturnValue({ fetchAll: mockFetchAll });

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({
        container: () => ({
          items: {
            query: mockQuery,
          },
        }),
      }),
    };
  }),
}));

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(userId?: string): HttpRequest {
  return new HttpRequest({
    method: "GET",
    url: "http://localhost:7071/api/garments",
    ...(userId ? { headers: { "x-ms-client-principal-id": userId } } : {}),
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "getGarments" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/garments", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns 200 with garment list including thumbnailUrl", async () => {
    const garments = [
      {
        id: "g1",
        userId: "user-1",
        name: "Blue Shirt",
        category: "top",
        catalogImageUrls: ["https://blob.example.com/img1.jpg", "https://blob.example.com/img2.jpg"],
        wearCount: 3,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "g2",
        userId: "user-1",
        name: "Red Dress",
        category: "dress",
        catalogImageUrls: ["https://blob.example.com/img3.jpg"],
        wearCount: 1,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    mockFetchAll.mockResolvedValue({ resources: garments });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    expect((res.jsonBody as { garments: unknown[] }).garments).toEqual([
      {
        id: "g1",
        name: "Blue Shirt",
        category: "top",
        wearCount: 3,
        thumbnailUrl: "https://blob.example.com/img1.jpg",
      },
      {
        id: "g2",
        name: "Red Dress",
        category: "dress",
        wearCount: 1,
        thumbnailUrl: "https://blob.example.com/img3.jpg",
      },
    ]);
  });

  it("returns 200 with empty array when user has no garments", async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    expect((res.jsonBody as { garments: unknown[] }).garments).toEqual([]);
  });

  it("returns thumbnailUrl as null when catalogImageUrls is empty", async () => {
    const garments = [
      {
        id: "g1",
        userId: "user-1",
        name: "Mystery Item",
        category: "other",
        catalogImageUrls: [],
        wearCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    mockFetchAll.mockResolvedValue({ resources: garments });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const items = (res.jsonBody as { garments: Array<{ thumbnailUrl: string | null }> }).garments;
    expect(items[0].thumbnailUrl).toBeNull();
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest(), makeContext());

    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("returns 401 when auth header is empty", async () => {
    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("  "), makeContext());

    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns 500 when listGarments throws", async () => {
    mockFetchAll.mockRejectedValue(new Error("Cosmos DB unavailable"));

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to list garments");
  });
});
