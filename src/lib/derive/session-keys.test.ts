import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveDeriveWallet } from "./session-keys";
import { deriveClient } from "./client";

describe("resolveDeriveWallet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns resolved derive wallet when lookup succeeds", async () => {
    vi.spyOn(deriveClient, "call").mockResolvedValueOnce({ wallet: "0x1111111111111111111111111111111111111111" });

    const wallet = await resolveDeriveWallet("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    expect(wallet).toBe("0x1111111111111111111111111111111111111111");
  });

  it("falls back to connected wallet when lookup fails", async () => {
    vi.spyOn(deriveClient, "call").mockRejectedValueOnce(new Error("account not found"));

    const eoa = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const wallet = await resolveDeriveWallet(eoa);

    expect(wallet).toBe(eoa);
  });
});
