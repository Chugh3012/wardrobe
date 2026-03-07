import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";
import { encodeClientPrincipal, makeContext as makeBaseContext } from "../testUtils.js";

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

function makeRequest(id: string, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "DELETE",
    url: `http://localhost:7071/api/wear/events/${id}`,
    headers: {
      ...(userId ? { "x-ms-client-principal": encodeClientPrincipal(userId) } : {}),
    },
    params: { id },
  });
}

function makeContext(): InvocationContext {
  return makeBaseContext("deleteWearEvent");
}

/** Minimal WearEvent document returned by readWearEvent. */
function sampleWearEvent() {
  return {
    id: "evt-1",
    userId: "user-1",
    garmentId: "g1",
    outfitImageUrl: "https://blob.example.com/outfits/photo1.jpg",
    predictedGarmentId: "g1",
    confidence: 0.95,
    confirmed: true,
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

/** Minimal Garment document returned by readGarment for decrementWearCount. */
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

describe("DELETE /api/wear/events/{id}", () => {
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

  it("returns 204 and deletes the wear event", async () => {
    // readWearEvent
    mockRead.mockResolvedValueOnce({ resource: sampleWearEvent() });
    // deleteWearEvent
    mockDelete.mockResolvedValueOnce({});
    // decrementWearCount: read garment
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    // decrementWearCount: replace garment
    mockReplace.mockResolvedValueOnce({ resource: { ...sampleGarment(), wearCount: 2 } });

    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("evt-1", "user-1"), makeContext());

    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it("decrements the garment's wearCount on successful deletion", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleWearEvent() });
    mockDelete.mockResolvedValueOnce({});
    mockRead.mockResolvedValueOnce({ resource: sampleGarment() });
    mockReplace.mockResolvedValueOnce({ resource: { ...sampleGarment(), wearCount: 2 } });

    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    await deleteWearEventHandler(makeRequest("evt-1", "user-1"), makeContext());

    expect(mockReplace).toHaveBeenCalledOnce();
    const replaced = mockReplace.mock.calls[0][0];
    expect(replaced.wearCount).toBe(2);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("evt-1"), makeContext());

    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when id path parameter is empty", async () => {
    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("", "user-1"), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("id");
  });

  it("returns 400 when id exceeds 256 characters", async () => {
    const longId = "a".repeat(257);
    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest(longId, "user-1"), makeContext());

    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 256");
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it("returns 404 when wear event is not found", async () => {
    mockRead.mockResolvedValueOnce({ resource: undefined });

    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("nonexistent", "user-1"), makeContext());

    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toContain("Wear event not found");
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("returns 500 when readWearEvent throws", async () => {
    mockRead.mockRejectedValueOnce(new Error("Cosmos DB unavailable"));

    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("evt-1", "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to delete");
  });

  it("returns 500 when delete throws", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleWearEvent() });
    mockDelete.mockRejectedValueOnce(new Error("Cosmos DB delete failed"));

    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("evt-1", "user-1"), makeContext());

    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to delete");
  });

  it("still returns 204 when decrementWearCount fails (graceful degradation)", async () => {
    mockRead.mockResolvedValueOnce({ resource: sampleWearEvent() });
    mockDelete.mockResolvedValueOnce({});
    // decrementWearCount: read garment fails
    mockRead.mockRejectedValueOnce(new Error("Garment not found"));

    const { deleteWearEventHandler } = await import("./deleteWearEvent.js");
    const res = await deleteWearEventHandler(makeRequest("evt-1", "user-1"), makeContext());

    expect(res.status).toBe(204);
  });
});
