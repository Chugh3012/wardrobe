import { describe, it, expect, vi, afterEach } from "vitest";

describe("embeddingService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── isEmbeddingServiceConfigured ──────────────────────────────────────

  it("returns false when env vars are not set", async () => {
    const { isEmbeddingServiceConfigured } = await import("./embeddingService.js");
    expect(isEmbeddingServiceConfigured()).toBe(false);
  });

  it("returns true when all env vars are set", async () => {
    vi.stubEnv("AI_VISION_ENDPOINT", "https://vision.example.com");
    vi.stubEnv("AI_VISION_KEY", "key-123");
    const { isEmbeddingServiceConfigured } = await import("./embeddingService.js");
    expect(isEmbeddingServiceConfigured()).toBe(true);
  });

  // ── computeEmbedding ──────────────────────────────────────────────────

  it("returns null when not configured", async () => {
    const { computeEmbedding } = await import("./embeddingService.js");
    const result = await computeEmbedding("https://img.jpg");
    expect(result).toBeNull();
  });

  it("returns embedding vector on success", async () => {
    vi.stubEnv("AI_VISION_ENDPOINT", "https://vision.example.com");
    vi.stubEnv("AI_VISION_KEY", "key-123");

    const vector = [0.1, 0.2, 0.3];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ vector }), { status: 200 })
    );

    const { computeEmbedding } = await import("./embeddingService.js");
    const result = await computeEmbedding("https://img.jpg");
    expect(result).toEqual(vector);
  });

  it("returns null when API fails", async () => {
    vi.stubEnv("AI_VISION_ENDPOINT", "https://vision.example.com");
    vi.stubEnv("AI_VISION_KEY", "key-123");

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response("Error", { status: 500 })
    );

    const { computeEmbedding } = await import("./embeddingService.js");
    const result = await computeEmbedding("https://img.jpg");
    expect(result).toBeNull();
  });

  // ── cosineSimilarity ──────────────────────────────────────────────────

  it("computes cosine similarity of identical vectors as 1", async () => {
    const { cosineSimilarity } = await import("./embeddingService.js");
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });

  it("computes cosine similarity of orthogonal vectors as 0", async () => {
    const { cosineSimilarity } = await import("./embeddingService.js");
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it("computes cosine similarity of opposite vectors as -1", async () => {
    const { cosineSimilarity } = await import("./embeddingService.js");
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it("returns 0 for empty vectors", async () => {
    const { cosineSimilarity } = await import("./embeddingService.js");
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", async () => {
    const { cosineSimilarity } = await import("./embeddingService.js");
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });

  // ── findTopMatches ────────────────────────────────────────────────────

  it("returns top-N matches sorted by similarity", async () => {
    const { findTopMatches } = await import("./embeddingService.js");

    const query = [1, 0, 0];
    const catalog = [
      { garmentId: "g1", embedding: [1, 0, 0] },    // similarity = 1.0
      { garmentId: "g2", embedding: [0, 1, 0] },    // similarity = 0.0
      { garmentId: "g3", embedding: [0.7, 0.7, 0] }, // similarity ≈ 0.707
    ];

    const results = findTopMatches(query, catalog, 2);
    expect(results).toHaveLength(2);
    expect(results[0].garmentId).toBe("g1");
    expect(results[0].confidence).toBeCloseTo(1.0);
    expect(results[1].garmentId).toBe("g3");
    expect(results[1].confidence).toBeCloseTo(0.7071, 3);
  });

  it("picks max similarity across multiple embeddings for same garment", async () => {
    const { findTopMatches } = await import("./embeddingService.js");

    const query = [1, 0, 0];
    const catalog = [
      { garmentId: "g1", embedding: [0, 1, 0] },    // low similarity
      { garmentId: "g1", embedding: [1, 0, 0] },    // high similarity
      { garmentId: "g2", embedding: [0.5, 0.5, 0] },
    ];

    const results = findTopMatches(query, catalog, 3);
    expect(results[0].garmentId).toBe("g1");
    expect(results[0].confidence).toBeCloseTo(1.0);
  });

  it("returns empty array when catalog is empty", async () => {
    const { findTopMatches } = await import("./embeddingService.js");
    const results = findTopMatches([1, 0], [], 3);
    expect(results).toEqual([]);
  });
});
