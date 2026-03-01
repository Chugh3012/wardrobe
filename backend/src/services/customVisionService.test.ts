import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Helpers ──────────────────────────────────────────────────────────────────

function stubCustomVisionEnv() {
  vi.stubEnv("CUSTOM_VISION_TRAINING_ENDPOINT", "https://cv-train.example.com");
  vi.stubEnv("CUSTOM_VISION_TRAINING_KEY", "train-key-123");
  vi.stubEnv("CUSTOM_VISION_PREDICTION_ENDPOINT", "https://cv-pred.example.com");
  vi.stubEnv("CUSTOM_VISION_PREDICTION_KEY", "pred-key-456");
  vi.stubEnv("CUSTOM_VISION_PROJECT_ID", "project-abc");
  vi.stubEnv("CUSTOM_VISION_PUBLISHED_NAME", "latest");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("customVisionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── isCustomVisionConfigured ───────────────────────────────────────────

  it("returns false when env vars are not set", async () => {
    const { isCustomVisionConfigured } = await import("./customVisionService.js");
    expect(isCustomVisionConfigured()).toBe(false);
  });

  it("returns true when all env vars are set", async () => {
    stubCustomVisionEnv();
    const { isCustomVisionConfigured } = await import("./customVisionService.js");
    expect(isCustomVisionConfigured()).toBe(true);
  });

  // ── submitTrainingImages ───────────────────────────────────────────────

  it("returns 0 when not configured", async () => {
    const { submitTrainingImages } = await import("./customVisionService.js");
    const count = await submitTrainingImages("g1", ["https://img1.jpg"]);
    expect(count).toBe(0);
  });

  it("submits images when configured", async () => {
    stubCustomVisionEnv();

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // ensureTag: list tags → empty, then create tag
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "tag-1" }), { status: 200 })
    );
    // submit images
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ isBatchSuccessful: true, images: [{}, {}, {}] }),
        { status: 200 }
      )
    );

    const { submitTrainingImages } = await import("./customVisionService.js");
    const count = await submitTrainingImages("g1", [
      "https://img1.jpg",
      "https://img2.jpg",
      "https://img3.jpg",
    ]);

    expect(count).toBe(3);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("returns existing tag if found", async () => {
    stubCustomVisionEnv();

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // ensureTag: list tags → found
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: "tag-1", name: "g1" }]), { status: 200 })
    );
    // submit images
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ isBatchSuccessful: true, images: [{}] }),
        { status: 200 }
      )
    );

    const { submitTrainingImages } = await import("./customVisionService.js");
    const count = await submitTrainingImages("g1", ["https://img1.jpg"]);

    expect(count).toBe(1);
    // Should only call fetch twice (list + submit), not three times (no create)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // ── classifyImage ─────────────────────────────────────────────────────

  it("returns null when not configured", async () => {
    const { classifyImage } = await import("./customVisionService.js");
    const result = await classifyImage("https://outfit.jpg");
    expect(result).toBeNull();
  });

  it("returns sorted predictions on success", async () => {
    stubCustomVisionEnv();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          predictions: [
            { tagName: "g2", probability: 0.72 },
            { tagName: "g1", probability: 0.91 },
          ],
        }),
        { status: 200 }
      )
    );

    const { classifyImage } = await import("./customVisionService.js");
    const result = await classifyImage("https://outfit.jpg");

    expect(result).toEqual([
      { garmentId: "g1", confidence: 0.91 },
      { garmentId: "g2", confidence: 0.72 },
    ]);
  });

  it("returns null when prediction API fails", async () => {
    stubCustomVisionEnv();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response("Service unavailable", { status: 503 })
    );

    const { classifyImage } = await import("./customVisionService.js");
    const result = await classifyImage("https://outfit.jpg");
    expect(result).toBeNull();
  });
});
