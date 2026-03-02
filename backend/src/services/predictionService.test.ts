import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Garment } from "../models/garment.js";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("./customVisionService.js", () => ({
  classifyImage: vi.fn(),
}));

vi.mock("./embeddingService.js", () => ({
  computeEmbedding: vi.fn(),
  findTopMatches: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function sampleGarments(): Garment[] {
  return [
    {
      id: "g1",
      userId: "user-1",
      name: "Blue Shirt",
      category: "top",
      catalogImageUrls: ["https://img1.jpg"],
      catalogEmbeddings: [[0.1, 0.2, 0.3]],
      wearCount: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "g2",
      userId: "user-1",
      name: "Red Dress",
      category: "dress",
      catalogImageUrls: ["https://img2.jpg"],
      catalogEmbeddings: [[0.4, 0.5, 0.6]],
      wearCount: 1,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("predictionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Custom Vision when confidence is high", async () => {
    const { classifyImage } = await import("./customVisionService.js");
    (classifyImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { garmentId: "g1", confidence: 0.95 },
      { garmentId: "g2", confidence: 0.4 },
    ]);

    const { predictGarments } = await import("./predictionService.js");
    const result = await predictGarments("https://outfit.jpg", sampleGarments());

    expect(result.source).toBe("custom_vision");
    expect(result.predictions[0].garmentId).toBe("g1");
    expect(result.predictions[0].confidence).toBe(0.95);
  });

  it("falls back to embeddings when CV confidence is below threshold", async () => {
    const { classifyImage } = await import("./customVisionService.js");
    (classifyImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { garmentId: "g1", confidence: 0.5 },
    ]);

    const { computeEmbedding, findTopMatches } = await import("./embeddingService.js");
    (computeEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1, 0.2, 0.3]);
    (findTopMatches as ReturnType<typeof vi.fn>).mockReturnValue([
      { garmentId: "g2", confidence: 0.88 },
    ]);

    const { predictGarments } = await import("./predictionService.js");
    const result = await predictGarments("https://outfit.jpg", sampleGarments());

    expect(result.source).toBe("embedding_fallback");
    expect(result.predictions[0].garmentId).toBe("g2");
  });

  it("falls back to embeddings when CV returns null", async () => {
    const { classifyImage } = await import("./customVisionService.js");
    (classifyImage as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { computeEmbedding, findTopMatches } = await import("./embeddingService.js");
    (computeEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1, 0.2, 0.3]);
    (findTopMatches as ReturnType<typeof vi.fn>).mockReturnValue([
      { garmentId: "g1", confidence: 0.9 },
    ]);

    const { predictGarments } = await import("./predictionService.js");
    const result = await predictGarments("https://outfit.jpg", sampleGarments());

    expect(result.source).toBe("embedding_fallback");
  });

  it("falls back to stub when neither service is configured", async () => {
    const { classifyImage } = await import("./customVisionService.js");
    (classifyImage as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { computeEmbedding } = await import("./embeddingService.js");
    (computeEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { predictGarments } = await import("./predictionService.js");
    const result = await predictGarments("https://outfit.jpg", sampleGarments());

    expect(result.source).toBe("stub");
    expect(result.predictions).toHaveLength(2);
    expect(result.predictions[0].garmentId).toBe("g1");
    expect(result.predictions[0].confidence).toBe(0.95);
    expect(result.predictions[1].garmentId).toBe("g2");
    expect(result.predictions[1].confidence).toBe(0.85);
  });

  it("filters CV predictions to only owned garments", async () => {
    const { classifyImage } = await import("./customVisionService.js");
    (classifyImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { garmentId: "unknown-garment", confidence: 0.99 },
      { garmentId: "g1", confidence: 0.90 },
    ]);

    const { predictGarments } = await import("./predictionService.js");
    const result = await predictGarments("https://outfit.jpg", sampleGarments());

    expect(result.source).toBe("custom_vision");
    // The unknown garment should be filtered out
    expect(result.predictions.find((p) => p.garmentId === "unknown-garment")).toBeUndefined();
    expect(result.predictions[0].garmentId).toBe("g1");
  });

  it("uses custom threshold from env var", async () => {
    vi.stubEnv("HIGH_CONFIDENCE_THRESHOLD", "0.99");

    const { classifyImage } = await import("./customVisionService.js");
    (classifyImage as ReturnType<typeof vi.fn>).mockResolvedValue([
      { garmentId: "g1", confidence: 0.95 },
    ]);

    const { computeEmbedding } = await import("./embeddingService.js");
    (computeEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { predictGarments } = await import("./predictionService.js");
    const result = await predictGarments("https://outfit.jpg", sampleGarments());

    // 0.95 < 0.99, so CV result is NOT high-confidence → fall through to stub
    expect(result.source).toBe("stub");
  });
});
