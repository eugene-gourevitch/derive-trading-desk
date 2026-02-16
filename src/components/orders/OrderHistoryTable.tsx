"use client";

import { useOrderStore } from "@/lib/stores/orderStore";
import { formatPrice, formatUsd, formatDateTime } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";

export function OrderHistoryTable() {
  const orderHistory = useOrderStore((s) => s.orderHistory);

  if (orderHistory.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No order history available
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-border-subtle px-3 py-1 text-[10px] text-text-muted">
        <div className="w-32">Instrument</div>
        <div className="w-12">Side</div>
        <div className="w-14">Type</div>
        <div className="w-20 text-right">Price</div>
        <div className="w-16 text-right">Amount</div>
        <div className="w-16 text-right">Filled</div>
        <div className="w-20 text-right">Avg Fill</div>
        <div className="w-16">Status</div>
        <div className="flex-1 text-right">Time</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {orderHistory.map((order) => {
          const isBuy = order.direction === "buy";
          const filled = parseFloat(order.filled_amount || "0");
          const total = parseFloat(order.amount);
          const fillPct = total > 0 ? (filled / total) * 100 : 0;

          return (
            <div
              key={order.order_id}
              className="flex items-center border-b border-border-subtle px-3 py-1.5 hover:bg-bg-hover"
            >
              <div className="w-32 font-mono-nums font-medium text-text-primary">
                {order.instrument_name}
              </div>
              <div className="w-12">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-bold",
                    isBuy ? "bg-green/10 text-green" : "bg-red/10 text-red"
                  )}
                >
                  {order.direction.toUpperCase()}
                </span>
              </div>
              <div className="w-14 text-text-muted">
                {order.order_type}
              </div>
              <div className="w-20 text-right font-mono-nums text-text-secondary">
                {formatPrice(order.limit_price || "—", 2)}
              </div>
              <div className="w-16 text-right font-mono-nums text-text-secondary">
                {order.amount}
              </div>
              <div className="w-16 text-right font-mono-nums text-text-secondary">
                {order.filled_amount || "0"}
                <span className="ml-0.5 text-[9px] text-text-muted">
                  ({fillPct.toFixed(0)}%)
                </span>
              </div>
              <div className="w-20 text-right font-mono-nums text-text-secondary">
                {order.average_price ? formatPrice(order.average_price, 2) : "—"}
              </div>
              <div className="w-16">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-medium",
                    order.status === "filled" && "bg-green/10 text-green",
                    order.status === "cancelled" && "bg-yellow/10 text-yellow",
                    order.status === "expired" && "bg-text-muted/10 text-text-muted",
                    order.status === "rejected" && "bg-red/10 text-red"
                  )}
                >
                  {order.status}
                </span>
              </div>
              <div className="flex-1 text-right font-mono-nums text-text-muted">
                {order.creation_timestamp
                  ? formatDateTime(parseInt(order.creation_timestamp))
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
