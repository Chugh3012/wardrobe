import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockRead = vi.fn();
const mockReplace = vi.fn();

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({
        container: () => ({
          items: {
            query: () => ({ fetchAll: () => Promise.resolve({ resources: [] }) }),
          },
          item: () => ({
            read: mockRead,
            replace: mockReplace,
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

function makePatchRequest(path: string, body: unknown, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "PATCH",
    url: `http://localhost:7071${path}`,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-ms-client-principal": encodeClientPrincipal(userId) } : {}),
    },
    body: { string: JSON.stringify(body) },
    params: { id: path.split("/").pop() ?? "" },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "patchGarment" });
}

const existingGarment = {
  id: "g-123",
  userId: "user-1",
  name: "Blue Shirt",
  category: "top",
  catalogImageUrls: [
    "https://storageaccount.blob.core.windows.net/images/img1.jpg",
  ],
  wearCount: 5,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/garments/{id}", () => {
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

  it("returns 200 with updated garment when name is changed", async () => {
    const updatedDoc = { ...existingGarment, name: "Red Shirt", updatedAt: "2026-02-01T00:00:00.000Z" };
    mockRead.mockResolvedValue({ resource: existingGarment, etag: "etag-1" });
    mockReplace.mockResolvedValue({ resource: updatedDoc });

    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { name: "Red Shirt" }, "user-1"),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect((res.jsonBody as { name: string }).name).toBe("Red Shirt");
  });

  it("returns 200 when category is changed", async () => {
    const updatedDoc = { ...existingGarment, category: "bottom", updatedAt: "2026-02-01T00:00:00.000Z" };
    mockRead.mockResolvedValue({ resource: existingGarment, etag: "etag-1" });
    mockReplace.mockResolvedValue({ resource: updatedDoc });

    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { category: "bottom" }, "user-1"),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect((res.jsonBody as { category: string }).category).toBe("bottom");
  });

  it("returns 200 when catalogImageUrls is changed", async () => {
    const newUrls = [
      "https://storageaccount.blob.core.windows.net/images/new1.jpg",
      "https://storageaccount.blob.core.windows.net/images/new2.jpg",
    ];
    const updatedDoc = { ...existingGarment, catalogImageUrls: newUrls, updatedAt: "2026-02-01T00:00:00.000Z" };
    mockRead.mockResolvedValue({ resource: existingGarment, etag: "etag-1" });
    mockReplace.mockResolvedValue({ resource: updatedDoc });

    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { catalogImageUrls: newUrls }, "user-1"),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect((res.jsonBody as { catalogImageUrls: string[] }).catalogImageUrls).toEqual(newUrls);
  });

  it("returns 200 when multiple fields are updated", async () => {
    const updatedDoc = { ...existingGarment, name: "Green Dress", category: "dress", updatedAt: "2026-02-01T00:00:00.000Z" };
    mockRead.mockResolvedValue({ resource: existingGarment, etag: "etag-1" });
    mockReplace.mockResolvedValue({ resource: updatedDoc });

    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { name: "Green Dress", category: "dress" }, "user-1"),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect((res.jsonBody as { name: string; category: string }).name).toBe("Green Dress");
    expect((res.jsonBody as { name: string; category: string }).category).toBe("dress");
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { name: "New Name" }),
      makeContext(),
    );
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  // ── ID validation ─────────────────────────────────────────────────────────

  it("returns 400 when id exceeds MAX_ID_LENGTH", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const longId = "a".repeat(257);
    const res = await patchGarment(
      makePatchRequest(`/api/garments/${longId}`, { name: "X" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 256");
  });

  it("returns 400 when id contains invalid characters", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const request = new HttpRequest({
      method: "PATCH",
      url: "http://localhost:7071/api/garments/bad..id",
      headers: {
        "Content-Type": "application/json",
        "x-ms-client-principal": encodeClientPrincipal("user-1"),
      },
      body: { string: JSON.stringify({ name: "X" }) },
      params: { id: "../bad..id" },
    });
    const res = await patchGarment(request, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid 'id'");
  });

  // ── Invalid JSON ──────────────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const request = new HttpRequest({
      method: "PATCH",
      url: "http://localhost:7071/api/garments/g-123",
      headers: {
        "Content-Type": "application/json",
        "x-ms-client-principal": encodeClientPrincipal("user-1"),
      },
      body: { string: "not-json{{" },
      params: { id: "g-123" },
    });
    const res = await patchGarment(request, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid JSON");
  });

  // ── Name validation ───────────────────────────────────────────────────────

  it("returns 400 when name is empty string", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { name: "" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("name");
  });

  it("returns 400 when name exceeds 100 characters", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { name: "a".repeat(101) }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 100");
  });

  // ── Category validation ───────────────────────────────────────────────────

  it("returns 400 when category is empty string", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { category: "" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("category");
  });

  it("returns 400 when category exceeds 50 characters", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { category: "a".repeat(51) }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 50");
  });

  it("returns 400 when category is not in allowed list", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { category: "hat" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("must be one of");
  });

  // ── catalogImageUrls validation ───────────────────────────────────────────

  it("returns 400 when catalogImageUrls is not an array", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { catalogImageUrls: "not-an-array" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("catalogImageUrls");
  });

  it("returns 400 when catalogImageUrls is empty", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { catalogImageUrls: [] }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("between 1 and 8");
  });

  it("returns 400 when catalogImageUrls exceeds 8 items", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const urls = Array.from({ length: 9 }, (_, i) => `https://storageaccount.blob.core.windows.net/images/img${i}.jpg`);
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { catalogImageUrls: urls }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("between 1 and 8");
  });

  it("returns 400 when catalogImageUrl is not HTTPS", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", {
        catalogImageUrls: ["http://storageaccount.blob.core.windows.net/images/img1.jpg"],
      }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });

  it("returns 400 when catalogImageUrl exceeds 2048 characters", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const longUrl = "https://storageaccount.blob.core.windows.net/images/" + "a".repeat(2048) + ".jpg";
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { catalogImageUrls: [longUrl] }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 2048");
  });

  // ── No fields provided ────────────────────────────────────────────────────

  it("returns 400 when no updatable fields are provided", async () => {
    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", {}, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("At least one field");
  });

  // ── 404 garment not found ─────────────────────────────────────────────────

  it("returns 404 when garment does not exist", async () => {
    mockRead.mockResolvedValue({ resource: undefined });

    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-999", { name: "New Name" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(404);
    expect((res.jsonBody as { error: string }).error).toContain("not found");
  });

  // ── 500 server error ──────────────────────────────────────────────────────

  it("returns 500 when Cosmos DB throws", async () => {
    mockRead.mockRejectedValue(new Error("Cosmos DB unavailable"));

    const { patchGarment } = await import("./patchGarment.js");
    const res = await patchGarment(
      makePatchRequest("/api/garments/g-123", { name: "New Name" }, "user-1"),
      makeContext(),
    );
    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to update garment");
  });
});
