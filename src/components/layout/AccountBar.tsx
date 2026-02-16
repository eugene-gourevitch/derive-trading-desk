"use client";

import { useMemo } from "react";
import { useAccountStore, selectPortfolioValue, selectMarginUtilization } from "@/lib/stores/accountStore";
import { usePositionStore } from "@/lib/stores/positionStore";
import { formatUsd, valueSentiment } from "@/lib/utils/formatting";
import { cn } from "@/lib/utils/cn";
import Decimal from "decimal.js-light";

export function AccountBar() {
  const portfolioValue = useAccountStore(selectPortfolioValue);
  const marginUtil = useAccountStore(selectMarginUtilization);
  const positions = usePositionStore((s) => s.positions);
  const unrealizedPnl = useMemo(() => {
    let total = new Decimal(0);
    for (const pos of positions) {
      total = total.plus(new Decimal(pos.unrealized_pnl));
    }
    return total.toFixed(2);
  }, [positions]);
  const subaccount = useAccountStore((s) => s.subaccount);

  const pnlSentiment = valueSentiment(unrealizedPnl);

  return (
    <div className="flex h-8 items-center justify-between border-t border-border-default bg-bg-secondary px-4 text-xs">
      {/* Portfolio Value */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-text-muted">Portfolio</span>
          <span className="font-mono-nums font-semibold text-text-primary">
            {formatUsd(portfolioValue)}
          </span>
        </div>

        {/* Margin */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted">Margin</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-primary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  marginUtil > 0.8
                    ? "bg-red"
                    : marginUtil > 0.5
                      ? "bg-yellow"
                      : "bg-green"
                )}
                style={{ width: `${Math.min(marginUtil * 100, 100)}%` }}
              />
            </div>
            <span className="font-mono-nums text-text-secondary">
              {(marginUtil * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Collateral */}
        {subaccount && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Collateral</span>
            <span className="font-mono-nums text-text-secondary">
              {formatUsd(subaccount.collaterals_value)}
            </span>
          </div>
        )}
      </div>

      {/* P&L */}
      <div className="flex items-center gap-2">
        <span className="text-text-muted">Unrealized P&L</span>
        <span
          className={cn(
            "font-mono-nums font-semibold",
            pnlSentiment === "positive" && "text-green",
            pnlSentiment === "negative" && "text-red",
            pnlSentiment === "neutral" && "text-text-secondary"
          )}
        >
          {formatUsd(unrealizedPnl)}
        </span>
      </div>
    </div>
  );
}
