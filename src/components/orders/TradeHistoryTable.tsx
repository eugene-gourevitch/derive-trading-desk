"use client";

import { useState, useMemo } from "react";
import { useOrderStore } from "@/lib/stores/orderStore";
import { formatPrice, formatUsd, formatDateTime } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

export function TradeHistoryTable() {
  const orderHistory = useOrderStore((s) => s.orderHistory);
  const [filter, setFilter] = useState("");

  // Derive trade history from filled orders
  const trades = useMemo(() => {
    return orderHistory
      .filter(
        (o) =>
          o.status === "filled" &&
          parseFloat(o.filled_amount || "0") > 0
      )
      .filter(
        (o) =>
          !filter ||
          o.instrument_name.toLowerCase().includes(filter.toLowerCase())
      )
      .sort(
        (a, b) =>
          parseInt(b.creation_timestamp || "0") -
          parseInt(a.creation_timestamp || "0")
      );
  }, [orderHistory, filter]);

  const handleExportCsv = () => {
    if (trades.length === 0) return;

    const headers = [
      "Time",
      "Instrument",
      "Side",
      "Type",
      "Amount",
      "Avg Price",
      "Total USD",
    ];
    const rows = trades.map((t) => [
      t.creation_timestamp
        ? new Date(parseInt(t.creation_timestamp)).toISOString()
        : "",
      t.instrument_name,
      t.direction,
      t.order_type,
      t.filled_amount || "0",
      t.average_price || "0",
      t.average_price && t.filled_amount
        ? (
            parseFloat(t.average_price) * parseFloat(t.filled_amount)
          ).toFixed(2)
        : "0",
    ]);

    const csv =
      headers.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-3 py-1.5">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by instrument..."
          className="w-48 rounded border border-border-default bg-bg-primary px-2 py-0.5 text-text-primary placeholder-text-muted outline-none focus:border-accent"
        />
        <button
          onClick={handleExportCsv}
          disabled={trades.length === 0}
          className="rounded bg-bg-tertiary px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        <div className="w-36">Time</div>
        <div className="w-32">Instrument</div>
        <div className="w-12">Side</div>
        <div className="w-14">Type</div>
        <div className="w-16 text-right">Amount</div>
        <div className="w-20 text-right">Avg Price</div>
        <div className="flex-1 text-right">Total</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {trades.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            {filter ? "No trades match filter" : "No trade history available"}
          </div>
        ) : (
          trades.map((trade, idx) => {
            const isBuy = trade.direction === "buy";
            const total =
              trade.average_price && trade.filled_amount
                ? (
                    parseFloat(trade.average_price) *
                    parseFloat(trade.filled_amount)
                  ).toFixed(2)
                : "0.00";

            return (
              <div
                key={`${trade.order_id}-${idx}`}
                className="flex items-center border-b border-border-subtle px-3 py-1.5 hover:bg-bg-hover"
              >
                <div className="w-36 font-mono-nums text-text-muted">
                  {trade.creation_timestamp
                    ? formatDateTime(parseInt(trade.creation_timestamp))
                    : "—"}
                </div>
                <div className="w-32 font-mono-nums font-medium text-text-primary">
                  {trade.instrument_name}
                </div>
                <div className="w-12">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-bold",
                      isBuy
                        ? "bg-green/10 text-green"
                        : "bg-red/10 text-red"
                    )}
                  >
                    {trade.direction.toUpperCase()}
                  </span>
                </div>
                <div className="w-14 text-text-muted">
                  {trade.order_type}
                </div>
                <div className="w-16 text-right font-mono-nums text-text-secondary">
                  {trade.filled_amount || "0"}
                </div>
                <div className="w-20 text-right font-mono-nums text-text-secondary">
                  {trade.average_price
                    ? formatPrice(trade.average_price, 2)
                    : "—"}
                </div>
                <div className="flex-1 text-right font-mono-nums text-text-primary">
                  {formatUsd(total)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        {trades.length} trade{trades.length !== 1 ? "s" : ""}
        {filter && ` (filtered)`}
      </div>
    </div>
  );
}
