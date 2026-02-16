"use client";

import { useState } from "react";
import { useUiStore } from "@/lib/stores/uiStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { useTickerSubscription } from "@/lib/hooks/useSubscription";
import { formatPrice, formatUsd } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import type { OrderSide, OrderType, TimeInForce } from "@/lib/derive/types";

type OrderTab = "limit" | "market";

export function OrderEntry() {
  const instrument = useUiStore((s) => s.selectedInstrument);
  useTickerSubscription(instrument);
  const ticker = useMarketStore((s) => s.tickers.get(instrument || ""));

  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderTab>("limit");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [tif, setTif] = useState<TimeInForce>("gtc");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total =
    price && amount
      ? (parseFloat(price) * parseFloat(amount)).toFixed(2)
      : "0.00";

  const handleSubmit = async () => {
    if (!instrument || !amount || (orderType === "limit" && !price)) return;
    setIsSubmitting(true);

    // TODO: Phase 3 - implement actual signing and submission
    console.log("Submit order:", {
      instrument,
      side,
      orderType,
      price,
      amount,
      tif,
      reduceOnly,
    });

    setTimeout(() => setIsSubmitting(false), 500);
  };

  return (
    <div className="flex h-full flex-col p-3 text-xs">
      {/* Instrument */}
      <div className="mb-3 text-center">
        <span className="font-mono-nums text-sm font-semibold text-text-primary">
          {instrument || "—"}
        </span>
        {ticker && (
          <div className="mt-0.5 flex items-center justify-center gap-2 font-mono-nums">
            <span className="text-text-secondary">
              {formatPrice(ticker.last ?? ticker.mark_price, 2)}
            </span>
            <span
              className={cn(
                parseFloat(ticker.change ?? "0") >= 0 ? "text-green" : "text-red"
              )}
            >
              {parseFloat(ticker.change ?? "0") >= 0 ? "+" : ""}
              {(parseFloat(ticker.change ?? "0") * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Buy/Sell Toggle */}
      <div className="mb-3 flex gap-1 rounded-md bg-bg-primary p-0.5">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "flex-1 rounded py-1.5 text-xs font-semibold transition-all",
            side === "buy"
              ? "bg-green text-text-inverse"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "flex-1 rounded py-1.5 text-xs font-semibold transition-all",
            side === "sell"
              ? "bg-red text-text-inverse"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          Sell / Short
        </button>
      </div>

      {/* Order Type */}
      <div className="mb-3 flex gap-1">
        {(["limit", "market"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              "flex-1 rounded py-1 text-[10px] font-medium transition-colors",
              orderType === t
                ? "bg-bg-elevated text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Price Input (Limit only) */}
      {orderType === "limit" && (
        <div className="mb-2">
          <label className="mb-0.5 block text-text-muted">Price</label>
          <div className="relative">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={ticker ? formatPrice(ticker.last ?? ticker.mark_price, 2) : "0.00"}
              className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 font-mono-nums text-text-primary placeholder-text-muted outline-none focus:border-accent"
              step="0.01"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
              {ticker && (
                <>
                  <button
                    onClick={() => setPrice(ticker.best_bid)}
                    className="rounded bg-green/10 px-1 py-0.5 text-[9px] text-green hover:bg-green/20"
                  >
                    BID
                  </button>
                  <button
                    onClick={() => setPrice(ticker.best_ask)}
                    className="rounded bg-red/10 px-1 py-0.5 text-[9px] text-red hover:bg-red/20"
                  >
                    ASK
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Amount Input */}
      <div className="mb-2">
        <label className="mb-0.5 block text-text-muted">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 font-mono-nums text-text-primary placeholder-text-muted outline-none focus:border-accent"
          step="0.01"
        />
        {/* Quick amount buttons */}
        <div className="mt-1 flex gap-1">
          {["0.1", "0.5", "1", "5", "10"].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className="flex-1 rounded bg-bg-tertiary py-0.5 text-[9px] text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Time in Force (Limit only) */}
      {orderType === "limit" && (
        <div className="mb-2">
          <label className="mb-0.5 block text-text-muted">Time in Force</label>
          <div className="flex gap-1">
            {(
              [
                { value: "gtc", label: "GTC" },
                { value: "ioc", label: "IOC" },
                { value: "post_only", label: "Post Only" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTif(opt.value)}
                className={cn(
                  "flex-1 rounded py-1 text-[10px] font-medium transition-colors",
                  tif === opt.value
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reduce Only */}
      <label className="mb-3 flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={reduceOnly}
          onChange={(e) => setReduceOnly(e.target.checked)}
          className="h-3 w-3 rounded border-border-default bg-bg-primary accent-accent"
        />
        <span className="text-text-muted">Reduce only</span>
      </label>

      {/* Total */}
      <div className="mb-3 flex items-center justify-between rounded bg-bg-primary px-2 py-1.5">
        <span className="text-text-muted">Total</span>
        <span className="font-mono-nums text-text-primary">
          {formatUsd(total)}
        </span>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !instrument || !amount}
        className={cn(
          "w-full rounded-md py-2.5 text-sm font-bold transition-all disabled:opacity-40",
          side === "buy"
            ? "bg-green text-text-inverse hover:brightness-110"
            : "bg-red text-text-inverse hover:brightness-110"
        )}
      >
        {isSubmitting
          ? "Submitting..."
          : `${side === "buy" ? "Buy" : "Sell"} ${instrument || ""}`}
      </button>
    </div>
  );
}
