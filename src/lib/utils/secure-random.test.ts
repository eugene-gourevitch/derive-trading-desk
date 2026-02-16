import { describe, it, expect } from "vitest";
import { secureRandomInt, secureRandomHex } from "./secure-random";

describe("secure-random", () => {
  describe("secureRandomInt", () => {
    it("returns integer in [0, max)", () => {
      for (let i = 0; i < 50; i++) {
        const n = secureRandomInt(1000);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(1000);
      }
    });

    it("throws for max <= 0", () => {
      expect(() => secureRandomInt(0)).toThrow();
      expect(() => secureRandomInt(-1)).toThrow();
    });

    it("produces spread over range", () => {
      const buckets = new Map<number, number>();
      for (let i = 0; i < 10; i++) buckets.set(i, 0);
      for (let i = 0; i < 500; i++) {
        const n = secureRandomInt(10);
        buckets.set(n, (buckets.get(n) ?? 0) + 1);
      }
      buckets.forEach((count) => {
        expect(count).toBeGreaterThan(0);
      });
    });
  });

  describe("secureRandomHex", () => {
    it("returns string of length byteCount*2", () => {
      expect(secureRandomHex(4).length).toBe(8);
      expect(secureRandomHex(8).length).toBe(16);
    });

    it("returns only hex characters", () => {
      const hex = secureRandomHex(16);
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
    });
  });
});
