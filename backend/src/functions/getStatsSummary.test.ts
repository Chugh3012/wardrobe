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
  const url = userId
    ? `http://localhost:7071/api/stats/summary?userId=${encodeURIComponent(userId)}`
    : "http://localhost:7071/api/stats/summary";

  return new HttpRequest({
    method: "GET",
    url,
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "getStatsSummary" });
}

function sampleGarments() {
  return [
    {
      id: "g1",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: ["https://blob.example.com/img1.jpg"],
      wearCount: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-15T00:00:00.000Z",
    },
    {
      id: "g2",
      userId: "user-1",
      name: "Red Dress",
      category: "dress",
      catalogImageUrls: ["https://blob.example.com/img2.jpg"],
      wearCount: 1,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-10T00:00:00.000Z",
    },
  ];
}

function sampleWearEvents() {
  return [
    {
      id: "evt-1",
      userId: "user-1",
      garmentId: "g1",
      outfitImageUrl: "https://blob.example.com/outfits/p1.jpg",
      predictedGarmentId: "g1",
      confidence: 0.95,
      confirmed: true,
      createdAt: "2026-02-15T00:00:00.000Z",
    },
    {
      id: "evt-2",
      userId: "user-1",
      garmentId: "g1",
      outfitImageUrl: "https://blob.example.com/outfits/p2.jpg",
      predictedGarmentId: "g1",
      confidence: 0.90,
      confirmed: true,
      createdAt: "2026-02-10T00:00:00.000Z",
    },
    {
      id: "evt-3",
      userId: "user-1",
      garmentId: "g2",
      outfitImageUrl: "https://blob.example.com/outfits/p3.jpg",
      predictedGarmentId: "g2",
      confidence: 0.88,
      confirmed: true,
      createdAt: "2026-01-10T00:00:00.000Z",
    },
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/stats/summary", () => {
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

  it("returns 200 with full stats summary", async () => {
    // listGarments then listWearEvents (both use query → fetchAll)
    mockFetchAll
      .mockResolvedValueOnce({ resources: sampleGarments() })
      .mockResolvedValueOnce({ resources: sampleWearEvents() });

    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);

    const json = res.jsonBody as {
      totalGarments: number;
      totalWearEvents: number;
      garments: Array<{
        garmentId: string;
        name: string;
        category: string;
        wearCount: number;
        lastWornDate: string | null;
      }>;
      mostWorn: Array<{ garmentId: string; name: string; wearCount: number }>;
      leastWorn: Array<{ garmentId: string; name: string; wearCount: number }>;
    };

    expect(json.totalGarments).toBe(2);
    expect(json.totalWearEvents).toBe(3);

    // Per-garment stats
    expect(json.garments).toEqual([
      {
        garmentId: "g1",
        name: "Blue Shirt",
        category: "top",
        wearCount: 5,
        lastWornDate: "2026-02-15T00:00:00.000Z",
      },
      {
        garmentId: "g2",
        name: "Red Dress",
        category: "dress",
        wearCount: 1,
        lastWornDate: "2026-01-10T00:00:00.000Z",
      },
    ]);

    // Most-worn / least-worn
    expect(json.mostWorn).toEqual([
      { garmentId: "g1", name: "Blue Shirt", wearCount: 5 },
    ]);
    expect(json.leastWorn).toEqual([
      { garmentId: "g2", name: "Red Dress", wearCount: 1 },
    ]);
  });

  it("returns 200 with empty summary when user has no garments", async () => {
    mockFetchAll
      .mockResolvedValueOnce({ resources: [] })
      .mockResolvedValueOnce({ resources: [] });

    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);

    const json = res.jsonBody as {
      totalGarments: number;
      totalWearEvents: number;
      garments: unknown[];
      mostWorn: unknown[];
      leastWorn: unknown[];
    };

    expect(json.totalGarments).toBe(0);
    expect(json.totalWearEvents).toBe(0);
    expect(json.garments).toEqual([]);
    expect(json.mostWorn).toEqual([]);
    expect(json.leastWorn).toEqual([]);
  });

  it("returns lastWornDate as null for garments with no wear events", async () => {
    const garments = [sampleGarments()[0]]; // only g1
    mockFetchAll
      .mockResolvedValueOnce({ resources: garments })
      .mockResolvedValueOnce({ resources: [] }); // no wear events

    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const json = res.jsonBody as {
      garments: Array<{ lastWornDate: string | null }>;
    };
    expect(json.garments[0].lastWornDate).toBeNull();
  });

  it("shows multiple garments as most-worn when tied", async () => {
    const garments = [
      { ...sampleGarments()[0], wearCount: 3 },
      { ...sampleGarments()[1], wearCount: 3 },
    ];
    mockFetchAll
      .mockResolvedValueOnce({ resources: garments })
      .mockResolvedValueOnce({ resources: [] });

    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const json = res.jsonBody as {
      mostWorn: Array<{ garmentId: string; wearCount: number }>;
      leastWorn: Array<{ garmentId: string; wearCount: number }>;
    };
    expect(json.mostWorn).toHaveLength(2);
    expect(json.leastWorn).toHaveLength(2);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when userId query param is missing", async () => {
    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest(), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("userId");
  });

  it("returns 400 when userId query param is empty", async () => {
    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest("  "), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("userId");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns 500 when listGarments throws", async () => {
    mockFetchAll.mockRejectedValueOnce(new Error("Cosmos DB unavailable"));

    const { getStatsSummary } = await import("./getStatsSummary.js");
    const res = await getStatsSummary(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to retrieve stats");
  });
});
