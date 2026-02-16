"use client";

import { useOrderStore } from "@/lib/stores/orderStore";
import { formatPrice, formatQty, formatDateTime } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";

export function OpenOrdersTable() {
  const openOrders = useOrderStore((s) => s.openOrders);
  const removeOrder = useOrderStore((s) => s.removeOpenOrder);

  const handleCancel = async (orderId: string) => {
    // TODO: Phase 3 — call deriveClient.cancelOrder
    toast.info(`Cancelling order ${orderId.slice(0, 8)}...`);
    removeOrder(orderId);
  };

  const handleCancelAll = () => {
    // TODO: Phase 3 — call deriveClient.cancelAllOrders
    toast.info("Cancelling all orders...");
  };

  if (openOrders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No open orders
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Action Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-3 py-1">
        <span className="text-text-muted">
          {openOrders.length} open order{openOrders.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleCancelAll}
          className="rounded bg-red/10 px-2 py-0.5 text-[10px] font-medium text-red hover:bg-red/20"
        >
          Cancel All
        </button>
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-border-subtle px-3 py-1 text-text-muted">
        <div className="w-[140px]">Instrument</div>
        <div className="w-[60px]">Side</div>
        <div className="w-[60px]">Type</div>
        <div className="w-[80px] text-right">Price</div>
        <div className="w-[80px] text-right">Amount</div>
        <div className="w-[80px] text-right">Filled</div>
        <div className="w-[60px] text-right">TIF</div>
        <div className="w-[100px] text-right">Created</div>
        <div className="flex-1 text-right">Action</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {openOrders.map((order) => (
          <div
            key={order.order_id}
            className="flex items-center border-b border-border-subtle px-3 py-1.5 hover:bg-bg-hover"
          >
            <div className="w-[140px] font-medium text-text-primary">
              {order.instrument_name}
            </div>
            <div className="w-[60px]">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  order.direction === "buy"
                    ? "bg-green/10 text-green"
                    : "bg-red/10 text-red"
                )}
              >
                {order.direction.toUpperCase()}
              </span>
            </div>
            <div className="w-[60px] text-text-secondary">
              {order.order_type}
            </div>
            <div className="w-[80px] text-right font-mono-nums text-text-primary">
              {formatPrice(order.limit_price, 2)}
            </div>
            <div className="w-[80px] text-right font-mono-nums text-text-secondary">
              {formatQty(order.amount)}
            </div>
            <div className="w-[80px] text-right font-mono-nums text-text-secondary">
              {formatQty(order.filled_amount)} / {formatQty(order.amount)}
            </div>
            <div className="w-[60px] text-right text-text-muted">
              {order.time_in_force}
            </div>
            <div className="w-[100px] text-right text-text-muted">
              {formatDateTime(order.creation_timestamp)}
            </div>
            <div className="flex flex-1 justify-end">
              <button
                onClick={() => handleCancel(order.order_id)}
                className="rounded bg-red/10 px-2 py-0.5 text-[10px] text-red hover:bg-red/20"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
