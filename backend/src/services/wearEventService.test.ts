import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetClient } from "./cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockRead = vi.fn();
const mockFetchAll = vi.fn();
const mockQuery = vi.fn(() => ({ fetchAll: mockFetchAll }));

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

describe("wearEventService", () => {
  beforeEach(() => {
    vi.stubEnv("COSMOS_DB_ENDPOINT", "https://cosmos-wardrobe-dev.documents.azure.com:443/");
    vi.stubEnv("COSMOS_DB_DATABASE_NAME", "wardrobe");
    resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("createWearEvent returns an event with generated id and createdAt", async () => {
    const eventDoc = {
      id: "evt-1",
      userId: "user-1",
      garmentId: "garm-1",
      outfitImageUrl: "https://example.com/outfit.jpg",
      predictedGarmentId: "garm-1",
      confidence: 0.92,
      confirmed: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue({ resource: eventDoc });

    const { createWearEvent } = await import("./wearEventService.js");
    const result = await createWearEvent({
      userId: "user-1",
      garmentId: "garm-1",
      outfitImageUrl: "https://example.com/outfit.jpg",
      predictedGarmentId: "garm-1",
      confidence: 0.92,
      confirmed: true,
    });

    expect(result).toEqual(eventDoc);
    expect(mockCreate).toHaveBeenCalledOnce();
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.userId).toBe("user-1");
    expect(arg.garmentId).toBe("garm-1");
    expect(arg.confirmed).toBe(true);
    expect(arg.id).toBeTruthy();
    expect(arg.createdAt).toBeTruthy();
  });

  it("readWearEvent returns the event when found", async () => {
    const eventDoc = { id: "evt-1", userId: "user-1" };
    mockRead.mockResolvedValue({ resource: eventDoc });

    const { readWearEvent } = await import("./wearEventService.js");
    const result = await readWearEvent("evt-1", "user-1");

    expect(result).toEqual(eventDoc);
  });

  it("readWearEvent returns undefined when not found (404)", async () => {
    mockRead.mockRejectedValue({ code: 404 });

    const { readWearEvent } = await import("./wearEventService.js");
    const result = await readWearEvent("nonexistent", "user-1");

    expect(result).toBeUndefined();
  });

  it("listWearEvents returns all events for a userId", async () => {
    const events = [{ id: "evt-1", userId: "user-1" }];
    mockFetchAll.mockResolvedValue({ resources: events });

    const { listWearEvents } = await import("./wearEventService.js");
    const result = await listWearEvents("user-1");

    expect(result).toEqual(events);
    expect(mockQuery).toHaveBeenCalledWith({
      query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@userId", value: "user-1" }],
    });
  });
});
