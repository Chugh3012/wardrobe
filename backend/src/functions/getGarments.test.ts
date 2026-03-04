import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFetchNext = vi.fn();
const mockQuery = vi.fn().mockReturnValue({ fetchNext: mockFetchNext });

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

// Mock blobSasService — by default pass URLs through with a fresh SAS token appended
const mockGenerateReadSasUrls = vi.fn();
vi.mock("../services/blobSasService.js", () => ({
  generateReadSasUrls: (...args: unknown[]) => mockGenerateReadSasUrls(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeClientPrincipal(userId: string): string {
  return Buffer.from(JSON.stringify({ userId })).toString("base64");
}

function makeRequest(userId?: string, query: Record<string, string> = {}): HttpRequest {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return new HttpRequest({
    method: "GET",
    url: `http://localhost:7071/api/garments${qs ? `?${qs}` : ""}`,
    ...(userId ? { headers: { "x-ms-client-principal": encodeClientPrincipal(userId) } } : {}),
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

    // Default: append a fresh SAS token to each URL (pass null through as-is)
    mockGenerateReadSasUrls.mockImplementation(async (urls: (string | null)[]) =>
      urls.map((u) => (u ? `${u}?sv=2023&sig=fresh` : null)),
    );
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
    mockFetchNext.mockResolvedValue({ resources: garments, continuationToken: undefined });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    expect((res.jsonBody as { garments: unknown[] }).garments).toEqual([
      {
        id: "g1",
        name: "Blue Shirt",
        category: "top",
        wearCount: 3,
        thumbnailUrl: "https://blob.example.com/img1.jpg?sv=2023&sig=fresh",
      },
      {
        id: "g2",
        name: "Red Dress",
        category: "dress",
        wearCount: 1,
        thumbnailUrl: "https://blob.example.com/img3.jpg?sv=2023&sig=fresh",
      },
    ]);
  });

  it("returns 200 with empty array when user has no garments", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

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
    mockFetchNext.mockResolvedValue({ resources: garments, continuationToken: undefined });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const items = (res.jsonBody as { garments: Array<{ thumbnailUrl: string | null }> }).garments;
    expect(items[0].thumbnailUrl).toBeNull();
  });

  // ── Pagination (F3) ──────────────────────────────────────────────────────

  it("returns continuationToken when more pages exist", async () => {
    mockFetchNext.mockResolvedValue({
      resources: [{ id: "g1", userId: "user-1", name: "Shirt", category: "top", catalogImageUrls: [], wearCount: 0 }],
      continuationToken: "next-page-token",
    });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1", { pageSize: "1" }), makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { garments: unknown[]; continuationToken?: string };
    expect(body.garments).toHaveLength(1);
    expect(body.continuationToken).toBe("next-page-token");
  });

  it("omits continuationToken when no more pages", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { garments: unknown[]; continuationToken?: string };
    expect(body.continuationToken).toBeUndefined();
  });

  it("passes pageSize and continuationToken to the query", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

    const { getGarments } = await import("./getGarments.js");
    await getGarments(
      makeRequest("user-1", { pageSize: "5", continuationToken: "tok123" }),
      makeContext(),
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("SELECT"),
      }),
      expect.objectContaining({
        maxItemCount: 5,
        continuationToken: "tok123",
      }),
    );
  });

  it("returns 400 when pageSize is not a valid number", async () => {
    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1", { pageSize: "abc" }), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("pageSize");
  });

  it("returns 400 when pageSize is zero", async () => {
    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1", { pageSize: "0" }), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("pageSize");
  });

  it("clamps pageSize to maximum of 100", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

    const { getGarments } = await import("./getGarments.js");
    await getGarments(makeRequest("user-1", { pageSize: "200" }), makeContext());

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxItemCount: 100 }),
    );
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

  it("returns 500 when listGarmentsPaginated throws", async () => {
    mockFetchNext.mockRejectedValue(new Error("Cosmos DB unavailable"));

    const { getGarments } = await import("./getGarments.js");
    const res = await getGarments(makeRequest("user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to list garments");
  });
});
