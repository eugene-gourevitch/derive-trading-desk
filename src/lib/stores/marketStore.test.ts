import { describe, expect, it, beforeEach } from "vitest";
import type { DeriveTicker } from "@/lib/derive/types";
import { useMarketStore } from "./marketStore";

function makeTicker(instrument: string, overrides: Partial<DeriveTicker> = {}): DeriveTicker {
  return {
    instrument_type: "option",
    instrument_name: instrument,
    best_bid: "10",
    best_bid_amount: "1",
    best_ask: "11",
    best_ask_amount: "2",
    timestamp: Date.now(),
    mark_price: "10.5",
    index_price: "3000",
    min_price: "0",
    max_price: "100",
    option_pricing: null,
    stats: {
      contract_volume: "0",
      num_trades: "0",
      open_interest: "0",
      high: "0",
      low: "0",
      percent_change: "0",
      usd_change: "0",
    },
    ...overrides,
  };
}

describe("marketStore", () => {
  beforeEach(() => {
    useMarketStore.getState().reset();
  });

  describe("updateTicker", () => {
    it("sets a single ticker in the map", () => {
      const ticker = makeTicker("ETH-31DEC26-3000-C");
      useMarketStore.getState().updateTicker("ETH-31DEC26-3000-C", ticker);
      expect(useMarketStore.getState().tickers.get("ETH-31DEC26-3000-C")).toEqual(ticker);
    });

    it("overwrites existing ticker for same instrument", () => {
      useMarketStore.getState().updateTicker("ETH-PERP", makeTicker("ETH-PERP", { best_bid: "1" }));
      useMarketStore.getState().updateTicker("ETH-PERP", makeTicker("ETH-PERP", { best_bid: "2" }));
      expect(useMarketStore.getState().tickers.get("ETH-PERP")?.best_bid).toBe("2");
    });
  });

  describe("updateTickersBulk", () => {
    it("updates multiple tickers in one store write", () => {
      const updates: Array<[string, DeriveTicker]> = [
        ["ETH-31DEC26-3000-C", makeTicker("ETH-31DEC26-3000-C")],
        ["ETH-31DEC26-3000-P", makeTicker("ETH-31DEC26-3000-P")],
      ];
      useMarketStore.getState().updateTickersBulk(updates);
      const tickers = useMarketStore.getState().tickers;
      expect(tickers.size).toBe(2);
      expect(tickers.get("ETH-31DEC26-3000-C")).toEqual(updates[0][1]);
      expect(tickers.get("ETH-31DEC26-3000-P")).toEqual(updates[1][1]);
    });

    it("preserves existing tickers when adding new ones via bulk", () => {
      useMarketStore.getState().updateTicker("ETH-PERP", makeTicker("ETH-PERP"));
      useMarketStore.getState().updateTickersBulk([["ETH-31DEC26-3000-C", makeTicker("ETH-31DEC26-3000-C")]]);
      const tickers = useMarketStore.getState().tickers;
      expect(tickers.size).toBe(2);
      expect(tickers.get("ETH-PERP")).toBeDefined();
      expect(tickers.get("ETH-31DEC26-3000-C")).toBeDefined();
    });

    it("no-ops when updates array is empty", () => {
      useMarketStore.getState().updateTicker("ETH-PERP", makeTicker("ETH-PERP"));
      useMarketStore.getState().updateTickersBulk([]);
      expect(useMarketStore.getState().tickers.size).toBe(1);
    });
  });
});
