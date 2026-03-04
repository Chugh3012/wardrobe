import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockRead = vi.fn();
const mockReplace = vi.fn();
const mockDelete = vi.fn();
const mockFetchAll = vi.fn();
const mockQuery = vi.fn().mockReturnValue({ fetchAll: mockFetchAll });

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({
        container: () => ({
          items: {
            create: mockCreate,
            query: mockQuery,
          },
          item: () => ({
            read: mockRead,
            replace: mockReplace,
            delete: mockDelete,
          }),
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

function makeRequest(id: string, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "DELETE",
    url: `http://localhost:7071/api/garments/${id}`,
    headers: {
      ...(userId ? { "x-ms-client-principal": encodeClientPrincipal(userId) } : {}),
    },
    params: { id },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "deleteGarment" });
}

/** Minimal Garment document returned by readGarment. */
function sampleGarment() {
  return {
    id: "g1",
    userId: "user-1",
    name: "Blue Shirt",
    category: "top",
    catalogImageUrls: ["https://blob.example.com/img1.jpg"],
    wearCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DELETE /api/garments/{id}", () => {
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

  it("returns 204 and deletes the garment", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    mockDelete.mockResolvedValueOnce({});

    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("g1", "user-1"), makeContext());

    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("g1"), makeContext());

    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when id path parameter is empty", async () => {
    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("", "user-1"), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("id");
  });

  it("returns 400 when id exceeds 256 characters", async () => {
    const longId = "a".repeat(257);
    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest(longId, "user-1"), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 256");
  });

  it("returns 400 when id contains invalid characters", async () => {
    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("../bad-id", "user-1"), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid 'id' format");
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it("returns 404 when garment is not found", async () => {
    mockRead.mockResolvedValueOnce({ resource: undefined });

    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("nonexistent", "user-1"), makeContext());

    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toContain("Garment not found");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns 500 when readGarment throws", async () => {
    mockRead.mockRejectedValueOnce(new Error("Cosmos DB unavailable"));

    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("g1", "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to delete");
  });

  it("returns 500 when delete throws", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    mockDelete.mockRejectedValueOnce(new Error("Cosmos DB delete failed"));

    const { deleteGarmentHandler } = await import("./deleteGarment.js");
    const res = await deleteGarmentHandler(makeRequest("g1", "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to delete");
  });
});
