import { describe, it, expect } from "vitest";
import { isValidImageUrl } from "./urlValidator.js";

describe("isValidImageUrl", () => {
  // ── Valid URLs ────────────────────────────────────────────────────────────

  it("accepts a valid HTTPS Azure Blob Storage URL", () => {
    expect(isValidImageUrl("https://storageaccount.blob.core.windows.net/container/img.jpg")).toBe(true);
  });

  it("accepts a URL with subdirectory paths", () => {
    expect(isValidImageUrl("https://myaccount.blob.core.windows.net/images/user-1/photo.png")).toBe(true);
  });

  // ── Protocol checks ───────────────────────────────────────────────────────

  it("rejects a URL using http", () => {
    expect(isValidImageUrl("http://storageaccount.blob.core.windows.net/container/img.jpg")).toBe(false);
  });

  it("rejects a URL with no protocol", () => {
    expect(isValidImageUrl("storageaccount.blob.core.windows.net/container/img.jpg")).toBe(false);
  });

  it("rejects a ftp URL", () => {
    expect(isValidImageUrl("ftp://storageaccount.blob.core.windows.net/container/img.jpg")).toBe(false);
  });

  // ── Domain allow-list checks ──────────────────────────────────────────────

  it("rejects a URL from an external domain", () => {
    expect(isValidImageUrl("https://evil.example.com/img.jpg")).toBe(false);
  });

  it("rejects a URL that tries to spoof the allowed domain in the path", () => {
    expect(isValidImageUrl("https://evil.com/blob.core.windows.net/img.jpg")).toBe(false);
  });

  it("rejects a URL from a subdomain that does not end with .blob.core.windows.net", () => {
    expect(isValidImageUrl("https://storageaccount.blob.core.windows.net.evil.com/img.jpg")).toBe(false);
  });

  // ── Private / link-local IP checks ────────────────────────────────────────

  it("rejects the Azure IMDS link-local address (169.254.169.254)", () => {
    expect(isValidImageUrl("https://169.254.169.254/metadata/instance")).toBe(false);
  });

  it("rejects an RFC-1918 10.x.x.x address", () => {
    expect(isValidImageUrl("https://10.0.0.1/secret")).toBe(false);
  });

  it("rejects an RFC-1918 172.16.x.x address", () => {
    expect(isValidImageUrl("https://172.16.0.1/secret")).toBe(false);
  });

  it("rejects an RFC-1918 192.168.x.x address", () => {
    expect(isValidImageUrl("https://192.168.1.1/secret")).toBe(false);
  });

  it("rejects a loopback address (127.0.0.1)", () => {
    expect(isValidImageUrl("https://127.0.0.1/secret")).toBe(false);
  });

  // ── Malformed URL checks ──────────────────────────────────────────────────

  it("rejects an empty string", () => {
    expect(isValidImageUrl("")).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(isValidImageUrl("not-a-url")).toBe(false);
  });
});
