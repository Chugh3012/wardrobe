import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetClient } from "./cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockRead = vi.fn();
const mockFetchAll = vi.fn();
const mockFetchNext = vi.fn();
const mockQuery = vi.fn(() => ({ fetchAll: mockFetchAll, fetchNext: mockFetchNext }));

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("garmentService", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("createGarment returns a garment with generated id and timestamps", async () => {
    const garmentDoc = {
      id: "abc-123",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: ["https://example.com/img.jpg"],
      wearCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue({ resource: garmentDoc });

    const { createGarment } = await import("./garmentService.js");
    const result = await createGarment({
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: ["https://example.com/img.jpg"],
    });

    expect(result).toEqual(garmentDoc);
    expect(mockCreate).toHaveBeenCalledOnce();
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.userId).toBe("user-1");
    expect(arg.name).toBe("Blue Shirt");
    expect(arg.category).toBe("top");
    expect(arg.wearCount).toBe(0);
    expect(arg.id).toBeTruthy();
    expect(arg.createdAt).toBeTruthy();
    expect(arg.updatedAt).toBeTruthy();
  });

  it("readGarment returns the garment when found", async () => {
    const garmentDoc = { id: "abc-123", userId: "user-1", name: "Blue Shirt" };
    mockRead.mockResolvedValue({ resource: garmentDoc });

    const { readGarment } = await import("./garmentService.js");
    const result = await readGarment("abc-123", "user-1");

    expect(result).toEqual(garmentDoc);
  });

  it("readGarment returns undefined when not found (404)", async () => {
    mockRead.mockRejectedValue({ code: 404 });

    const { readGarment } = await import("./garmentService.js");
    const result = await readGarment("nonexistent", "user-1");

    expect(result).toBeUndefined();
  });

  it("readGarment re-throws non-404 errors", async () => {
    mockRead.mockRejectedValue(new Error("Internal server error"));

    const { readGarment } = await import("./garmentService.js");
    await expect(readGarment("abc-123", "user-1")).rejects.toThrow("Internal server error");
  });

  it("listGarments returns all garments for a userId", async () => {
    const garments = [
      { id: "1", userId: "user-1", name: "Blue Shirt" },
      { id: "2", userId: "user-1", name: "Red Dress" },
    ];
    mockFetchAll.mockResolvedValue({ resources: garments });

    const { listGarments } = await import("./garmentService.js");
    const result = await listGarments("user-1");

    expect(result).toEqual(garments);
    expect(mockQuery).toHaveBeenCalledWith({
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: "user-1" }],
    });
  });

  // ── listGarmentsPaginated (F3) ────────────────────────────────────────────

  it("listGarmentsPaginated returns garments with a continuation token", async () => {
    const garments = [{ id: "1", userId: "user-1", name: "Blue Shirt" }];
    mockFetchNext.mockResolvedValue({ resources: garments, continuationToken: "tok" });

    const { listGarmentsPaginated } = await import("./garmentService.js");
    const result = await listGarmentsPaginated("user-1", 10);

    expect(result.garments).toEqual(garments);
    expect(result.continuationToken).toBe("tok");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining("SELECT") }),
      expect.objectContaining({ maxItemCount: 10 }),
    );
  });

  it("listGarmentsPaginated defaults to pageSize 20", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

    const { listGarmentsPaginated } = await import("./garmentService.js");
    await listGarmentsPaginated("user-1");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxItemCount: 20 }),
    );
  });

  it("listGarmentsPaginated clamps pageSize to 100", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

    const { listGarmentsPaginated } = await import("./garmentService.js");
    await listGarmentsPaginated("user-1", 500);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxItemCount: 100 }),
    );
  });

  it("listGarmentsPaginated passes continuationToken to query", async () => {
    mockFetchNext.mockResolvedValue({ resources: [], continuationToken: undefined });

    const { listGarmentsPaginated } = await import("./garmentService.js");
    await listGarmentsPaginated("user-1", 10, "my-token");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ continuationToken: "my-token" }),
    );
  });
});
