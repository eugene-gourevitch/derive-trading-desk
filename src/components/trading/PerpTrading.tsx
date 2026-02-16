"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { formatPrice, formatUsd, formatPercent } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

export function PerpTrading() {
  const instrumentsList = useMarketStore((s) => s.instrumentsList);
  const perps = useMemo(
    () => instrumentsList.filter((i) => i.instrument_type === "perp"),
    [instrumentsList]
  );
  const setInstrument = useUiStore((s) => s.setSelectedInstrument);

  // Read raw tickers map - primitive Map reference is stable when unchanged
  const tickers = useMarketStore((s) => s.tickers);

  const perpData = useMemo(() => {
    return perps.map((inst) => {
      const ticker = tickers.get(inst.instrument_name);
      return {
        instrument: inst.instrument_name,
        last: ticker?.last || "—",
        change: ticker?.change || "0",
        volume: ticker?.volume || "0",
        openInterest: ticker?.open_interest || "0",
        bestBid: ticker?.best_bid || "—",
        bestAsk: ticker?.best_ask || "—",
        funding: ticker?.funding_rate || "0",
      };
    });
  }, [perps, tickers]);

  if (perpData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-xs text-text-muted">
        <div className="mb-2 text-sm font-medium text-text-secondary">
          Perpetual Futures
        </div>
        <div>No perpetual instruments loaded</div>
        <div className="mt-1">Connect and load instruments to see perps</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Perpetual Futures
        </span>
        <span className="ml-2 text-text-muted">
          {perpData.length} instruments
        </span>
      </div>

      {/* Table Header */}
      <div className="flex shrink-0 items-center border-b border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        <div className="w-32">Instrument</div>
        <div className="w-20 text-right">Last</div>
        <div className="w-16 text-right">24h %</div>
        <div className="w-20 text-right">Volume</div>
        <div className="w-20 text-right">OI</div>
        <div className="w-20 text-right">Bid</div>
        <div className="w-20 text-right">Ask</div>
        <div className="flex-1 text-right">Funding</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {perpData.map((perp) => {
          const changeNum = parseFloat(perp.change);
          const fundingNum = parseFloat(perp.funding);

          return (
            <div
              key={perp.instrument}
              onClick={() => setInstrument(perp.instrument)}
              className="flex cursor-pointer items-center border-b border-border-subtle px-3 py-2 hover:bg-bg-hover"
            >
              <div className="w-32 font-mono-nums font-medium text-text-primary">
                {perp.instrument}
              </div>
              <div className="w-20 text-right font-mono-nums text-text-secondary">
                {formatPrice(perp.last, 2)}
              </div>
              <div
                className={cn(
                  "w-16 text-right font-mono-nums",
                  changeNum >= 0 ? "text-green" : "text-red"
                )}
              >
                {changeNum >= 0 ? "+" : ""}
                {(changeNum * 100).toFixed(2)}%
              </div>
              <div className="w-20 text-right font-mono-nums text-text-secondary">
                {formatUsd(perp.volume)}
              </div>
              <div className="w-20 text-right font-mono-nums text-text-secondary">
                {formatUsd(perp.openInterest)}
              </div>
              <div className="w-20 text-right font-mono-nums text-green">
                {formatPrice(perp.bestBid, 2)}
              </div>
              <div className="w-20 text-right font-mono-nums text-red">
                {formatPrice(perp.bestAsk, 2)}
              </div>
              <div
                className={cn(
                  "flex-1 text-right font-mono-nums",
                  fundingNum >= 0 ? "text-green" : "text-red"
                )}
              >
                {formatPercent(perp.funding)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        Click a perp to select it for trading. Funding rates update every 8h.
      </div>
    </div>
  );
}
