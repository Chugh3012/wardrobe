import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { resetClient } from "../services/cosmosClient.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock("@azure/cosmos", () => ({
  CosmosClient: vi.fn().mockImplementation(function () {
    return {
      database: () => ({
        container: () => ({
          items: {
            create: mockCreate,
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

function makeRequest(body: unknown, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: "http://localhost:7071/api/garments",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-ms-client-principal-id": userId } : {}),
    },
    body: { string: JSON.stringify(body) },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "postGarment" });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    name: "Blue Shirt",
    category: "top",
    catalogImageUrls: [
      "https://blob.example.com/img1.jpg",
      "https://blob.example.com/img2.jpg",
      "https://blob.example.com/img3.jpg",
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/garments", () => {
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

  it("returns 201 with the created garment on valid input", async () => {
    const garmentDoc = {
      id: "abc-123",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: [
        "https://blob.example.com/img1.jpg",
        "https://blob.example.com/img2.jpg",
        "https://blob.example.com/img3.jpg",
      ],
      wearCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue({ resource: garmentDoc });

    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(makeRequest(validBody(), "user-1"), makeContext());

    expect(res.status).toBe(201);
    expect(res.jsonBody).toEqual(garmentDoc);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  // ── Invalid JSON ──────────────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const { postGarment } = await import("./postGarment.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/garments",
      headers: { "Content-Type": "application/json" },
      body: { string: "not-json{{" },
    });
    const res = await postGarment(request, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid JSON");
  });

  // ── Missing required fields ───────────────────────────────────────────────

  it("returns 401 when auth header is missing", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(makeRequest(validBody()), makeContext());
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
  });

  it("returns 400 when name is missing", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(makeRequest(validBody({ name: "" }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("name");
  });

  it("returns 400 when category is missing", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(makeRequest(validBody({ category: "" }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("category");
  });

  // ── catalogImageUrls validation ───────────────────────────────────────────

  it("returns 400 when catalogImageUrls is not an array", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: "not-an-array" }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("catalogImageUrls");
  });

  it("returns 400 when catalogImageUrls has fewer than 3 items", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: ["url1", "url2"] }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("between 3 and 8");
  });

  it("returns 400 when catalogImageUrls has more than 8 items", async () => {
    const { postGarment } = await import("./postGarment.js");
    const urls = Array.from({ length: 9 }, (_, i) => `https://blob.example.com/img${i}.jpg`);
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: urls }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("between 3 and 8");
  });

  it("returns 400 when catalogImageUrls contains a non-string entry", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: ["url1", 42, "url3"] }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("non-empty string");
  });

  it("returns 400 when catalogImageUrls contains an empty string", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: ["url1", "  ", "url3"] }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("non-empty string");
  });

  // ── Accepts exactly 3 and exactly 8 photos ───────────────────────────────

  it("accepts exactly 3 photos (minimum)", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    const urls = Array.from({ length: 3 }, (_, i) => `https://blob.example.com/img${i}.jpg`);
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(201);
  });

  it("accepts exactly 8 photos (maximum)", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    const urls = Array.from({ length: 8 }, (_, i) => `https://blob.example.com/img${i}.jpg`);
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(201);
  });

  // ── Cosmos DB error ───────────────────────────────────────────────────────

  it("returns 500 when createGarment throws", async () => {
    mockCreate.mockRejectedValue(new Error("Cosmos DB unavailable"));
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(makeRequest(validBody(), "user-1"), makeContext());
    expect(res.status).toBe(500);
    expect((res.jsonBody as { error: string }).error).toContain("Failed to create garment");
  });
});
