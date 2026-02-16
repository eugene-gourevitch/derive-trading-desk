"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { useOrderBookSubscription } from "@/lib/hooks/useSubscription";
import { deriveClient } from "@/lib/derive/client";
import { formatPrice, formatQty } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import { useMemo } from "react";
import Decimal from "decimal.js-light";

/**
 * Derive has no REST orderbook endpoint — orderbook is WebSocket-only.
 * We build an initial "seed" book from the ticker endpoint which provides:
 *   best_bid_price, best_bid_amount, best_ask_price, best_ask_amount
 * Then the WS subscription provides full depth updates.
 */
export function OrderBookViz() {
  const instrument = useUiStore((s) => s.selectedInstrument);
  useOrderBookSubscription(instrument);
  const seededRef = useRef<string | null>(null);

  const book = useMarketStore((s) => s.orderBooks.get(instrument || ""));

  // Seed the orderbook from ticker data if no WS data yet
  useEffect(() => {
    if (!instrument) return;
    // If we already have a WS book with real depth, don't overwrite
    if (book && book.bids.length > 1 && seededRef.current === instrument) return;
    // Only seed once per instrument
    if (seededRef.current === instrument) return;

    deriveClient
      .call<Record<string, unknown>>("public/get_ticker", { instrument_name: instrument })
      .then((result) => {
        if (!result) return;
        seededRef.current = instrument;

        const bestBidPrice = String(result.best_bid_price || "0");
        const bestBidAmt = String(result.best_bid_amount || "0");
        const bestAskPrice = String(result.best_ask_price || "0");
        const bestAskAmt = String(result.best_ask_amount || "0");

        if (bestBidPrice === "0" && bestAskPrice === "0") return;

        const bidPrice = parseFloat(bestBidPrice);
        const askPrice = parseFloat(bestAskPrice);
        if (bidPrice <= 0 && askPrice <= 0) return;

        // Calculate tick size based on price magnitude
        const refPrice = bidPrice > 0 ? bidPrice : askPrice;
        const tickSize = refPrice > 1000 ? 1 : refPrice > 100 ? 0.1 : 0.01;

        const bids = [];
        const asks = [];

        // Create synthetic levels (decreasing qty further from spread)
        for (let i = 0; i < 10; i++) {
          const bidP = bidPrice - i * tickSize;
          const askP = askPrice + i * tickSize;
          const qtyMultiplier = Math.max(0.1, 1 - i * 0.08);

          if (bidP > 0) {
            bids.push({
              price: bidP.toFixed(2),
              qty: (parseFloat(bestBidAmt) * qtyMultiplier).toFixed(4),
            });
          }
          if (askP > 0) {
            asks.push({
              price: askP.toFixed(2),
              qty: (parseFloat(bestAskAmt) * qtyMultiplier).toFixed(4),
            });
          }
        }

        useMarketStore.getState().updateOrderBook(instrument, {
          instrument_name: instrument,
          depth: 10,
          timestamp: String(Date.now()),
          bids,
          asks,
        });
        console.log(`[Book] Seeded orderbook for ${instrument} from ticker: bid=${bestBidPrice}, ask=${bestAskPrice}`);
      })
      .catch((err) => {
        console.warn("[Book] Failed to seed orderbook:", err);
      });
  }, [instrument, book]);

  const { bids, asks, maxQty, spread, spreadPct } = useMemo(() => {
    if (!book)
      return { bids: [], asks: [], maxQty: 0, spread: "—", spreadPct: "—" };

    const bidLevels = book.bids.slice(0, 15);
    const askLevels = book.asks.slice(0, 15);

    let max = 0;
    for (const level of [...bidLevels, ...askLevels]) {
      const qty = parseFloat(level.qty);
      if (qty > max) max = qty;
    }

    let sp = "—";
    let spPct = "—";
    if (bidLevels.length > 0 && askLevels.length > 0) {
      const bestBid = new Decimal(bidLevels[0]!.price);
      const bestAsk = new Decimal(askLevels[0]!.price);
      const diff = bestAsk.minus(bestBid);
      sp = diff.toFixed(2);
      const mid = bestBid.plus(bestAsk).div(2);
      if (!mid.isZero()) {
        spPct = diff.div(mid).times(100).toFixed(3) + "%";
      }
    }

    return {
      bids: bidLevels,
      asks: askLevels.reverse(), // Display asks top-down
      maxQty: max,
      spread: sp,
      spreadPct: spPct,
    };
  }, [book]);

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
      </div>

      {/* Asks (reversed so lowest ask is at bottom) */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col justify-end">
          {asks.map((level, i) => (
            <OrderBookRow
              key={`ask-${i}`}
              price={level.price}
              qty={level.qty}
              maxQty={maxQty}
              side="ask"
            />
          ))}
        </div>
      </div>

      {/* Spread */}
      <div className="flex shrink-0 items-center justify-between border-y border-border-subtle bg-bg-tertiary px-2 py-1">
        <span className="text-text-muted">Spread</span>
        <div className="flex gap-2 font-mono-nums">
          <span className="text-text-secondary">{spread}</span>
          <span className="text-text-muted">({spreadPct})</span>
        </div>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col">
          {bids.map((level, i) => (
            <OrderBookRow
              key={`bid-${i}`}
              price={level.price}
              qty={level.qty}
              maxQty={maxQty}
              side="bid"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderBookRow({
  price,
  qty,
  maxQty,
  side,
}: {
  price: string;
  qty: string;
  maxQty: number;
  side: "bid" | "ask";
}) {
  const pct = maxQty > 0 ? (parseFloat(qty) / maxQty) * 100 : 0;

  return (
    <div className="group relative flex items-center justify-between px-2 py-[2px] hover:bg-bg-hover">
      {/* Depth bar */}
      <div
        className={cn(
          "absolute inset-y-0 opacity-15",
          side === "bid" ? "right-0 bg-green" : "left-0 bg-red"
        )}
        style={{
          width: `${pct}%`,
          [side === "bid" ? "right" : "left"]: 0,
        }}
      />

      {/* Price */}
      <span
        className={cn(
          "relative z-10 font-mono-nums cursor-pointer",
          side === "bid" ? "text-green" : "text-red"
        )}
      >
        {formatPrice(price, 2)}
      </span>

      {/* Quantity */}
      <span className="relative z-10 font-mono-nums text-text-secondary">
        {formatQty(qty)}
      </span>
    </div>
  );
}
