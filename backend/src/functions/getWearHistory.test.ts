import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFetchAll = vi.fn();
const mockFetchNext = vi.fn();
const mockQuery = vi.fn().mockReturnValue({ fetchAll: mockFetchAll, fetchNext: mockFetchNext });

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

function encodeClientPrincipal(userId: string): string {
  return Buffer.from(JSON.stringify({ userId })).toString("base64");
}

function makeRequest(userId?: string, query?: Record<string, string>): HttpRequest {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return new HttpRequest({
    method: "GET",
    url: `http://localhost:7071/api/wear/history${qs ? `?${qs}` : ""}`,
    ...(userId ? { headers: { "x-ms-client-principal": encodeClientPrincipal(userId) } } : {}),
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "getWearHistory" });
}

function sampleGarments() {
  return [
    {
      id: "g1",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: ["https://blob.example.com/img1.jpg"],
      wearCount: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-15T00:00:00.000Z",
    },
  ];
}

function sampleWearEvents() {
  return [
    {
      id: "we1",
      userId: "user-1",
      garmentId: "g1",
      outfitImageUrl: "https://blob.example.com/outfit1.jpg",
      predictedGarmentId: "g1",
      confidence: 0.92,
      confirmed: true,
      createdAt: "2026-02-20T12:00:00.000Z",
    },
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/wear/history", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 with enriched wear events", async () => {
    // listWearEventsPaginated uses fetchNext, listGarments uses fetchAll
    mockFetchNext.mockResolvedValueOnce({
      resources: sampleWearEvents(),
      continuationToken: undefined,
    });
    mockFetchAll.mockResolvedValueOnce({ resources: sampleGarments() });

    const { getWearHistory } = await import("./getWearHistory.js");
    const res = await getWearHistory(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const json = res.jsonBody as {
      events: Array<{
        id: string;
        garmentId: string;
        garmentName: string;
        category: string;
        outfitImageUrl: string;
        confidence: number;
        createdAt: string;
      }>;
    };

    expect(json.events).toHaveLength(1);
    expect(json.events[0].garmentName).toBe("Blue Shirt");
    expect(json.events[0].category).toBe("top");
    expect(json.events[0].confidence).toBe(0.92);
  });

  it("returns 200 with empty events array when no history", async () => {
    mockFetchNext.mockResolvedValueOnce({ resources: [], continuationToken: undefined });
    mockFetchAll.mockResolvedValueOnce({ resources: [] });

    const { getWearHistory } = await import("./getWearHistory.js");
    const res = await getWearHistory(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const json = res.jsonBody as { events: unknown[] };
    expect(json.events).toEqual([]);
  });

  it("returns 'Unknown' garmentName for deleted garments", async () => {
    mockFetchNext.mockResolvedValueOnce({
      resources: sampleWearEvents(),
      continuationToken: undefined,
    });
    mockFetchAll.mockResolvedValueOnce({ resources: [] }); // no garments found

    const { getWearHistory } = await import("./getWearHistory.js");
    const res = await getWearHistory(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const json = res.jsonBody as { events: Array<{ garmentName: string }> };
    expect(json.events[0].garmentName).toBe("Unknown");
  });

  it("returns 401 when auth header is missing", async () => {
    const { getWearHistory } = await import("./getWearHistory.js");
    const res = await getWearHistory(makeRequest(), makeContext());

    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("returns 500 when service throws", async () => {
    mockFetchNext.mockRejectedValueOnce(new Error("Cosmos DB unavailable"));

    const { getWearHistory } = await import("./getWearHistory.js");
    const res = await getWearHistory(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to retrieve wear history");
  });
});
