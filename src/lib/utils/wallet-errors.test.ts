import { describe, it, expect } from "vitest";
import { getWalletErrorMessage } from "./wallet-errors";

describe("wallet-errors", () => {
  it("returns user_rejected for code 4001", () => {
    const r = getWalletErrorMessage({ code: 4001 }, "Fallback");
    expect(r.kind).toBe("user_rejected");
    expect(r.message).toContain("rejected");
  });

  it("returns user_rejected for UserRejectedRequestError name", () => {
    const r = getWalletErrorMessage({ name: "UserRejectedRequestError" }, "Fallback");
    expect(r.kind).toBe("user_rejected");
  });

  it("returns chain_mismatch for code 4901", () => {
    const r = getWalletErrorMessage({ code: 4901 }, "Fallback");
    expect(r.kind).toBe("chain_mismatch");
    expect(r.message).toContain("network");
  });

  it("returns chain_mismatch for SwitchChainError", () => {
    const r = getWalletErrorMessage({ name: "SwitchChainError" }, "Fallback");
    expect(r.kind).toBe("chain_mismatch");
  });

  it("returns fallback for null/undefined", () => {
    const r = getWalletErrorMessage(null, "Custom fallback");
    expect(r.kind).toBe("unknown");
    expect(r.message).toBe("Custom fallback");
  });

  it("maps server-like message to server_error", () => {
    const r = getWalletErrorMessage(new Error("Replay detected"), "Fallback");
    expect(r.kind).toBe("server_error");
    expect(r.message).toContain("Authentication");
  });
});
