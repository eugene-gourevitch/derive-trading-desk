import { describe, expect, it } from "vitest";
import type { DeriveTicker } from "@/lib/derive/types";
import { normalizeTickerSlimUpdate } from "@/lib/derive/websocket";

function makeBaseTicker(overrides: Partial<DeriveTicker> = {}): DeriveTicker {
  return {
    instrument_type: "option",
    instrument_name: "ETH-31DEC26-3000-C",
    best_bid: "10",
    best_bid_amount: "1",
    best_ask: "11",
    best_ask_amount: "2",
    timestamp: 1000,
    mark_price: "10.5",
    index_price: "3000",
    min_price: "0.1",
    max_price: "5000",
    option_pricing: {
      delta: "0.4",
      gamma: "0.01",
      vega: "0.2",
      theta: "-0.1",
      rho: "0.01",
      iv: "0.5",
      bid_iv: "0.48",
      ask_iv: "0.52",
      mark_price: "10.5",
      forward_price: "3010",
    },
    stats: {
      contract_volume: "100",
      num_trades: "10",
      open_interest: "500",
      high: "12",
      low: "9",
      percent_change: "0.03",
      usd_change: "0",
    },
    last: "10.5",
    change: "0.03",
    high: "12",
    low: "9",
    open_interest: "500",
    volume: "100",
    volume_value: "1000",
    best_bid_size: "1",
    best_ask_size: "2",
    funding_rate: "0",
    ...overrides,
  };
}

describe("normalizeTickerSlimUpdate", () => {
  const recentTs = () => Date.now() - 1000; // Within TTL, not future

  it("preserves previous fields when slim update is partial", () => {
    const prev = makeBaseTicker({ timestamp: recentTs() - 100 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: recentTs(),
      instrument_ticker: {
        b: "10.2",
        a: "11.3",
      },
    }, prev);

    expect(next).not.toBeNull();
    expect(next?.best_bid).toBe("10.2");
    expect(next?.best_ask).toBe("11.3");
    expect(next?.mark_price).toBe("10.5");
    expect(next?.option_pricing?.iv).toBe("0.5");
    expect(next?.open_interest).toBe("500");
  });

  it("returns null when update timestamp is older than previous ticker", () => {
    const prev = makeBaseTicker({ timestamp: recentTs() + 100 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: recentTs(),
      instrument_ticker: {
        b: "9.9",
        a: "10.1",
      },
    }, prev);

    expect(next).toBeNull();
  });

  it("maps compact option_pricing fields from ticker_slim updates", () => {
    const prev = makeBaseTicker({ timestamp: recentTs() - 100 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: recentTs(),
      instrument_ticker: {
        option_pricing: {
          d: "0.25",
          t: "-0.12",
          g: "0.0042",
          v: "0.55",
          i: "0.69",
          r: "1.2",
          f: "3020",
          m: "12.5",
          bi: "0.66",
          ai: "0.72",
        },
      },
    }, prev);

    expect(next).not.toBeNull();
    expect(next?.option_pricing).toEqual({
      delta: "0.25",
      theta: "-0.12",
      gamma: "0.0042",
      vega: "0.55",
      iv: "0.69",
      rho: "1.2",
      mark_price: "12.5",
      forward_price: "3020",
      bid_iv: "0.66",
      ask_iv: "0.72",
    });
  });

  it("preserves previous option_pricing when update has empty option_pricing payload", () => {
    const prev = makeBaseTicker({ timestamp: recentTs() - 100 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: recentTs(),
      instrument_ticker: {
        option_pricing: {},
      },
    }, prev);

    expect(next).not.toBeNull();
    expect(next?.option_pricing).toEqual(prev.option_pricing);
  });

  it("preserves previous option_pricing when update sends option_pricing null", () => {
    const prev = makeBaseTicker({ timestamp: recentTs() - 100 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: recentTs(),
      instrument_ticker: {
        option_pricing: null,
      },
    }, prev);

    expect(next).not.toBeNull();
    expect(next?.option_pricing).toEqual(prev.option_pricing);
  });

  it("returns null when update timestamp is beyond stale TTL", () => {
    const prev = makeBaseTicker({ timestamp: Date.now() - 120_000 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: Date.now() - 90_000,
      instrument_ticker: { b: "1", a: "2" },
    }, prev);
    expect(next).toBeNull();
  });

  it("returns null when update timestamp is in the future beyond skew", () => {
    const prev = makeBaseTicker({ timestamp: recentTs() - 100 });
    const next = normalizeTickerSlimUpdate("ETH-31DEC26-3000-C", {
      timestamp: Date.now() + 10_000,
      instrument_ticker: { b: "1", a: "2" },
    }, prev);
    expect(next).toBeNull();
  });
});
