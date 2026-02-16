import { describe, it, expect, beforeEach } from "vitest";
import {
  consumeReplayToken,
  isTimestampInWindow,
  CLOCK_SKEW_MS,
} from "./replay";

describe("replay", () => {
  describe("consumeReplayToken", () => {
    it("allows first use of (wallet, timestamp)", () => {
      const wallet = "0x1234567890123456789012345678901234567890";
      const timestamp = String(Date.now());
      expect(consumeReplayToken(wallet, timestamp)).toBe(true);
    });

    it("rejects replay of same (wallet, timestamp)", () => {
      const wallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      const timestamp = String(Date.now());
      expect(consumeReplayToken(wallet, timestamp)).toBe(true);
      expect(consumeReplayToken(wallet, timestamp)).toBe(false);
    });

    it("allows same timestamp for different wallet", () => {
      const ts = String(Date.now());
      expect(consumeReplayToken("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ts)).toBe(true);
      expect(consumeReplayToken("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", ts)).toBe(true);
    });
  });

  describe("isTimestampInWindow", () => {
    it("returns true for now", () => {
      expect(isTimestampInWindow(Date.now(), CLOCK_SKEW_MS)).toBe(true);
    });

    it("returns true for now minus skew", () => {
      expect(isTimestampInWindow(Date.now() - CLOCK_SKEW_MS + 1000, CLOCK_SKEW_MS)).toBe(true);
    });

    it("returns false for too old", () => {
      expect(isTimestampInWindow(Date.now() - CLOCK_SKEW_MS - 1000, CLOCK_SKEW_MS)).toBe(false);
    });

    it("returns false for future beyond skew", () => {
      expect(isTimestampInWindow(Date.now() + CLOCK_SKEW_MS + 1000, CLOCK_SKEW_MS)).toBe(false);
    });
  });
});
