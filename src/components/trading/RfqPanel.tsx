"use client";

import { useState } from "react";
import { useRfqStore } from "@/lib/stores/rfqStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { useMarketStore } from "@/lib/stores/marketStore";
import { formatUsd } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import type { OrderSide } from "@/lib/derive/types";

interface LegInput {
  instrument: string;
  side: OrderSide;
  amount: string;
}

export function RfqPanel() {
  const underlying = useUiStore((s) => s.selectedUnderlying);
  const instruments = useMarketStore((s) => s.instruments);
  const { legs, isSubmitting, activeRfqId, quotes, addLeg, removeLeg, updateLeg, clearLegs } =
    useRfqStore();

  const [newLeg, setNewLeg] = useState<LegInput>({
    instrument: "",
    side: "buy",
    amount: "1",
  });

  // Filter instruments for the selected underlying
  const availableInstruments = Array.from(instruments.values()).filter(
    (i) => i.base_currency === underlying || i.instrument_name.startsWith(underlying)
  );

  const handleAddLeg = () => {
    if (!newLeg.instrument || !newLeg.amount) return;
    addLeg({
      instrument_name: newLeg.instrument,
      direction: newLeg.side,
      amount: newLeg.amount,
    });
    setNewLeg({ instrument: "", side: "buy", amount: "1" });
  };

  const handleSubmitRfq = async () => {
    if (legs.length === 0) return;
    // TODO: implement actual RFQ signing and submission
    console.log("Submit RFQ:", legs);
  };

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            RFQ Builder — {underlying}
          </span>
          {legs.length > 0 && (
            <button
              onClick={clearLegs}
              className="text-[10px] text-red hover:text-red/80"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Add Leg Form */}
      <div className="shrink-0 border-b border-border-subtle p-3">
        <div className="mb-2 text-[10px] font-medium text-text-muted">Add Leg</div>

        {/* Instrument Select */}
        <select
          value={newLeg.instrument}
          onChange={(e) => setNewLeg({ ...newLeg, instrument: e.target.value })}
          className="mb-2 w-full rounded border border-border-default bg-bg-primary px-2 py-1.5 font-mono-nums text-text-primary outline-none focus:border-accent"
        >
          <option value="">Select instrument...</option>
          {availableInstruments.slice(0, 50).map((inst) => (
            <option key={inst.instrument_name} value={inst.instrument_name}>
              {inst.instrument_name}
            </option>
          ))}
        </select>

        {/* Side + Amount */}
        <div className="flex gap-2">
          <div className="flex gap-1 rounded bg-bg-primary p-0.5">
            <button
              onClick={() => setNewLeg({ ...newLeg, side: "buy" })}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-semibold transition-colors",
                newLeg.side === "buy"
                  ? "bg-green text-text-inverse"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              Buy
            </button>
            <button
              onClick={() => setNewLeg({ ...newLeg, side: "sell" })}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-semibold transition-colors",
                newLeg.side === "sell"
                  ? "bg-red text-text-inverse"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              Sell
            </button>
          </div>

          <input
            type="number"
            value={newLeg.amount}
            onChange={(e) => setNewLeg({ ...newLeg, amount: e.target.value })}
            placeholder="Amount"
            className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 font-mono-nums text-text-primary outline-none focus:border-accent"
            step="0.1"
            min="0"
          />

          <button
            onClick={handleAddLeg}
            disabled={!newLeg.instrument || !newLeg.amount}
            className="rounded bg-accent px-3 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-accent/80 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Legs List */}
      <div className="flex-1 overflow-auto">
        {legs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="mb-1">No legs added</div>
              <div className="text-[10px]">Add instruments above to build your RFQ</div>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {legs.map((leg, idx) => (
              <div
                key={idx}
                className="mb-1 flex items-center justify-between rounded bg-bg-primary px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-bold",
                      leg.direction === "buy"
                        ? "bg-green/10 text-green"
                        : "bg-red/10 text-red"
                    )}
                  >
                    {leg.direction.toUpperCase()}
                  </span>
                  <span className="font-mono-nums text-text-primary">
                    {leg.instrument_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-nums text-text-secondary">
                    ×{leg.amount}
                  </span>
                  <button
                    onClick={() => removeLeg(idx)}
                    className="text-text-muted hover:text-red"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quotes Section */}
      {quotes.length > 0 && (
        <div className="shrink-0 border-t border-border-subtle p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Quotes Received
          </div>
          {quotes.map((quote, idx) => (
            <div
              key={idx}
              className="mb-1 flex items-center justify-between rounded bg-bg-tertiary px-3 py-1.5"
            >
              <span className="font-mono-nums text-text-secondary">
                {formatUsd(quote.total_price)}
              </span>
              <button className="rounded bg-accent/20 px-2 py-0.5 text-[9px] font-semibold text-accent hover:bg-accent/30">
                Execute
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submit Button */}
      <div className="shrink-0 border-t border-border-subtle p-3">
        <button
          onClick={handleSubmitRfq}
          disabled={legs.length === 0 || isSubmitting}
          className="w-full rounded-md bg-accent py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
        >
          {isSubmitting
            ? "Submitting RFQ..."
            : activeRfqId
              ? "RFQ Active — Polling Quotes..."
              : `Send RFQ (${legs.length} leg${legs.length !== 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
}
