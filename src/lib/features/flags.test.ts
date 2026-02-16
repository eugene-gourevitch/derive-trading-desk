import { describe, expect, it } from "vitest";
import { quotePipelineFlags } from "./flags";

describe("quotePipelineFlags", () => {
  it("exposes wsBulkCoalescing as boolean", () => {
    expect(typeof quotePipelineFlags.wsBulkCoalescing).toBe("boolean");
  });

  it("exposes adaptiveTickerPrefetch as boolean", () => {
    expect(typeof quotePipelineFlags.adaptiveTickerPrefetch).toBe("boolean");
  });

  it("exposes strictStaleGuard as boolean", () => {
    expect(typeof quotePipelineFlags.strictStaleGuard).toBe("boolean");
  });

  it("defaults flags to true when env is not set to 0", () => {
    // In test env we don't set NEXT_PUBLIC_* to 0, so defaults should be true
    expect(quotePipelineFlags.wsBulkCoalescing).toBe(true);
    expect(quotePipelineFlags.adaptiveTickerPrefetch).toBe(true);
    expect(quotePipelineFlags.strictStaleGuard).toBe(true);
  });
});
