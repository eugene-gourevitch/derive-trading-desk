import { describe, it, expect } from "vitest";
import { verifyLyraAuthHeaders } from "./verify-auth";

const validWallet = "0x1234567890123456789012345678901234567890";
const validSignature = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("verifyLyraAuthHeaders", () => {
  it("returns ok: false when wallet is missing", async () => {
    const r = await verifyLyraAuthHeaders(null, String(Date.now()), validSignature);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("returns ok: false when timestamp is missing", async () => {
    const r = await verifyLyraAuthHeaders(validWallet, null, validSignature);
    expect(r.ok).toBe(false);
  });

  it("returns ok: false when signature is missing", async () => {
    const r = await verifyLyraAuthHeaders(validWallet, String(Date.now()), null);
    expect(r.ok).toBe(false);
  });

  it("returns ok: false for invalid wallet format", async () => {
    const r = await verifyLyraAuthHeaders("not-an-address", String(Date.now()), validSignature);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("returns ok: false for invalid timestamp (NaN)", async () => {
    const r = await verifyLyraAuthHeaders(validWallet, "not-a-number", validSignature);
    expect(r.ok).toBe(false);
  });

  it("returns ok: false for timestamp out of window", async () => {
    const oldTs = String(Date.now() - 400_000);
    const r = await verifyLyraAuthHeaders(validWallet, oldTs, validSignature);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("window");
  });
});
