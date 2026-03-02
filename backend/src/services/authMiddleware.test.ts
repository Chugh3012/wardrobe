import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpRequest } from "@azure/functions";

/** Helper — encode a ClientPrincipal object as a base64 header value. */
function encodeClientPrincipal(principal: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(principal)).toString("base64");
}

describe("authMiddleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── isAuthRequired ────────────────────────────────────────────────────

  it("returns true by default (secure default)", async () => {
    const { isAuthRequired } = await import("./authMiddleware.js");
    expect(isAuthRequired()).toBe(true);
  });

  it("returns false when REQUIRE_AUTH=false", async () => {
    vi.stubEnv("REQUIRE_AUTH", "false");
    const { isAuthRequired } = await import("./authMiddleware.js");
    expect(isAuthRequired()).toBe(false);
  });

  it("returns true when REQUIRE_AUTH=true", async () => {
    vi.stubEnv("REQUIRE_AUTH", "true");
    const { isAuthRequired } = await import("./authMiddleware.js");
    expect(isAuthRequired()).toBe(true);
  });

  // ── extractUserId — x-ms-client-principal (base64, SEC-P5) ────────────

  it("extracts userId from base64 x-ms-client-principal header", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          identityProvider: "aad",
          userId: "user-abc",
          userDetails: "user@example.com",
          userRoles: ["authenticated"],
        }),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBe("user-abc");
  });

  it("extracts UUID userId from base64 client principal", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          identityProvider: "aad",
          userId: "550e8400-e29b-41d4-a716-446655440000",
          userRoles: ["authenticated"],
        }),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects client principal with missing userId", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          identityProvider: "aad",
          userDetails: "user@example.com",
        }),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("rejects client principal with non-string userId", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          userId: 12345,
        }),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("rejects invalid base64 in client principal", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal": "not-valid-base64!!!" },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("rejects non-JSON content in base64 client principal", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": Buffer.from("not json").toString("base64"),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("rejects userId with unsafe characters in client principal", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          userId: "../other-user",
        }),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("rejects userId exceeding 128 chars in client principal", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          userId: "a".repeat(129),
        }),
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  // ── extractUserId — x-ms-client-principal-id fallback (dev only) ──────

  it("ignores plain-text header when REQUIRE_AUTH=true (default)", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "user-abc" },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("falls back to plain-text header when REQUIRE_AUTH=false", async () => {
    vi.stubEnv("REQUIRE_AUTH", "false");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "user-abc" },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBe("user-abc");
  });

  it("prefers base64 principal over plain-text header", async () => {
    vi.stubEnv("REQUIRE_AUTH", "false");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: {
        "x-ms-client-principal": encodeClientPrincipal({
          userId: "base64-user",
        }),
        "x-ms-client-principal-id": "plain-text-user",
      },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBe("base64-user");
  });

  it("returns null when no headers are present", async () => {
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  it("trims whitespace from plain-text header (dev mode)", async () => {
    vi.stubEnv("REQUIRE_AUTH", "false");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "  user-abc  " },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBe("user-abc");
  });

  it("rejects userId with spaces in plain-text header", async () => {
    vi.stubEnv("REQUIRE_AUTH", "false");
    const request = new HttpRequest({
      method: "POST",
      url: "http://localhost/api/garments",
      headers: { "x-ms-client-principal-id": "user id with spaces" },
    });

    const { extractUserId } = await import("./authMiddleware.js");
    expect(extractUserId(request)).toBeNull();
  });

  // ── unauthorizedResponse ──────────────────────────────────────────────

  it("returns 401 response", async () => {
    const { unauthorizedResponse } = await import("./authMiddleware.js");
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.jsonBody.error).toContain("Authentication required");
  });
});
