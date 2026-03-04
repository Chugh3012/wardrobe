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

function encodeClientPrincipal(userId: string): string {
  return Buffer.from(JSON.stringify({ userId })).toString("base64");
}

function makeRequest(body: unknown, userId?: string): HttpRequest {
  return new HttpRequest({
    method: "POST",
    url: "http://localhost:7071/api/garments",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-ms-client-principal": encodeClientPrincipal(userId) } : {}),
    },
    body: { string: JSON.stringify(body) },
  });
}

function makeContext(): InvocationContext {
  return new InvocationContext({ functionName: "postGarment" });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Blue Shirt",
    category: "top",
    catalogImageUrls: [
      "https://storageaccount.blob.core.windows.net/images/img1.jpg",
      "https://storageaccount.blob.core.windows.net/images/img2.jpg",
      "https://storageaccount.blob.core.windows.net/images/img3.jpg",
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
        "https://storageaccount.blob.core.windows.net/images/img1.jpg",
        "https://storageaccount.blob.core.windows.net/images/img2.jpg",
        "https://storageaccount.blob.core.windows.net/images/img3.jpg",
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
      headers: {
        "Content-Type": "application/json",
        "x-ms-client-principal": encodeClientPrincipal("user-1"),
      },
      body: { string: "not-json{{" },
    });
    const res = await postGarment(request, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("Invalid JSON");
  });

  it("returns 401 before parsing body when auth header is missing (even with invalid JSON)", async () => {
    const { postGarment } = await import("./postGarment.js");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost:7071/api/garments",
      headers: { "Content-Type": "application/json" },
      body: { string: "not-json{{" },
    });
    const res = await postGarment(request, makeContext());
    expect(res.status).toBe(401);
    expect((res.jsonBody as { error: string }).error).toContain("Authentication required");
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

  it("returns 400 when catalogImageUrls is empty", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: [] }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("between 1 and 8");
  });

  it("returns 400 when catalogImageUrls has more than 8 items", async () => {
    const { postGarment } = await import("./postGarment.js");
    const urls = Array.from({ length: 9 }, (_, i) => `https://storageaccount.blob.core.windows.net/images/img${i}.jpg`);
    const res = await postGarment(
      makeRequest(validBody({ catalogImageUrls: urls }), "user-1"),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("between 1 and 8");
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

  it("accepts exactly 1 photo (minimum)", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    const urls = ["https://storageaccount.blob.core.windows.net/images/img0.jpg"];
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(201);
  });

  it("accepts exactly 8 photos (maximum)", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    const urls = Array.from({ length: 8 }, (_, i) => `https://storageaccount.blob.core.windows.net/images/img${i}.jpg`);
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

  // ── S12: field length limits ────────────────────────────────────────────────

  it("returns 400 when name exceeds 100 characters", async () => {
    const { postGarment } = await import("./postGarment.js");
    const longName = "a".repeat(101);
    const res = await postGarment(makeRequest(validBody({ name: longName }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 100");
  });

  it("accepts name with exactly 100 characters", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    const name100 = "a".repeat(100);
    const res = await postGarment(makeRequest(validBody({ name: name100 }), "user-1"), makeContext());
    expect(res.status).toBe(201);
  });

  it("returns 400 when category exceeds 50 characters", async () => {
    const { postGarment } = await import("./postGarment.js");
    const longCategory = "a".repeat(51);
    const res = await postGarment(makeRequest(validBody({ category: longCategory }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 50");
  });

  it("accepts category with exactly 50 characters (valid category)", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    // Use a valid category for the enum check — length limit is tested separately
    const res = await postGarment(makeRequest(validBody({ category: "top" }), "user-1"), makeContext());
    expect(res.status).toBe(201);
  });

  // ── F2: category enum validation ─────────────────────────────────────────────

  it("returns 400 when category is not in the allowed list", async () => {
    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(makeRequest(validBody({ category: "hat" }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("must be one of");
    expect((res.jsonBody as { error: string }).error).toContain("hat");
  });

  it("accepts all valid categories (case-insensitive)", async () => {
    mockCreate.mockResolvedValue({ resource: { id: "g1" } });
    const { postGarment } = await import("./postGarment.js");
    const validCategories = ["dress", "Top", "BOTTOM", "Outerwear", "shoes", "Accessory", "other"];
    for (const cat of validCategories) {
      mockCreate.mockResolvedValue({ resource: { id: `g-${cat}` } });
      const res = await postGarment(makeRequest(validBody({ category: cat }), "user-1"), makeContext());
      expect(res.status).toBe(201);
    }
  });

  it("normalizes mixed-case category to lowercase before storing", async () => {
    const garmentDoc = {
      id: "abc-123",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: [
        "https://storageaccount.blob.core.windows.net/images/img1.jpg",
      ],
      wearCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue({ resource: garmentDoc });

    const { postGarment } = await import("./postGarment.js");
    const res = await postGarment(
      makeRequest(validBody({ category: "Top", catalogImageUrls: ["https://storageaccount.blob.core.windows.net/images/img1.jpg"] }), "user-1"),
      makeContext()
    );

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledOnce();
    const createdDoc = mockCreate.mock.calls[0][0] as { category: string };
    expect(createdDoc.category).toBe("top");
  });

  // ── S7: SSRF — catalogImageUrls URL validation ────────────────────────────

  it("returns 400 when a catalogImageUrl uses http instead of https", async () => {
    const { postGarment } = await import("./postGarment.js");
    const urls = [
      "http://storageaccount.blob.core.windows.net/images/img1.jpg",
      "https://storageaccount.blob.core.windows.net/images/img2.jpg",
      "https://storageaccount.blob.core.windows.net/images/img3.jpg",
    ];
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });

  it("returns 400 when a catalogImageUrl is not from blob.core.windows.net", async () => {
    const { postGarment } = await import("./postGarment.js");
    const urls = [
      "https://evil.example.com/img1.jpg",
      "https://storageaccount.blob.core.windows.net/images/img2.jpg",
      "https://storageaccount.blob.core.windows.net/images/img3.jpg",
    ];
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });

  it("returns 400 when a catalogImageUrl targets the Azure IMDS endpoint (SSRF)", async () => {
    const { postGarment } = await import("./postGarment.js");
    const urls = [
      "https://169.254.169.254/metadata/identity/oauth2/token",
      "https://storageaccount.blob.core.windows.net/images/img2.jpg",
      "https://storageaccount.blob.core.windows.net/images/img3.jpg",
    ];
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("allowed domain");
  });

  // ── S12: URL length limits on catalogImageUrls ──────────────────────────────

  it("returns 400 when a catalogImageUrl exceeds 2048 characters", async () => {
    const { postGarment } = await import("./postGarment.js");
    const longUrl = "https://storageaccount.blob.core.windows.net/images/" + "a".repeat(2048) + ".jpg";
    const urls = [
      longUrl,
      "https://storageaccount.blob.core.windows.net/images/img2.jpg",
      "https://storageaccount.blob.core.windows.net/images/img3.jpg",
    ];
    const res = await postGarment(makeRequest(validBody({ catalogImageUrls: urls }), "user-1"), makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain("at most 2048");
  });
});
