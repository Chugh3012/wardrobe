import { describe, it, expect, vi, afterEach } from "vitest";

describe("configService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default high confidence threshold (0.85)", async () => {
    const { getHighConfidenceThreshold } = await import("./configService.js");
    expect(getHighConfidenceThreshold()).toBe(0.85);
  });

  it("reads HIGH_CONFIDENCE_THRESHOLD from env", async () => {
    vi.stubEnv("HIGH_CONFIDENCE_THRESHOLD", "0.90");
    const { getHighConfidenceThreshold } = await import("./configService.js");
    expect(getHighConfidenceThreshold()).toBe(0.90);
  });

  it("returns default medium confidence threshold (0.60)", async () => {
    const { getMediumConfidenceThreshold } = await import("./configService.js");
    expect(getMediumConfidenceThreshold()).toBe(0.60);
  });

  it("reads MEDIUM_CONFIDENCE_THRESHOLD from env", async () => {
    vi.stubEnv("MEDIUM_CONFIDENCE_THRESHOLD", "0.50");
    const { getMediumConfidenceThreshold } = await import("./configService.js");
    expect(getMediumConfidenceThreshold()).toBe(0.50);
  });

  it("classifies high confidence correctly", async () => {
    const { getConfidenceLevel } = await import("./configService.js");
    expect(getConfidenceLevel(0.95)).toBe("high");
    expect(getConfidenceLevel(0.85)).toBe("high");
  });

  it("classifies medium confidence correctly", async () => {
    const { getConfidenceLevel } = await import("./configService.js");
    expect(getConfidenceLevel(0.84)).toBe("medium");
    expect(getConfidenceLevel(0.60)).toBe("medium");
  });

  it("classifies low confidence correctly", async () => {
    const { getConfidenceLevel } = await import("./configService.js");
    expect(getConfidenceLevel(0.59)).toBe("low");
    expect(getConfidenceLevel(0.0)).toBe("low");
  });

  it("uses custom thresholds from env", async () => {
    vi.stubEnv("HIGH_CONFIDENCE_THRESHOLD", "0.90");
    vi.stubEnv("MEDIUM_CONFIDENCE_THRESHOLD", "0.50");
    const { getConfidenceLevel } = await import("./configService.js");
    expect(getConfidenceLevel(0.89)).toBe("medium");
    expect(getConfidenceLevel(0.90)).toBe("high");
    expect(getConfidenceLevel(0.49)).toBe("low");
    expect(getConfidenceLevel(0.50)).toBe("medium");
  });
});
