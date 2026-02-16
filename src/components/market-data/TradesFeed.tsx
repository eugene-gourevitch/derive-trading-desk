"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { useTradesSubscription } from "@/lib/hooks/useSubscription";
import { deriveClient } from "@/lib/derive/client";
import { formatPrice, formatQty, formatTime } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import type { DeriveTrade } from "@/lib/derive/types";

const EMPTY_TRADES: never[] = [];

export function TradesFeed() {
  const instrument = useUiStore((s) => s.selectedInstrument);
  useTradesSubscription(instrument);
  const fetchedRef = useRef<string | null>(null);

  const trades = useMarketStore((s) => s.recentTrades.get(instrument || "")) ?? EMPTY_TRADES;

  // Fetch initial trades via REST on mount / instrument change
  useEffect(() => {
    if (!instrument || fetchedRef.current === instrument) return;
    fetchedRef.current = instrument;

    deriveClient
      .call<{ trades: Array<{
        trade_id: string;
        instrument_name: string;
        trade_price: string;
        trade_amount: string;
        direction: "buy" | "sell";
        timestamp: number;
        mark_price: string;
        index_price: string;
      }>; pagination?: unknown }>("public/get_trade_history", {
        instrument_name: instrument,
        count: 50,
      })
      .then((result) => {
        // API returns { trades: [...], pagination: {...} }
        const tradesArr = result?.trades ?? (Array.isArray(result) ? result : []);
        if (tradesArr.length > 0) {
          const mapped: DeriveTrade[] = tradesArr.map((t) => ({
            trade_id: t.trade_id,
            instrument_name: t.instrument_name,
            trade_price: t.trade_price,
            trade_amount: t.trade_amount,
            direction: t.direction,
            timestamp: t.timestamp,
            mark_price: t.mark_price,
            index_price: t.index_price,
          }));
          useMarketStore.getState().setTrades(instrument, mapped);
          console.log(`[Trades] Loaded ${mapped.length} trades for ${instrument}`);
        }
      })
      .catch((err) => {
        console.warn("[Trades] Failed to fetch trades:", err);
      });
  }, [instrument]);

  if (!instrument) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        Select an instrument
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-2 py-1">
        <span className="text-text-muted">Price</span>
        <span className="text-text-muted">Qty</span>
        <span className="text-text-muted">Time</span>
      </div>

      {/* Trades */}
      <div className="flex-1 overflow-auto">
        {trades.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            No recent trades
          </div>
        ) : (
          trades.map((trade, i) => (
            <div
              key={`${trade.timestamp}-${i}`}
              className="flex items-center justify-between px-2 py-[2px] hover:bg-bg-hover"
            >
              <span
                className={cn(
                  "font-mono-nums",
                  trade.direction === "buy" ? "text-green" : "text-red"
                )}
              >
                {formatPrice(trade.trade_price, 2)}
              </span>
              <span className="font-mono-nums text-text-secondary">
                {formatQty(trade.trade_amount)}
              </span>
              <span className="font-mono-nums text-text-muted">
                {formatTime(trade.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
