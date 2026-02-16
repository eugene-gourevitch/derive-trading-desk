import { describe, expect, it, beforeEach } from "vitest";
import {
  getQuotePipelineMetrics,
  recordQuoteMessageReceived,
  recordQuoteUpdatesDroppedByBackpressure,
  recordQuoteDeadLetterChannel,
  recordQuoteReconnectAttempt,
  recordQuoteSubscribeAckRetry,
  recordQuoteTickerUpdatesApplied,
} from "./quote-metrics";

describe("quote-metrics", () => {
  beforeEach(() => {
    // Reset by re-recording zero deltas (module state is in-memory; we can't reset without exposing reset)
    // So we just assert structure and that recording increments
    const m = getQuotePipelineMetrics();
    expect(m).toHaveProperty("messagesReceived");
    expect(m).toHaveProperty("updatesDroppedByBackpressure");
    expect(m).toHaveProperty("deadLetterChannelParse");
    expect(m).toHaveProperty("reconnectAttempts");
    expect(m).toHaveProperty("subscribeAckRetries");
    expect(m).toHaveProperty("tickerUpdatesApplied");
  });

  it("returns metrics object with all expected keys", () => {
    const m = getQuotePipelineMetrics();
    expect(typeof m.messagesReceived).toBe("number");
    expect(typeof m.updatesDroppedByBackpressure).toBe("number");
    expect(typeof m.deadLetterChannelParse).toBe("number");
    expect(typeof m.reconnectAttempts).toBe("number");
    expect(typeof m.subscribeAckRetries).toBe("number");
    expect(typeof m.tickerUpdatesApplied).toBe("number");
  });

  it("increments when record functions are called", () => {
    const before = getQuotePipelineMetrics();
    recordQuoteMessageReceived();
    recordQuoteMessageReceived();
    recordQuoteUpdatesDroppedByBackpressure(5);
    recordQuoteDeadLetterChannel();
    recordQuoteReconnectAttempt();
    recordQuoteSubscribeAckRetry();
    recordQuoteTickerUpdatesApplied(10);
    const after = getQuotePipelineMetrics();
    expect(after.messagesReceived).toBeGreaterThanOrEqual(before.messagesReceived + 2);
    expect(after.updatesDroppedByBackpressure).toBeGreaterThanOrEqual(before.updatesDroppedByBackpressure + 5);
    expect(after.deadLetterChannelParse).toBeGreaterThanOrEqual(before.deadLetterChannelParse + 1);
    expect(after.reconnectAttempts).toBeGreaterThanOrEqual(before.reconnectAttempts + 1);
    expect(after.subscribeAckRetries).toBeGreaterThanOrEqual(before.subscribeAckRetries + 1);
    expect(after.tickerUpdatesApplied).toBeGreaterThanOrEqual(before.tickerUpdatesApplied + 10);
  });
});
